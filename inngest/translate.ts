/**
 * Inngest 백그라운드 잡: 한→영 번역
 *
 * 이벤트: 'file/translate.requested'
 * 처리:
 *   1. 대상 챕터 조회 (chapter_ids 빈 배열 = 전체)
 *   2. Claude API로 챕터별 번역 (문화 현지화)
 *   3. 번역 결과를 chapters 테이블 번역 컬럼 또는 별도 저장
 *   4. 완료 알림
 *
 * Claude API: claude-sonnet-4-6, 스트리밍 없이 배치 처리
 */

import { inngest } from './client'
import { createServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
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
      const inner = (node.content ?? []).map(nodeToText).join('')
      return inner + '\n'
    }
    if (node.type === 'heading') {
      const inner = (node.content ?? []).map(nodeToText).join('')
      return '# ' + inner + '\n'
    }
    if (node.content) return node.content.map(nodeToText).join('')
    return ''
  }

  return doc.content.map(nodeToText).join('\n').trim()
}

/** 번역된 텍스트를 간단한 TipTap 문서로 변환 */
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

    // ── 1. 챕터 조회 ─────────────────────────────────────────────────
    const chapters = await step.run('fetch-chapters', async () => {
      let query = supabase
        .from('chapters')
        .select('id, title, content, order_idx')
        .eq('project_id', project_id)
        .order('order_idx', { ascending: true })

      if (chapter_ids.length > 0) {
        query = query.in('id', chapter_ids)
      }

      // 프로젝트 소유권 확인
      const { data: proj } = await supabase
        .from('projects')
        .select('id')
        .eq('id', project_id)
        .eq('user_id', user_id)
        .single()

      if (!proj) throw new Error('프로젝트 접근 권한이 없습니다.')

      const { data, error } = await query
      if (error) throw new Error(`챕터 조회 실패: ${error.message}`)
      return data ?? []
    })

    if (chapters.length === 0) {
      return { success: true, translated: 0, message: '번역할 챕터가 없습니다.' }
    }

    const client = new Anthropic({
      apiKey: process.env.SECRET_ANTHROPIC_API_KEY,
    })

    const translatedChapterIds: string[] = []

    // ── 2. 챕터별 번역 ────────────────────────────────────────────────
    for (const chapter of chapters) {
      await step.run(`translate-chapter-${chapter.id}`, async () => {
        // 제목 번역
        const titleResponse = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          system: TRANSLATION_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Translate this Korean chapter title to English:\n\n${chapter.title}`,
            },
          ],
        })
        const translatedTitle =
          titleResponse.content[0]?.type === 'text'
            ? titleResponse.content[0].text.trim()
            : chapter.title

        // 본문 번역
        const bodyText = extractPlainText(chapter.content as TipTapDocument | null)
        let translatedContent: TipTapDocument | null = null

        if (bodyText) {
          const bodyResponse = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: TRANSLATION_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: `Translate the following Korean manuscript chapter to English. Preserve paragraph structure:\n\n${bodyText}`,
              },
            ],
          })

          const translatedBody =
            bodyResponse.content[0]?.type === 'text' ? bodyResponse.content[0].text : ''
          translatedContent = textToTipTapDoc(translatedBody)
        }

        // 번역 결과 저장 — chapter_versions에 스냅샷 저장
        // 현재 DB 스키마: chapter_versions(chapter_id, content, trigger)
        // trigger = 'ai_edit'으로 저장
        await supabase.from('chapter_versions').insert({
          chapter_id: chapter.id,
          content: {
            translation_en: {
              title: translatedTitle,
              content: translatedContent,
            },
            original_ko: {
              title: chapter.title,
              content: chapter.content,
            },
          },
          trigger: 'ai_edit' as const,
        })

        translatedChapterIds.push(chapter.id)
      })
    }

    // ── 3. 완료 알림 ──────────────────────────────────────────────────
    await step.run('notify-complete', async () => {
      await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() } as never)
        .eq('id', project_id)
    })

    return {
      success: true,
      project_id,
      translated: translatedChapterIds.length,
      chapter_ids: translatedChapterIds,
    }
  },
)
