/**
 * Inngest 백그라운드 잡: 한→영 번역
 *
 * 이벤트: 'file/translate.requested'
 * 처리:
 *   1. 대상 챕터 조회 + 소유권 확인 (chapter_ids 빈 배열 = 전체)
 *   2. 사용자 이메일 조회
 *   3. 챕터별 번역 (Claude API, step.run으로 Vercel 60초 제한 우회)
 *      → chapter_versions에 trigger='translation'으로 저장
 *   4. projects.updated_at 갱신 → Supabase Realtime 알림
 *   5. 완료 이메일 발송
 *
 * Claude API: claude-sonnet-4-6, 스트리밍 없이 배치 처리
 */

import { inngest } from './client'
import { createServiceClient } from '@/lib/supabase-server'
import { callClaude } from '@/lib/claude'
import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'
import type { TipTapDocument, TipTapNode } from '@/types'

const TRANSLATION_SYSTEM_PROMPT = `You are a professional Korean-to-English literary translator specializing in cultural localization for Western readers.

Rules:
- Translate naturally for English-speaking audiences, not word-for-word
- Preserve the author's tone, style, and voice
- Adapt Korean cultural references appropriately (explain or find English equivalents)
- Maintain paragraph structure and formatting markers
- Return ONLY the translated text, no explanations or notes
- For chapter titles: return just the translated title
- For body content: preserve the paragraph breaks with blank lines between paragraphs`

/** TipTap 문서에서 평문 텍스트 추출 */
function extractPlainText(doc: TipTapDocument | null): string {
  if (!doc?.content) return ''

  function nodeToText(node: TipTapNode): string {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'paragraph') {
      return (node.content ?? []).map(nodeToText).join('') + '\n'
    }
    if (node.type === 'heading') {
      return '# ' + (node.content ?? []).map(nodeToText).join('') + '\n'
    }
    if (node.content) return node.content.map(nodeToText).join('')
    return ''
  }

  return doc.content.map(nodeToText).join('\n').trim()
}

/** 번역된 평문을 TipTap 문서로 변환 */
function textToTipTapDoc(translatedText: string): TipTapDocument {
  const lines = translatedText.split(/\n\n+/)
  const content: TipTapNode[] = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      return {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: trimmed.slice(2) }],
      }
    }
    return {
      type: 'paragraph',
      content: trimmed ? [{ type: 'text', text: trimmed }] : [],
    }
  })
  return { type: 'doc', content }
}

export const translateJob = inngest.createFunction(
  {
    id: 'translate-manuscript',
    name: '원고 한→영 번역',
    concurrency: { limit: 2 },
    retries: 1,
    timeouts: { finish: '30m' },
  },
  { event: 'file/translate.requested' },
  async ({ event, step }) => {
    const { project_id, user_id, chapter_ids } = event.data
    const supabase = createServiceClient()

    let userEmail: string | null = null
    let projectTitle = '원고'

    try {
      // ── 1. 챕터 조회 + 소유권 확인 ──────────────────────────────────
      const fetchResult = await step.run('fetch-chapters', async () => {
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id, title')
          .eq('id', project_id)
          .eq('user_id', user_id)
          .single()

        if (projErr || !proj) throw new Error('프로젝트 접근 권한이 없습니다.')

        let query = supabase
          .from('chapters')
          .select('id, title, content, order_idx')
          .eq('project_id', project_id)
          .order('order_idx', { ascending: true })

        if (chapter_ids.length > 0) {
          query = query.in('id', chapter_ids)
        }

        const { data, error } = await query
        if (error) throw new Error(`챕터 조회 실패: ${error.message}`)
        return {
          chapters: data ?? [],
          title: (proj as { id: string; title: string }).title,
        }
      }) as unknown as {
        chapters: { id: string; title: string; content: unknown; order_idx: number }[]
        title: string
      }

      projectTitle = fetchResult.title

      if (fetchResult.chapters.length === 0) {
        return { success: true, translated: 0, message: '번역할 챕터가 없습니다.' }
      }

      // ── 2. 사용자 이메일 조회 ──────────────────────────────────────
      userEmail = await step.run('fetch-user-email', async () => {
        const { data } = await supabase
          .from('users')
          .select('email')
          .eq('id', user_id)
          .single()
        return (data as { email: string } | null)?.email ?? null
      }) as unknown as string | null

      const translatedChapterIds: string[] = []

      // ── 3. 챕터별 번역 (step.run으로 Vercel 60초 제한 우회) ──────────
      for (const chapter of fetchResult.chapters) {
        await step.run(`translate-chapter-${chapter.id}`, async () => {
          // 3-A. 제목 번역
          const translatedTitle = (
            await callClaude(
              `Translate this Korean chapter title to English:\n\n${chapter.title}`,
              TRANSLATION_SYSTEM_PROMPT,
              200,
            )
          ).trim() || chapter.title

          // 3-B. 본문 번역
          const bodyText = extractPlainText(chapter.content as TipTapDocument | null)
          let translatedContent: TipTapDocument | null = null

          if (bodyText) {
            const translatedBody = await callClaude(
              `Translate the following Korean manuscript chapter to English. Preserve paragraph structure:\n\n${bodyText}`,
              TRANSLATION_SYSTEM_PROMPT,
              4096,
            )
            translatedContent = textToTipTapDoc(translatedBody)
          }

          // 3-C. 번역 결과 저장
          // chapter_versions: { chapter_id, content(jsonb), trigger }
          // trigger='translation'으로 AI 편집 이력(ai_edit)과 명확히 구분
          // content = { lang, title, body } — 에디터가 읽을 수 있는 구조
          //
          // ❌ 수정 전: trigger='ai_edit', content 내 { translation_en, original_ko } 중첩
          // ✅ 수정 후: trigger='translation', content = { lang, title, body(TipTapDoc) }
          const { error } = await supabase.from('chapter_versions').insert({
            chapter_id: chapter.id,
            content: {
              lang:  'en',
              title: translatedTitle,
              body:  translatedContent,
            },
            trigger: 'translation',
          })

          if (error) {
            console.error(`[translate] 챕터 ${chapter.id} 번역 저장 실패:`, error.message)
            throw new Error(`번역 저장 실패: ${error.message}`)
          }

          translatedChapterIds.push(chapter.id)
        })
      }

      // ── 4. projects.updated_at 갱신 → Supabase Realtime 알림 ─────────
      // 클라이언트: projects 테이블 UPDATE 구독으로 번역 완료 감지
      await step.run('notify-realtime', async () => {
        await supabase
          .from('projects')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', project_id)
      })

      // ── 5. 완료 이메일 발송 ───────────────────────────────────────────
      await step.run('send-success-email', async () => {
        if (!userEmail) return
        await sendTranslationSuccessEmail({
          to:             userEmail,
          projectTitle:   fetchResult.title,
          translatedCount: translatedChapterIds.length,
        })
      })

      return {
        success:     true,
        project_id,
        translated:  translatedChapterIds.length,
        chapter_ids: translatedChapterIds,
      }

    } catch (error) {
      Sentry.captureException(error, {
        extra: { project_id, user_id, chapter_ids },
        tags: { job: 'translate-manuscript' },
      })

      if (userEmail) {
        await sendTranslationFailureEmail({ to: userEmail, projectTitle }).catch(() => {})
      }

      throw error
    }
  },
)

// ── 이메일 헬퍼 ──────────────────────────────────────────────────────────────

async function sendTranslationSuccessEmail(opts: {
  to: string
  projectTitle: string
  translatedCount: number
}): Promise<void> {
  const key = process.env.SECRET_RESEND_API_KEY
  if (!key) return
  const resend  = new Resend(key)
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'

  await resend.emails.send({
    from:    'Podwrite.ai <noreply@podwrite.ai>',
    to:      opts.to,
    subject: '[Podwrite.ai] 원고 번역이 완료되었습니다',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#111827;">원고 번역이 완료되었습니다</h2>
  <p><strong>${opts.projectTitle}</strong> 원고의 한→영 번역이 완료되었습니다.</p>
  <p style="color:#6b7280;">번역된 챕터: ${opts.translatedCount}개</p>
  <a href="${appUrl}/dashboard"
     style="display:inline-block;background:#111827;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
    대시보드에서 확인하기
  </a>
</div>`,
  })
}

async function sendTranslationFailureEmail(opts: {
  to: string
  projectTitle: string
}): Promise<void> {
  const key = process.env.SECRET_RESEND_API_KEY
  if (!key) return
  const resend  = new Resend(key)
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'

  await resend.emails.send({
    from:    'Podwrite.ai <noreply@podwrite.ai>',
    to:      opts.to,
    subject: '[Podwrite.ai] 원고 번역에 실패했습니다',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#111827;">원고 번역 실패</h2>
  <p><strong>${opts.projectTitle}</strong> 번역 중 오류가 발생했습니다.</p>
  <a href="${appUrl}/dashboard"
     style="display:inline-block;background:#111827;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
    대시보드로 이동
  </a>
</div>`,
  })
}
