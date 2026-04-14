/**
 * Inngest 크론 잡: 월 정기결제 + 취소 구독 만료
 *
 * 스케줄: 매일 KST 자정 (UTC 15:00) 실행
 *
 * [정기결제 플로우]
 *   대상: status='active' && next_billing_at <= now
 *   성공: next_billing_at += 1개월, retry_count=0, billing_history 기록, 성공 이메일
 *   실패: retry_count++, next_billing_at = 다음날 UTC 15:00 재시도 예약
 *         retry_count >= 3 → status='expired', users.plan='free', 실패 이메일
 *
 * [취소 구독 만료 플로우]
 *   대상: status='cancelled' && next_billing_at <= now
 *   처리: status='expired', users.plan='free', plan_expires_at=null
 *
 * ⚠️  DB 마이그레이션 필요 (supabase/migrations/005_billing_schema.sql 참조):
 *   ALTER TABLE subscriptions
 *     ADD COLUMN IF NOT EXISTS retry_count        integer     NOT NULL DEFAULT 0,
 *     ADD COLUMN IF NOT EXISTS billing_failed_at  timestamptz;
 */

import { inngest } from './client'
import { createServiceClient } from '@/lib/supabase-server'
import { chargeBilling, generateOrderId, TossPaymentsError } from '@/lib/toss-payments'
import { sendBillingSuccessEmail, sendBillingFailedEmail } from '@/lib/email'

const PLAN_AMOUNTS: Record<string, number> = {
  basic: 9_900,
  pro:  19_900,
}

const MAX_RETRY_COUNT = 3 // D+0 실패 → D+1, D+2, D+3 재시도 후 최종 만료

export const billingCycleJob = inngest.createFunction(
  {
    id: 'billing-cycle',
    name: '월 정기결제 크론',
    concurrency: { limit: 1 },
    retries: 0, // 재시도는 next_billing_at + retry_count 기반으로 직접 관리
  },
  { cron: '0 15 * * *' }, // KST 자정 = UTC 15:00
  async ({ step }) => {
    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // ── Step 1. 취소 구독 만료 처리 ─────────────────────────────────────
    // status='cancelled' && next_billing_at <= now → 플랜 만료, plan='free'
    const expiredCancelledIds = await step.run('expire-cancelled-subscriptions', async () => {
      const { data: expiring, error } = await supabase
        .from('subscriptions')
        .select('id, user_id')
        .eq('status', 'cancelled')
        .lte('next_billing_at', now)

      if (error || !expiring || expiring.length === 0) return []

      const ids     = expiring.map((s) => s.id)
      const userIds = expiring.map((s) => s.user_id)

      await Promise.all([
        supabase
          .from('subscriptions')
          .update({ status: 'expired', updated_at: now })
          .in('id', ids),
        supabase
          .from('users')
          .update({ plan: 'free', plan_expires_at: null, updated_at: now })
          .in('id', userIds),
      ])

      console.log(`[billing-cycle] 취소 구독 만료 처리: ${ids.length}건`)
      return ids
    })

    // ── Step 2. 정기결제 대상 조회 ──────────────────────────────────────
    const dueSubscriptions = await step.run('fetch-due-subscriptions', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, user_id, toss_billing_key, plan, amount, next_billing_at, retry_count, billing_failed_at')
        .eq('status', 'active')
        .lte('next_billing_at', now)

      if (error) throw new Error(`구독 조회 실패: ${error.message}`)
      return data ?? []
    })

    if (dueSubscriptions.length === 0) {
      return {
        success: true,
        processed: 0,
        expiredCancelled: expiredCancelledIds.length,
        message: '결제 대상 없음',
      }
    }

    const results = { success: 0, failed: 0, expired: 0 }

    // ── Step 3. 구독별 결제 처리 ────────────────────────────────────────
    for (const sub of dueSubscriptions) {
      await step.run(`charge-subscription-${sub.id}`, async () => {
        const amount     = PLAN_AMOUNTS[sub.plan] ?? sub.amount
        const orderId    = generateOrderId('CYCLE')
        // retry_count: DB 컬럼이 없을 경우 0으로 폴백
        const retryCount = (sub.retry_count as number | null) ?? 0

        // billing_history pending 기록 (결제 시도 추적)
        const { data: historyRow } = await supabase
          .from('billing_history')
          .insert({
            subscription_id: sub.id,
            user_id:         sub.user_id,
            order_id:        orderId,
            amount,
            plan:            sub.plan,
            status:          'pending',
            billed_at:       now,
          })
          .select('id')
          .single()

        try {
          const payment = await chargeBilling({
            billingKey:  sub.toss_billing_key,
            customerKey: sub.user_id,
            amount,
            orderId,
            orderName:   `Podwrite.ai ${sub.plan} 플랜 월정기결제`,
          })

          if (payment.status !== 'DONE') {
            throw new Error(`예상치 못한 결제 상태: ${payment.status}`)
          }

          // ── 결제 성공 ─────────────────────────────────────────────────
          const nextBilling = new Date(sub.next_billing_at ?? now)
          nextBilling.setMonth(nextBilling.getMonth() + 1)

          await Promise.all([
            supabase
              .from('subscriptions')
              .update({
                next_billing_at:   nextBilling.toISOString(),
                retry_count:       0,
                billing_failed_at: null,
                updated_at:        now,
              })
              .eq('id', sub.id),

            supabase
              .from('users')
              .update({ plan: sub.plan, plan_expires_at: null, updated_at: now })
              .eq('id', sub.user_id),

            historyRow
              ? supabase
                  .from('billing_history')
                  .update({
                    status:      'confirmed',
                    payment_key: payment.paymentKey,
                    updated_at:  now,
                  })
                  .eq('id', historyRow.id)
              : Promise.resolve(),
          ])

          await sendBillingSuccessEmailForUser(sub.user_id, sub.plan, amount)
          results.success++

        } catch (err) {
          // ── 결제 실패 ─────────────────────────────────────────────────
          const msg          = err instanceof TossPaymentsError ? err.message : String(err)
          const newRetryCount = retryCount + 1

          if (historyRow) {
            await supabase
              .from('billing_history')
              .update({ status: 'failed', updated_at: now })
              .eq('id', historyRow.id)
          }

          if (newRetryCount >= MAX_RETRY_COUNT) {
            // ── 최종 실패 → 구독 만료, plan='free' ──────────────────────
            await Promise.all([
              supabase
                .from('subscriptions')
                .update({ status: 'expired', retry_count: newRetryCount, updated_at: now })
                .eq('id', sub.id),
              supabase
                .from('users')
                .update({ plan: 'free', plan_expires_at: null, updated_at: now })
                .eq('id', sub.user_id),
            ])
            await sendBillingFailedEmailForUser(sub.user_id)
            results.expired++
            console.error(`[billing-cycle] 구독 ${sub.id} 최종 실패 (${newRetryCount}회): ${msg}`)

          } else {
            // ── D+1 재시도 예약 (retry_count 기반이므로 날짜 이동 안전) ──
            const retryAt = new Date()
            retryAt.setUTCDate(retryAt.getUTCDate() + 1)
            retryAt.setUTCHours(15, 0, 0, 0) // KST 자정 = UTC 15:00

            await supabase
              .from('subscriptions')
              .update({
                next_billing_at:   retryAt.toISOString(),
                retry_count:       newRetryCount,
                billing_failed_at: (sub.billing_failed_at as string | null) ?? now,
                updated_at:        now,
              })
              .eq('id', sub.id)

            results.failed++
            console.warn(
              `[billing-cycle] 구독 ${sub.id} 실패 (${newRetryCount}/${MAX_RETRY_COUNT}), 내일 재시도: ${msg}`,
            )
          }
        }
      })
    }

    return {
      success:          true,
      total:            dueSubscriptions.length,
      expiredCancelled: expiredCancelledIds.length,
      ...results,
    }
  },
)

// ── 이메일 헬퍼 ────────────────────────────────────────────────────────────────

async function sendBillingSuccessEmailForUser(
  userId: string,
  plan: string,
  amount: number,
): Promise<void> {
  if (!process.env.SECRET_RESEND_API_KEY) return
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('email, display_name')
    .eq('id', userId)
    .single()
  if (!user?.email) return
  await sendBillingSuccessEmail(
    user.email,
    (user as { email: string; display_name: string | null }).display_name
      ?? user.email.split('@')[0],
    plan,
    amount,
  ).catch((e) => console.error('[billing-cycle] 성공 이메일 실패:', e))
}

async function sendBillingFailedEmailForUser(userId: string): Promise<void> {
  if (!process.env.SECRET_RESEND_API_KEY) return
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('email, display_name')
    .eq('id', userId)
    .single()
  if (!user?.email) return
  await sendBillingFailedEmail(
    user.email,
    (user as { email: string; display_name: string | null }).display_name
      ?? user.email.split('@')[0],
  ).catch((e) => console.error('[billing-cycle] 실패 이메일 실패:', e))
}
