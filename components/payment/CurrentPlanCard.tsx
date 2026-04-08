'use client'

/**
 * CurrentPlanCard — 현재 구독 상태 카드
 *
 * 표시 항목:
 *   - 플랜명, 상태 배지
 *   - 다음 결제일 / 만료일
 *   - 월 결제 금액
 *   - 취소된 경우: 기간 만료 경고
 */

import { Calendar, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn, planLabel, planColorClass, formatDate } from '@/lib/utils'
import type { Plan, Subscription } from '@/types'

interface CurrentPlanCardProps {
  plan: Plan
  subscription: Subscription | null
  onUpgradeClick: () => void
  onCancelClick: () => void
}

export default function CurrentPlanCard({
  plan,
  subscription,
  onUpgradeClick,
  onCancelClick,
}: CurrentPlanCardProps) {
  const isCancelled = subscription?.status === 'cancelled'
  const isActive = subscription?.status === 'active'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      {/* 플랜 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">현재 플랜</p>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">{planLabel(plan)}</h2>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                planColorClass(plan),
              )}
            >
              {plan === 'free' ? '무료' : isCancelled ? '취소됨' : '활성'}
            </span>
          </div>
        </div>

        {/* 업그레이드 버튼 */}
        {plan !== 'pro' && (
          <button
            onClick={onUpgradeClick}
            className="shrink-0 rounded-lg bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
          >
            업그레이드
          </button>
        )}
      </div>

      {/* 취소 경고 */}
      {isCancelled && subscription?.next_billing_at && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">구독이 취소되었습니다</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {formatDate(subscription.next_billing_at)}까지 {planLabel(plan)} 기능을 사용할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 메타 정보 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 다음 결제일 / 만료일 */}
        {subscription?.next_billing_at && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
            <span>
              {isCancelled ? '만료일: ' : '다음 결제일: '}
              <strong>{formatDate(subscription.next_billing_at)}</strong>
            </span>
          </div>
        )}

        {/* 결제 금액 */}
        {isActive && subscription?.amount != null && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CreditCard className="h-4 w-4 text-gray-400 shrink-0" />
            <span>
              월 결제: <strong>₩{subscription.amount.toLocaleString('ko-KR')}</strong>
            </span>
          </div>
        )}

        {/* 무료 플랜 */}
        {plan === 'free' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            <span>영원히 무료 · 신용카드 불필요</span>
          </div>
        )}
      </div>

      {/* 구독 취소 링크 */}
      {isActive && plan !== 'free' && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={onCancelClick}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
          >
            구독 취소하기
          </button>
        </div>
      )}
    </div>
  )
}
