import { redirect, notFound } from 'next/navigation'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import type { Project, Chapter } from '@/types'
import ChaptersClient from './ChaptersClient'

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const supabase = await createServerClient()
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const title = (project as any)?.title as string | undefined
  return { title: title ? `${title} — 챕터` : '챕터 관리' }
}

export default async function ChaptersPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  const supabase = await createServerClient()

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError || !project) notFound()

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, project_id, order_idx, title, content, word_count, created_at, updated_at')
    .eq('project_id', projectId)
    .order('order_idx', { ascending: true })

  return (
    <ChaptersClient
      project={project as Project}
      chapters={(chapters ?? []) as Chapter[]}
    />
  )
}
