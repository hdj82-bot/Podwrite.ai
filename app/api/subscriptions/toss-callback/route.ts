/**
 * GET /api/subscriptions/toss-callback
 *
 * 토스페이먼츠 빌링키 발급 성공 리다이렉트 수신
 *
 * 토스가 successUrl로 리다이렉트할 때 쿼리 파라미터로 전달:
 *   authKey    — 인증 키 (billingKey 교환용)
 *   customerKey — 고객 키
 *   plan       — 선택한 플랜 (BillingForm에서 successUrl에 포함)
 *   type       — 'monthly' | 'annual'
 *
 * 처리:
 *   create-billing 내부 로직 호출 → 완료 후 /settings/billing?success=billing_complete 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserWithProfile, createServiceClient } from '@/lib/supabase-server'
import { confirmBillingAuth, TossPaymentsError } from '@/lib/toss-payments'
import { PLAN_PRICES } from '@/lib/platform-specs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const authKey = searchParams.get('authKey')
  const customerKey = searchParams.get('customerKey')
  const plan = searchParams.get('plan') as 'basic' | 'pro' | null
  const billingType = (searchParams.get('type') ?? 'monthly') as 'monthly' | 'annual'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const failUrl = `${appUrl}/settings/billing?error=billing_failed`

  if (!authKey || !customerKey || !plan || !['basic', 'pro'].includes(plan)) {
    return NextResponse.redirect(failUrl)
  }

  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser || authUser.id !== customerKey) {
    return NextResponse.redirect(failUrl)
  }

  try {
    const tossRes = await confirmBillingAuth(authKey, customerKey)
    const billingKey = tossRes.billingKey

    const supabase = createServiceClient()
    const amount =
      billingType === 'annual' ? PLAN_PRICES[plan].annual : PLAN_PRICES[plan].monthly

    const nextBillingAt = new Date()
    nextBillingAt.setMonth(nextBillingAt.getMonth() + (billingType === 'annual' ? 12 : 1))

    // 기존 활성 구독 취소
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', authUser.id)
      .eq('status', 'active')

    // 새 구독 생성
    await supabase.from('subscriptions').insert({
      user_id: authUser.id,
      toss_billing_key: billingKey,
      plan,
      status: 'active',
      amount,
      next_billing_at: nextBillingAt.toISOString(),
    })

    // 사용자 플랜 업데이트
    await supabase
      .from('users')
      .update({ plan, plan_expires_at: nextBillingAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', authUser.id)

    return NextResponse.redirect(`${appUrl}/settings/billing?success=billing_complete`)
  } catch (err) {
    const msg = err instanceof TossPaymentsError ? err.code : 'unknown'
    console.error('[toss-callback] 오류:', msg)
    return NextResponse.redirect(failUrl)
  }
}
