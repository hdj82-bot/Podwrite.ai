/**
 * POST /api/subscriptions/create-billing
 *
 * 토스페이먼츠 빌링키 발급 완료 처리
 *
 * 흐름:
 *   1. 클라이언트에서 Toss 결제창 → 카드 등록 → authKey 리다이렉트
 *   2. 이 엔드포인트에 { authKey, customerKey, plan, billingType } 전송
 *   3. 토스 API로 billingKey 발급
 *   4. subscriptions 테이블 저장
 *   5. users.plan 업데이트
 *
 * Body:
 *   authKey      string  — 토스 인증 키
 *   customerKey  string  — 고객 키 (user_id 권장)
 *   plan         string  — 'basic' | 'pro'
 *   billing_type string  — 'monthly' | 'annual'
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServiceClient } from '@/lib/supabase-server'
import { confirmBillingAuth, TossPaymentsError } from '@/lib/toss-payments'
import { PLAN_PRICES } from '@/lib/platform-specs'
import { sendBillingSuccessEmail } from '@/lib/email'

const schema = z.object({
  authKey: z.string().min(1),
  customerKey: z.string().min(1),
  plan: z.enum(['basic', 'pro']),
  billing_type: z.enum(['monthly', 'annual']).default('monthly'),
})

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // customerKey는 반드시 본인 user_id여야 함
  if (body.customerKey !== authUser.id) {
    return NextResponse.json({ error: '잘못된 고객 키입니다.' }, { status: 403 })
  }

  // ── 빌링키 발급 ───────────────────────────────────────────────────────
  let billingKey: string
  try {
    const tossRes = await confirmBillingAuth(body.authKey, body.customerKey)
    billingKey = tossRes.billingKey
  } catch (err) {
    if (err instanceof TossPaymentsError) {
      return NextResponse.json(
        { error: `결제 오류: ${err.message} (${err.code})` },
        { status: 422 },
      )
    }
    return NextResponse.json({ error: '빌링키 발급 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // ── DB 저장 ────────────────────────────────────────────────────────────
  const supabase = createServiceClient()
  const amount =
    body.billing_type === 'annual'
      ? PLAN_PRICES[body.plan].annual
      : PLAN_PRICES[body.plan].monthly

  const nextBillingAt = new Date()
  nextBillingAt.setMonth(nextBillingAt.getMonth() + (body.billing_type === 'annual' ? 12 : 1))

  // 기존 활성 구독 취소
  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', authUser.id)
    .eq('status', 'active')

  // 새 구독 생성
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .insert({
      user_id: authUser.id,
      toss_billing_key: billingKey,
      plan: body.plan,
      status: 'active',
      amount,
      next_billing_at: nextBillingAt.toISOString(),
    })
    .select()
    .single()

  if (subError || !subscription) {
    return NextResponse.json(
      { error: '구독 정보 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }

  // 사용자 플랜 업데이트
  const { error: userError } = await supabase
    .from('users')
    .update({
      plan: body.plan,
      plan_expires_at: nextBillingAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', authUser.id)

  if (userError) {
    return NextResponse.json(
      { error: '플랜 업데이트 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }

  // 결제 성공 이메일 — fire-and-forget, 실패해도 응답에 영향 없음
  if (authUser.email) {
    const name =
      (profile as { name?: string } | null)?.name ??
      (authUser.user_metadata?.name as string | undefined) ??
      authUser.email.split('@')[0]
    sendBillingSuccessEmail(authUser.email, name, body.plan, amount).catch(() => {})
  }

  return NextResponse.json(
    {
      data: {
        subscription_id: subscription.id,
        plan: body.plan,
        amount,
        next_billing_at: nextBillingAt.toISOString(),
        message: `${body.plan.toUpperCase()} 플랜이 활성화되었습니다.`,
      },
    },
    { status: 201 },
  )
}
