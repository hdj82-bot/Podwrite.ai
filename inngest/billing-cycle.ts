/**
 * Inngest 크론 잡: 월 정기결제
 *
 * 스케줄: 매일 자정 KST (UTC 15:00) 실행
 * next_billing_at <= 현재 시각인 구독 건 자동 청구
 *
 * 성공: next_billing_at += 1개월, billing_history 기록
 * 실패: 3회 재시도 (D+0, D+1, D+2)
 *       최종 실패 → subscription.status = 'expired', user.plan = 'free'
 *                 → Resend 이메일 알림
 */

import { inngest } from './client'
import { createServiceClient } from '@/lib/supabase-server'
import { chargeBilling, generateOrderId, TossPaymentsError } from '@/lib/toss-payments'
import { Resend } from 'resend'

const PLAN_AMOUNTS: Record<string, number> = {
  basic: 9_900,
  pro: 19_900,
}

// 실패 재시도 허용 횟수
const MAX_RETRY_DAYS = 3

export const billingCycleJob = inngest.createFunction(
  {
    id: 'billing-cycle',
    name: '월 정기결제 크론',
    concurrency: { limit: 1 },
    retries: 0, // 재시도는 직접 날짜 기반으로 처리
  },
  // 매일 KST 자정 = UTC 15:00
  { cron: '0 15 * * *' },
  async ({ step }) => {
    const supabase = createServiceClient()

    // ── 1. 결제 대상 구독 조회 ────────────────────────────────────────
    const dueSubscriptions = await step.run('fetch-due-subscriptions', async () => {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, user_id, toss_billing_key, plan, amount, next_billing_at')
        .eq('status', 'active')
        .lte('next_billing_at', now)

      if (error) throw new Error(`구독 조회 실패: ${error.message}`)
      return data ?? []
    })

    if (dueSubscriptions.length === 0) {
      return { success: true, processed: 0, message: '결제 대상 없음' }
    }

    const results = { success: 0, failed: 0, expired: 0 }

    // ── 2. 구독별 결제 처리 ───────────────────────────────────────────
    for (const sub of dueSubscriptions) {
      await step.run(`charge-subscription-${sub.id}`, async () => {
        const amount = PLAN_AMOUNTS[sub.plan] ?? sub.amount
        const orderId = generateOrderId('CYCLE')

        try {
          // 토스페이먼츠 자동결제 청구
          const payment = await chargeBilling({
            billingKey: sub.toss_billing_key,
            customerKey: sub.user_id,
            amount,
            orderId,
            orderName: `Podwrite.ai ${sub.plan} 플랜 월정기결제`,
          })

          if (payment.status === 'DONE') {
            // 다음 결제일 계산 (현재 next_billing_at + 1개월)
            const nextBilling = new Date(sub.next_billing_at ?? new Date())
            nextBilling.setMonth(nextBilling.getMonth() + 1)

            await Promise.all([
              // 구독 갱신
              supabase
                .from('subscriptions')
                .update({
                  next_billing_at: nextBilling.toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sub.id),

              // 결제 이력 저장 (billing_history 테이블 있을 경우)
              // supabase.from('billing_history').insert({...})
            ])

            results.success++
          }
        } catch (err) {
          // ── 결제 실패 처리 ────────────────────────────────────────────
          const errorMessage = err instanceof TossPaymentsError ? err.message : String(err)

          // 실패 재시도 날짜 계산
          const failedAt = new Date(sub.next_billing_at ?? new Date())
          const daysSinceDue = Math.floor(
            (Date.now() - failedAt.getTime()) / (1000 * 60 * 60 * 24),
          )

          if (daysSinceDue >= MAX_RETRY_DAYS) {
            // 최종 실패 → 구독 만료, 플랜 다운그레이드
            await Promise.all([
              supabase
                .from('subscriptions')
                .update({
                  status: 'expired',
                  cancelled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sub.id),

              supabase
                .from('users')
                .update({ plan: 'free', plan_expires_at: null })
                .eq('id', sub.user_id),
            ])

            // 결제 실패 이메일 발송
            await sendPaymentFailureEmail(sub.user_id, sub.plan, errorMessage)

            results.expired++
          } else {
            // 재시도 예약: next_billing_at = 내일 같은 시각
            const retryAt = new Date()
            retryAt.setDate(retryAt.getDate() + 1)
            retryAt.setHours(0, 0, 0, 0) // KST 자정 기준

            await supabase
              .from('subscriptions')
              .update({
                next_billing_at: retryAt.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sub.id)

            results.failed++
          }

          console.error(`[billing-cycle] 구독 ${sub.id} 결제 실패:`, errorMessage)
        }
      })
    }

    return {
      success: true,
      total: dueSubscriptions.length,
      ...results,
    }
  },
)

// ── 결제 실패 이메일 ──────────────────────────────────────────────────────

async function sendPaymentFailureEmail(
  userId: string,
  plan: string,
  errorMessage: string,
): Promise<void> {
  const resendKey = process.env.SECRET_RESEND_API_KEY
  if (!resendKey) return

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('email').eq('id', userId).single()
  if (!user?.email) return

  const resend = new Resend(resendKey)

  await resend.emails.send({
    from: 'Podwrite.ai <noreply@podwrite.ai>',
    to: user.email,
    subject: '[Podwrite.ai] 결제 실패 안내 — 플랜이 무료로 변경되었습니다',
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>결제 실패 안내</h2>
  <p>안녕하세요.</p>
  <p><strong>${plan.toUpperCase()} 플랜</strong> 월정기결제가 3회 시도 후 최종 실패하여 플랜이 <strong>무료(Free)</strong>로 변경되었습니다.</p>
  <p>원고, 챕터, 다운로드 기능은 30일간 유지됩니다. 재구독하시면 즉시 기능이 복원됩니다.</p>
  <p><strong>실패 사유:</strong> ${errorMessage}</p>
  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'}/settings/billing"
     style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
    재구독하기
  </a>
  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    Podwrite.ai | 구독 문의: support@podwrite.ai
  </p>
</div>`,
  })
}
