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
import { sendFileReadyEmail, sendFileFailedEmail } from '@/lib/email'
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
    const { project_id, user_id, language, include_toc, auto_toc } = event.data
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
          autoToc: auto_toc ?? true,
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
        await sendFileReadyEmail(userEmail, project.title, 'EPUB', downloadUrl, 24)
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
        await sendFileFailedEmail(userEmail, projectTitle, 'EPUB').catch(() => {})
      }

      throw error
    }
  },
)
