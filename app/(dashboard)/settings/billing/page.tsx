/**
 * /dashboard/settings/billing — 구독·결제 페이지
 *
 * 서버 컴포넌트 — lib/supabase-server.ts 패턴으로 user + subscription 조회
 * 인터랙티브 부분(취소 모달, 알림)은 BillingClient로 위임
 */
import { redirect } from 'next/navigation'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import type { Plan, Subscription, User } from '@/types'
import BillingClient from './BillingClient'

export const metadata = { title: '구독·결제' }

export default async function BillingPage() {
  const { authUser, profile: rawProfile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')
  const profile = rawProfile as User | null

  const plan = (profile?.plan ?? 'free') as Plan

  // ── 구독 조회 (active 또는 취소된 최신 구독) ──────────────────
  const supabase = await createServerClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', authUser.id)
    .in('status', ['active', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <BillingClient
      plan={plan}
      planExpiresAt={(profile?.plan_expires_at as string | null) ?? null}
      subscription={(sub as Subscription | null)}
    />
  )
}
