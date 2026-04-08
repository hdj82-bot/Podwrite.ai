import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { PLAN_LIMITS } from '@/types'
import type { Plan, Project } from '@/types'
import DashboardClient from './DashboardClient'

export const metadata = { title: '내 원고' }

export default async function DashboardPage() {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  const supabase = await createServerClient()
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  const plan: Plan = (profile?.plan as Plan) ?? 'free'
  const projectList: Project[] = (projects ?? []) as Project[]
  const limit = PLAN_LIMITS[plan].projects
  const limitLabel = limit === Infinity ? '무제한' : `${projectList.length} / ${limit}개`

  if (error) {
    console.error('projects fetch error', error)
  }

  return (
    <DashboardClient
      projects={projectList}
      plan={plan}
      limitLabel={limitLabel}
      currentCount={projectList.length}
    />
  )
}
