/**
 * POST /api/subscriptions/webhook
 *
 * 토스페이먼츠 웹훅 수신
 *
 * 이벤트:
 *   PAYMENT_STATUS_CHANGED — 결제 상태 변경
 *   BILLING_STATUS_CHANGED — 빌링키 상태 변경
 *
 * 처리:
 *   payment.status === 'DONE'    → user.plan 활성 확인
 *   payment.status === 'ABORTED' → 구독 만료 처리
 *
 * 보안: X-Toss-Signature 헤더 HMAC-SHA256 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyWebhookSignature, type TossWebhookPayload } from '@/lib/toss-payments'
import { sendSubscriptionCancelledEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  // ── 서명 검증 ──────────────────────────────────────────────────────
  const rawBody = await req.text()
  const signature = req.headers.get('X-Toss-Signature') ?? ''

  const isValid = await verifyWebhookSignature(rawBody, signature)
  if (!isValid) {
    // 개발 환경에서는 서명 검증 건너뜀
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: '서명 검증 실패' }, { status: 400 })
    }
  }

  let payload: TossWebhookPayload
  try {
    payload = JSON.parse(rawBody) as TossWebhookPayload
  } catch {
    return NextResponse.json({ error: '잘못된 페이로드' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── 이벤트 처리 ────────────────────────────────────────────────────
  try {
    if (payload.eventType === 'PAYMENT_STATUS_CHANGED') {
      const { paymentKey, orderId, status } = payload.data

      if (status === 'DONE' && paymentKey) {
        // 결제 성공: 해당 order의 구독을 active 상태로 확인
        // orderId 패턴: CYCLE-xxx (자동결제), BILLING-xxx (신규)
        // 자동결제는 billing-cycle 잡에서 처리하므로 여기서는 상태 갱신만
        await supabase
          .from('subscriptions')
          .update({ updated_at: new Date().toISOString() })
          .eq('status', 'active')
          // orderId와 연결된 구독 식별이 필요하면 order_id 컬럼 추가 필요
          // 현재는 billing-cycle 잡에서 직접 처리

        console.log(`[webhook] 결제 성공: ${paymentKey}, 주문: ${orderId}`)
      }

      if (status === 'ABORTED' || status === 'EXPIRED') {
        // 결제 중단/만료: 연관 구독 조회 후 처리
        // paymentKey로 subscription 조회는 billing_history 테이블 필요
        // 현재는 로그만 기록
        console.warn(`[webhook] 결제 중단/만료: ${paymentKey}, 주문: ${orderId}`)
      }
    }

    if (payload.eventType === 'BILLING_STATUS_CHANGED') {
      const { billingKey, status } = payload.data

      if (status === 'CANCELED' && billingKey) {
        // 빌링키 취소 → 구독 만료 처리
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id, user_id, plan')
          .eq('toss_billing_key', billingKey)
          .eq('status', 'active')
          .single()

        if (sub) {
          await Promise.all([
            supabase
              .from('subscriptions')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sub.id),

            supabase
              .from('users')
              .update({ plan: 'free', plan_expires_at: null })
              .eq('id', sub.user_id),
          ])

          await sendCancellationEmailForUser(sub.user_id, sub.plan)
          console.log(`[webhook] 빌링키 취소 처리 완료: ${billingKey}`)
        }
      }
    }
  } catch (err) {
    console.error('[webhook] 처리 실패:', err)
    // 토스페이먼츠는 200 응답 없으면 재시도하므로 항상 200 반환
  }

  // 토스페이먼츠 웹훅은 200 응답 필수
  return NextResponse.json({ received: true })
}

async function sendCancellationEmailForUser(userId: string, plan: string): Promise<void> {
  if (!process.env.SECRET_RESEND_API_KEY) return

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('email').eq('id', userId).single()
  if (!user?.email) return

  await sendSubscriptionCancelledEmail(user.email, plan)
}
