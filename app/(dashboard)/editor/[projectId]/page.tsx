/**
 * /editor/[projectId]
 *
 * 에디터 진입점 — SSR에서 프로젝트 + 챕터 목록을 로드하고
 * 클라이언트 EditorPage에 전달합니다.
 * 챕터 콘텐츠(content)는 에디터에서 선택 시 개별 로드합니다.
 */
import { redirect } from 'next/navigation'
import { createServerClient, getCurrentUserWithProfile } from '@/lib/supabase-server'
import EditorPage from '@/components/editor/EditorPage'
import type { Chapter, Project } from '@/types'

export const metadata = { title: '에디터 — Podwrite.ai' }

type Ctx = { params: Promise<{ projectId: string }> }

export default async function EditorRoute({ params }: Ctx) {
  const { projectId } = await params
  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  const supabase = await createServerClient()

  // 프로젝트 로드 (RLS로 소유권 검증)
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (pErr || !project) redirect('/dashboard')

  // 챕터 목록 로드 (content 제외 — 무거우므로 에디터에서 개별 로드)
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, project_id, order_idx, title, word_count, created_at, updated_at')
    .eq('project_id', projectId)
    .order('order_idx', { ascending: true })

  const chapterList = (chapters ?? []) as Chapter[]
  const firstChapterId = chapterList[0]?.id ?? null

  return (
    <EditorPage
      project={project as Project}
      chapters={chapterList}
      initialChapterId={firstChapterId}
    />
  )
}
