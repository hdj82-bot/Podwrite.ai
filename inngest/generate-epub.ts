/**
 * Inngest 백그라운드 잡: EPUB 생성
 *
 * 이벤트: 'file/epub.requested'
 * 처리:
 *   1. 프로젝트 + 챕터 DB 조회
 *   2. 사용자 이메일 + 이름 조회
 *   3. EPUB 생성 + Storage 업로드 (단일 step — Buffer 직렬화 방지)
 *   4. 서명된 다운로드 URL 생성 (24시간 유효)
 *   5. 완료 이메일 발송
 */

import { inngest } from './client'
import { generateEpub } from '@/lib/epub-generator'
import { createServiceClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'
import type { TipTapDocument } from '@/types'

export const generateEpubJob = inngest.createFunction(
  {
    id: 'generate-epub',
    name: 'EPUB 파일 생성',
    concurrency: { limit: 3 },
    retries: 2,
    timeouts: { finish: '10m' },
  },
  { event: 'file/epub.requested' },
  async ({ event, step }) => {
    const { project_id, user_id, language, include_toc } = event.data
    const supabase = createServiceClient()

    let userEmail: string | null = null
    let projectTitle = '원고'

    try {
      // ── 1. 프로젝트 + 챕터 조회 ─────────────────────────────────────
      const { project, chapters } = await step.run('fetch-project', async () => {
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id, title, user_id')
          .eq('id', project_id)
          .eq('user_id', user_id)
          .single()

        if (projErr || !proj) throw new Error(`프로젝트를 찾을 수 없습니다: ${project_id}`)

        const { data: chs, error: chErr } = await supabase
          .from('chapters')
          .select('id, title, content, order_idx')
          .eq('project_id', project_id)
          .order('order_idx', { ascending: true })

        if (chErr) throw new Error(`챕터 조회 실패: ${chErr.message}`)
        return { project: proj, chapters: chs ?? [] }
      }) as unknown as { project: { id: string; title: string; user_id: string }; chapters: { id: string; title: string; content: unknown; order_idx: number }[] }

      projectTitle = project.title

      // ── 2. 사용자 이메일 + 이름 조회 ─────────────────────────────────
      const { email, authorName } = await step.run('fetch-user', async () => {
        const { data } = await supabase
          .from('users')
          .select('email')
          .eq('id', user_id)
          .single()
        const emailVal = (data as { email: string } | null)?.email ?? null
        return {
          email: emailVal,
          authorName: emailVal?.split('@')[0] ?? '작가',
        }
      }) as unknown as { email: string | null; authorName: string }

      userEmail = email

      // ── 3. EPUB 생성 + Storage 업로드 (단일 step) ─────────────────────
      // Buffer를 step 간 반환하면 JSON 직렬화 실패 → 동일 step에서 생성+업로드
      const storagePath = await step.run('generate-and-upload', async () => {
        const buf = await generateEpub({
          bookId: `podwrite-${project_id}`,
          projectTitle: project.title,
          authorName,
          language,
          includeToc: include_toc,
          chapters: chapters.map((ch) => ({
            id: ch.id,
            title: ch.title,
            content: ch.content as TipTapDocument | null,
            order_idx: ch.order_idx,
          })),
        })

        const filePath = `${user_id}/${project_id}/export-${language}.epub`

        const { error } = await supabase.storage
          .from('project-files')
          .upload(filePath, buf, {
            contentType: 'application/epub+zip',
            upsert: true,
          })

        if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)
        return filePath
      }) as string

      // ── 4. 서명된 URL 생성 (24시간 유효) ─────────────────────────────
      const downloadUrl = await step.run('create-signed-url', async () => {
        const { data, error } = await supabase.storage
          .from('project-files')
          .createSignedUrl(storagePath, 86400)

        if (error) throw new Error(`서명 URL 생성 실패: ${error.message}`)
        return data.signedUrl
      }) as string

      // ── 5. 완료 이메일 발송 ───────────────────────────────────────────
      await step.run('send-success-email', async () => {
        if (!userEmail) return
        await sendEpubSuccessEmail({
          to: userEmail,
          projectTitle: project.title,
          language,
          downloadUrl,
        })
      })

      return {
        success: true,
        project_id,
        language,
        storage_path: storagePath,
        download_url: downloadUrl,
      }
    } catch (error) {
      Sentry.captureException(error, {
        extra: { project_id, user_id, language },
        tags: { job: 'generate-epub' },
      })

      if (userEmail) {
        await sendFileFailureEmail({
          to: userEmail,
          projectTitle,
          fileType: 'EPUB',
        }).catch(() => {})
      }

      throw error
    }
  },
)

// ── 이메일 헬퍼 ──────────────────────────────────────────────────────────────

const LANG_LABEL: Record<string, string> = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
  zh: '중국어',
}

async function sendEpubSuccessEmail(opts: {
  to: string
  projectTitle: string
  language: string
  downloadUrl: string
}): Promise<void> {
  const key = process.env.SECRET_RESEND_API_KEY
  if (!key) return

  const resend = new Resend(key)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'
  const langLabel = LANG_LABEL[opts.language] ?? opts.language.toUpperCase()

  await resend.emails.send({
    from: 'Podwrite.ai <noreply@podwrite.ai>',
    to: opts.to,
    subject: '[Podwrite.ai] EPUB 파일이 준비되었습니다',
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #111827;">EPUB 파일이 준비되었습니다</h2>
  <p>안녕하세요.</p>
  <p><strong>${opts.projectTitle}</strong> 원고의 EPUB 파일 생성이 완료되었습니다.</p>
  <p style="color: #6b7280;">언어: ${langLabel}</p>
  <a href="${opts.downloadUrl}"
     style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
    EPUB 파일 다운로드
  </a>
  <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
    이 링크는 <strong>24시간</strong> 동안 유효합니다.
  </p>
  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    <a href="${appUrl}" style="color: #888;">Podwrite.ai</a> | 문의: support@podwrite.ai
  </p>
</div>`,
  })
}

async function sendFileFailureEmail(opts: {
  to: string
  projectTitle: string
  fileType: string
}): Promise<void> {
  const key = process.env.SECRET_RESEND_API_KEY
  if (!key) return

  const resend = new Resend(key)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'

  await resend.emails.send({
    from: 'Podwrite.ai <noreply@podwrite.ai>',
    to: opts.to,
    subject: `[Podwrite.ai] ${opts.fileType} 파일 생성에 실패했습니다`,
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #111827;">${opts.fileType} 파일 생성 실패</h2>
  <p>안녕하세요.</p>
  <p><strong>${opts.projectTitle}</strong> 원고의 ${opts.fileType} 파일 생성 중 오류가 발생했습니다.</p>
  <p>잠시 후 다시 시도해 주세요. 문제가 지속되면 고객 지원에 문의해 주세요.</p>
  <a href="${appUrl}/dashboard"
     style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
    대시보드로 이동
  </a>
  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    <a href="${appUrl}" style="color: #888;">Podwrite.ai</a> | 문의: support@podwrite.ai
  </p>
</div>`,
  })
}
