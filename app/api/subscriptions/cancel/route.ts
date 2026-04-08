/**
 * POST /api/subscriptions/cancel
 *
 * 구독 즉시 취소
 *
 * 처리:
 *   - subscriptions.status = 'cancelled', cancelled_at = now
 *   - users.plan_expires_at 유지 (기간 끝까지 Pro 유지)
 *   - plan 다운그레이드는 billing-cycle 크론에서 만료 후 처리
 *
 * 취소 후 동작:
 *   - 읽기·다운로드·내보내기 유지
 *   - 편집·챕터 추가·AI 기능 비활성화 (plan_expires_at 기준)
 */

import { NextResponse } from 'next/server'
import { getCurrentUserWithProfile, createServiceClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

export async function POST() {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  if (profile.plan === 'free') {
    return NextResponse.json(
      { error: '현재 무료 플랜입니다. 취소할 구독이 없습니다.' },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()

  // 활성 구독 조회
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('id, plan, next_billing_at, amount')
    .eq('user_id', authUser.id)
    .eq('status', 'active')
    .single()

  if (subError || !subscription) {
    return NextResponse.json(
      { error: '활성 구독을 찾을 수 없습니다.' },
      { status: 404 },
    )
  }

  const now = new Date().toISOString()

  // 구독 취소 처리 (기간 만료 전까지 플랜 유지)
  const { error: cancelError } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      updated_at: now,
    })
    .eq('id', subscription.id)

  if (cancelError) {
    return NextResponse.json(
      { error: '구독 취소 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }

  // plan_expires_at은 next_billing_at으로 유지 (기간 끝까지 혜택)
  // users.plan은 그대로 유지, plan_expires_at만 확인

  // 취소 확인 이메일
  await sendCancellationConfirmEmail(profile.email, profile.plan, subscription.next_billing_at)

  return NextResponse.json({
    data: {
      cancelled: true,
      plan_expires_at: subscription.next_billing_at,
      message: `구독이 취소되었습니다. ${subscription.next_billing_at ? new Date(subscription.next_billing_at).toLocaleDateString('ko-KR') + '까지 ' + profile.plan.toUpperCase() + ' 플랜을 사용하실 수 있습니다.' : ''}`,
    },
  })
}

async function sendCancellationConfirmEmail(
  email: string,
  plan: string,
  expiresAt: string | null,
): Promise<void> {
  const resendKey = process.env.SECRET_RESEND_API_KEY
  if (!resendKey) return

  const resend = new Resend(resendKey)
  const expiryText = expiresAt
    ? `${new Date(expiresAt).toLocaleDateString('ko-KR')}까지`
    : '현재 결제 주기 종료일까지'

  await resend.emails.send({
    from: 'Podwrite.ai <noreply@podwrite.ai>',
    to: email,
    subject: '[Podwrite.ai] 구독 취소가 접수되었습니다',
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>구독 취소 확인</h2>
  <p>${plan.toUpperCase()} 플랜 구독 취소가 접수되었습니다.</p>
  <p><strong>${expiryText}</strong> ${plan.toUpperCase()} 기능을 계속 사용하실 수 있습니다.</p>
  <ul>
    <li>원고 읽기·다운로드·내보내기: 계속 가능</li>
    <li>편집·AI 기능: 기간 만료 후 잠금</li>
    <li>재구독하면 즉시 복원됩니다</li>
  </ul>
  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'}/settings/billing"
     style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
    구독 관리
  </a>
</div>`,
  })
}
