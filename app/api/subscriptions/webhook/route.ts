/**
 * POST /api/subscriptions/webhook
 *
 * 토스페이먼츠 웹훅 수신
 * 문서: https://docs.tosspayments.com/reference/webhook
 *
 * 이벤트:
 *   PAYMENT_STATUS_CHANGED
 *     DONE    → billing_history 확인 및 구독·유저 상태 이중 검증
 *     ABORTED → billing_history 실패 기록 (재시도는 billing-cycle 크론이 담당)
 *     EXPIRED → billing_history 실패 기록
 *
 *   BILLING_STATUS_CHANGED
 *     CANCELED → subscriptions.status='cancelled', cancelled_at=now
 *               users.plan_expires_at=next_billing_at (기간 끝까지 플랜 유지)
 *               ※ users.plan 즉시 강등 금지 — billing-cycle이 만료 시점에 처리
 *
 * 보안: X-Toss-Signature 헤더 HMAC-SHA256 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyWebhookSignature, type TossWebhookPayload } from '@/lib/toss-payments'
import { sendSubscriptionCancelledEmail } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // ── 서명 검증 ──────────────────────────────────────────────────────
  const rawBody = await req.text()
  const signature = req.headers.get('X-Toss-Signature') ?? ''

  const isValid = await verifyWebhookSignature(rawBody, signature)
  if (!isValid && process.env.NODE_ENV === 'production') {
    console.warn('[webhook] 서명 검증 실패')
    return NextResponse.json({ error: '서명 검증 실패' }, { status: 401 })
  }

  let payload: TossWebhookPayload
  try {
    payload = JSON.parse(rawBody) as TossWebhookPayload
  } catch {
    return NextResponse.json({ error: '잘못된 페이로드' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    // ──────────────────────────────────────────────────────────────────
    // PAYMENT_STATUS_CHANGED
    // ──────────────────────────────────────────────────────────────────
    if (payload.eventType === 'PAYMENT_STATUS_CHANGED') {
      const { paymentKey, orderId, status } = payload.data

      if (status === 'DONE' && orderId) {
        // billing-cycle이 이미 DB를 갱신했을 수 있으므로 idempotent하게 처리
        const { data: historyRow } = await supabase
          .from('billing_history')
          .select('id, subscription_id, status')
          .eq('order_id', orderId)
          .maybeSingle()

        if (historyRow && historyRow.status !== 'confirmed') {
          // 웹훅이 billing-cycle보다 먼저 도착한 경우 → 상태 확정
          await supabase
            .from('billing_history')
            .update({
              status: 'confirmed',
              payment_key: paymentKey,
              updated_at: new Date().toISOString(),
            })
            .eq('id', historyRow.id)

          // 구독·유저 상태 이중 검증 (billing-cycle이 실패했을 경우 대비)
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('id, user_id, plan')
            .eq('id', historyRow.subscription_id)
            .single()

          if (sub) {
            await supabase
              .from('users')
              .update({ plan: sub.plan, plan_expires_at: null })
              .eq('id', sub.user_id)
          }
        }

        console.log(`[webhook] DONE 확인: orderId=${orderId}`)
      }

      if ((status === 'ABORTED' || status === 'EXPIRED') && orderId) {
        // billing_history 실패 기록 — 재시도는 billing-cycle 크론이 retry_count 기반으로 처리
        await supabase
          .from('billing_history')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('order_id', orderId)

        console.warn(`[webhook] 결제 실패 수신: status=${status}, orderId=${orderId}`)
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // BILLING_STATUS_CHANGED
    // ──────────────────────────────────────────────────────────────────
    if (payload.eventType === 'BILLING_STATUS_CHANGED') {
      const { billingKey, status } = payload.data

      if (status === 'CANCELED' && billingKey) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id, user_id, plan, next_billing_at, status')
          .eq('toss_billing_key', billingKey)
          .in('status', ['active', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!sub) {
          console.warn(`[webhook] billingKey=${billingKey} 구독 없음`)
          return NextResponse.json({ received: true })
        }

        const now = new Date().toISOString()

        // cancel API에서 이미 처리되지 않은 경우에만 취소 처리
        if (sub.status !== 'cancelled') {
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
            .eq('id', sub.id)
        }

        // ❌ users.plan 즉시 강등 금지
        // ✅ plan_expires_at = next_billing_at → 기간 끝까지 플랜 유지
        //    billing-cycle 크론이 next_billing_at 도래 시 plan='free'로 강등
        if (sub.next_billing_at) {
          await supabase
            .from('users')
            .update({ plan_expires_at: sub.next_billing_at })
            .eq('id', sub.user_id)
        }

        await sendCancellationEmail(sub.user_id, sub.plan)
        console.log(`[webhook] BILLING_STATUS_CHANGED/CANCELED 처리 완료: billingKey=${billingKey}`)
      }
    }
  } catch (err) {
    console.error('[webhook] 처리 오류:', err)
    // 토스페이먼츠는 200 없으면 재전송 → 항상 200 반환
  }

  return NextResponse.json({ received: true })
}

async function sendCancellationEmail(userId: string, plan: string): Promise<void> {
  if (!process.env.SECRET_RESEND_API_KEY) return
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()
  if (!user?.email) return
  await sendSubscriptionCancelledEmail(user.email, plan).catch((e) =>
    console.error('[webhook] 취소 이메일 발송 실패:', e),
  )
}
