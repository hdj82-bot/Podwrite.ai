import { redirect } from 'next/navigation'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import DashboardShell from './DashboardShell'
import { ToastProvider } from '@/components/ui/Toast'
import type { Plan } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { authUser, profile } = await getCurrentUserWithProfile()

  // 미인증 이중 보호 (middleware가 1차 처리)
  if (!authUser) {
    redirect('/login')
  }

  const plan: Plan = (profile?.plan as Plan) ?? 'free'
  const email = authUser.email ?? ''

  return (
    <ToastProvider>
      <DashboardShell plan={plan} email={email}>
        {children}
      </DashboardShell>
    </ToastProvider>
  )
}
