/**
 * Inngest 백그라운드 잡: DOCX 생성
 *
 * 이벤트: 'file/docx.requested'
 * 처리:
 *   1. 프로젝트 + 챕터 DB 조회
 *   2. generateDocx() 호출
 *   3. Supabase Storage 업로드 (storage: project-files/{project_id}/export.docx)
 *   4. Supabase Realtime notify (projects 행 status 업데이트로 트리거)
 */

import { inngest } from './client'
import { generateDocx } from '@/lib/docx-generator'
import { createServiceClient } from '@/lib/supabase-server'
import type { TipTapDocument } from '@/types'

export const generateDocxJob = inngest.createFunction(
  {
    id: 'generate-docx',
    name: 'DOCX 파일 생성',
    concurrency: { limit: 5 },
    retries: 2,
  },
  { event: 'file/docx.requested' },
  async ({ event, step }) => {
    const { project_id, user_id, platform } = event.data

    // ── 1. 프로젝트 조회 ──────────────────────────────────────────────
    const supabase = createServiceClient()

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
    })

    // ── 2. 사용자 이름 조회 ───────────────────────────────────────────
    const authorName = await step.run('fetch-author', async () => {
      const { data } = await supabase
        .from('users')
        .select('email')
        .eq('id', user_id)
        .single()
      return data?.email?.split('@')[0] ?? '작가'
    })

    // ── 3. DOCX 생성 ──────────────────────────────────────────────────
    const docxBuffer = await step.run('generate-docx-buffer', async () => {
      return generateDocx({
        projectTitle: project.title,
        authorName,
        platform,
        chapters: chapters.map((ch) => ({
          title: ch.title,
          content: ch.content as TipTapDocument | null,
          order_idx: ch.order_idx,
        })),
      })
    })

    // ── 4. Supabase Storage 업로드 ────────────────────────────────────
    const storagePath = await step.run('upload-to-storage', async () => {
      const filePath = `${user_id}/${project_id}/export-${platform}.docx`

      const { error } = await supabase.storage
        .from('project-files')
        .upload(filePath, docxBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })

      if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)
      return filePath
    })

    // ── 5. 다운로드 URL 생성 (서명된 URL, 1시간 유효) ─────────────────
    const downloadUrl = await step.run('create-signed-url', async () => {
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(storagePath, 3600)

      if (error) throw new Error(`서명 URL 생성 실패: ${error.message}`)
      return data.signedUrl
    })

    // ── 6. 완료 알림 (projects 테이블에 메타 저장 대신 별도 이벤트 사용 가능) ──
    await step.run('notify-complete', async () => {
      // Supabase Realtime 활용: 클라이언트에서 projects 변경 구독
      // 여기서는 별도 notification 테이블 없이 download_url을 projects에 임시 저장
      await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() } as never)
        .eq('id', project_id)
    })

    return {
      success: true,
      project_id,
      platform,
      storage_path: storagePath,
      download_url: downloadUrl,
    }
  },
)
