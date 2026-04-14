/**
 * Inngest 백그라운드 잡: EPUB 생성
 *
 * 이벤트: 'file/epub.requested'
 * 처리:
 *   1.   프로젝트 + 챕터 DB 조회
 *   1.5  NanumGothic.otf 폰트 파일 사전 확인 (lib/get-font-path.ts)
 *   2.   사용자 이메일 + 이름 조회
 *   3.   EPUB 생성 + Storage 업로드 (단일 step — Buffer 직렬화 방지)
 *   4.   서명된 다운로드 URL 생성 (24시간 유효)
 *   5.   완료 이메일 발송
 *   6.   file_exports INSERT → Supabase Realtime 클라이언트 알림
 */

import { inngest } from './client'
import { generateEpub } from '@/lib/epub-generator'
import { createServiceClient } from '@/lib/supabase-server'
import { sendFileReadyEmail, sendFileFailedEmail } from '@/lib/email'
import { getNanumGothicPath, fontExists } from '@/lib/get-font-path'
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
      }) as unknown as {
        project: { id: string; title: string; user_id: string }
        chapters: { id: string; title: string; content: unknown; order_idx: number }[]
      }

      projectTitle = project.title

      // ── 1.5 NanumGothic.otf 폰트 사전 확인 ──────────────────────────
      // lib/get-font-path.ts 경유 — Vercel 서버리스 환경에서 파일 존재 보장
      await step.run('check-font', async () => {
        const fontPath = getNanumGothicPath()
        if (!fontExists('NanumGothic.otf')) {
          // 경고 로그 (throw하지 않음 — epub-generator가 자체 폴백 처리)
          console.warn(`[generate-epub] NanumGothic.otf 없음: ${fontPath}`)
          console.warn('[generate-epub] 시스템 폰트로 폴백됩니다. 배포 시 font-install.sh 실행 필요')
        } else {
          console.log(`[generate-epub] 폰트 확인: ${fontPath}`)
        }
      })

      // ── 2. 사용자 이메일 + 이름 조회 ─────────────────────────────────
      const { email, authorName } = await step.run('fetch-user', async () => {
        const { data } = await supabase
          .from('users')
          .select('email, display_name')
          .eq('id', user_id)
          .single()
        const row = data as { email: string; display_name: string | null } | null
        return {
          email:      row?.email ?? null,
          authorName: row?.display_name ?? row?.email?.split('@')[0] ?? '작가',
        }
      }) as unknown as { email: string | null; authorName: string }

      userEmail = email

      // ── 3. EPUB 생성 + Storage 업로드 (단일 step) ─────────────────────
      // Buffer를 step 간 반환하면 JSON 직렬화 실패 → 동일 step에서 생성+업로드
      const storagePath = await step.run('generate-and-upload', async () => {
        const buf = await generateEpub({
          bookId:       `podwrite-${project_id}`,
          projectTitle: project.title,
          authorName,
          language,
          includeToc:   include_toc,
          autoToc:      auto_toc ?? true,
          chapters: chapters.map((ch) => ({
            id:        ch.id,
            title:     ch.title,
            content:   ch.content as TipTapDocument | null,
            order_idx: ch.order_idx,
          })),
        })

        const filePath = `${user_id}/${project_id}/export-${language}.epub`
        const { error } = await supabase.storage
          .from('project-files')
          .upload(filePath, buf, { contentType: 'application/epub+zip', upsert: true })
        if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)
        return filePath
      }) as string

      // ── 4. 서명된 URL 생성 (24시간 유효) ─────────────────────────────
      const downloadUrl = await step.run('create-signed-url', async () => {
        const { data, error } = await supabase.storage
          .from('project-files')
          .createSignedUrl(storagePath, 86_400)
        if (error) throw new Error(`서명 URL 생성 실패: ${error.message}`)
        return data.signedUrl
      }) as string

      // ── 5. 완료 이메일 발송 ───────────────────────────────────────────
      await step.run('send-success-email', async () => {
        if (!userEmail) return
        await sendFileReadyEmail(userEmail, project.title, 'EPUB', downloadUrl, 24)
      })

      // ── 6. file_exports INSERT → Supabase Realtime 클라이언트 알림 ────
      await step.run('notify-realtime', async () => {
        const expiresAt = new Date(Date.now() + 24 * 3_600_000).toISOString()
        await supabase.from('file_exports').insert({
          project_id,
          user_id,
          file_type:    'epub',
          platform:     null,
          language,
          status:       'completed',
          download_url: downloadUrl,
          storage_path: storagePath,
          expires_at:   expiresAt,
        })
      })

      return {
        success:      true,
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

      await supabase.from('file_exports').insert({
        project_id,
        user_id,
        file_type: 'epub',
        platform:  null,
        language,
        status:    'failed',
      }).catch(() => {})

      if (userEmail) {
        await sendFileFailedEmail(userEmail, projectTitle, 'EPUB').catch(() => {})
      }

      throw error
    }
  },
)
