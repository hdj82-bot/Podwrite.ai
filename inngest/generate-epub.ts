/**
 * Inngest 백그라운드 잡: EPUB 생성
 *
 * 이벤트: 'file/epub.requested'
 * 처리:
 *   1. 프로젝트 + 챕터 DB 조회
 *   2. generateEpub() 호출
 *   3. Supabase Storage 업로드
 *   4. 서명된 다운로드 URL 반환
 */

import { inngest } from './client'
import { generateEpub } from '@/lib/epub-generator'
import { createServiceClient } from '@/lib/supabase-server'
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

    // ── 1. 프로젝트 + 챕터 조회 ──────────────────────────────────────
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

    // ── 2. 작가 이름 조회 ──────────────────────────────────────────────
    const authorName = await step.run('fetch-author', async () => {
      const { data } = await supabase
        .from('users')
        .select('email')
        .eq('id', user_id)
        .single()
      return data?.email?.split('@')[0] ?? '작가'
    })

    // ── 3. EPUB 생성 ──────────────────────────────────────────────────
    const epubBuffer = await step.run('generate-epub-buffer', async () => {
      return generateEpub({
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
    })

    // ── 4. Storage 업로드 ─────────────────────────────────────────────
    const storagePath = await step.run('upload-to-storage', async () => {
      const filePath = `${user_id}/${project_id}/export-${language}.epub`

      const { error } = await supabase.storage
        .from('project-files')
        .upload(filePath, epubBuffer, {
          contentType: 'application/epub+zip',
          upsert: true,
        })

      if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)
      return filePath
    })

    // ── 5. 서명된 URL 생성 (1시간 유효) ──────────────────────────────
    const downloadUrl = await step.run('create-signed-url', async () => {
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(storagePath, 3600)

      if (error) throw new Error(`서명 URL 생성 실패: ${error.message}`)
      return data.signedUrl
    })

    await step.run('notify-complete', async () => {
      await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() } as never)
        .eq('id', project_id)
    })

    return {
      success: true,
      project_id,
      language,
      storage_path: storagePath,
      download_url: downloadUrl,
    }
  },
)
