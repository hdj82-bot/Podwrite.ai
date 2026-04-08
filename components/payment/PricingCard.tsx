'use client'

/**
 * PricingCard — 단일 플랜 가격 카드
 *
 * props:
 *   plan         'free' | 'basic' | 'pro'
 *   billingType  'monthly' | 'annual'
 *   currentPlan  현재 사용자 플랜
 *   onSelect     CTA 클릭 콜백
 *   loading      결제 처리 중 여부
 */

import { Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types'
import { PLAN_PRICES } from '@/lib/platform-specs'

interface Feature {
  text: string
  highlighted?: boolean
}

const PLAN_FEATURES: Record<Plan, Feature[]> = {
  free: [
    { text: '프로젝트 1개' },
    { text: '월 자료 검색 10회' },
    { text: '버전 스냅샷 챕터당 5개' },
    { text: '클라우드 저장소 50MB' },
    { text: 'DOCX/TXT/PDF 내보내기' },
    { text: 'AI 집필 보조' },
  ],
  basic: [
    { text: '프로젝트 3개' },
    { text: '월 자료 검색 30회' },
    { text: '버전 스냅샷 챕터당 20개' },
    { text: '클라우드 저장소 500MB' },
    { text: 'DOCX/TXT/PDF 내보내기' },
    { text: 'AI 집필 보조 + 교정' },
  ],
  pro: [
    { text: '프로젝트 무제한', highlighted: true },
    { text: '자료 검색 무제한', highlighted: true },
    { text: '버전 스냅샷 무제한' },
    { text: '클라우드 저장소 10GB' },
    { text: 'DOCX/TXT/PDF 내보내기' },
    { text: 'AI 집필 보조 + 교정' },
    { text: '셀링 페이지 생성', highlighted: true },
    { text: 'Amazon KDP 글로벌', highlighted: true },
    { text: '한→영 번역 + EPUB', highlighted: true },
  ],
}

const PLAN_META: Record<
  Plan,
  { label: string; badge?: string; badgeColor: string; ctaLabel: string; ctaColor: string }
> = {
  free: {
    label: '무료',
    badgeColor: 'bg-gray-100 text-gray-600',
    ctaLabel: '무료로 시작',
    ctaColor: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  },
  basic: {
    label: '베이직',
    badgeColor: 'bg-blue-100 text-blue-700',
    ctaLabel: '베이직 시작',
    ctaColor: 'bg-gray-900 text-white hover:bg-gray-700',
  },
  pro: {
    label: '프로',
    badge: '추천',
    badgeColor: 'bg-purple-100 text-purple-700',
    ctaLabel: 'Pro 시작',
    ctaColor: 'bg-purple-600 text-white hover:bg-purple-700',
  },
}

interface PricingCardProps {
  plan: Plan
  billingType: 'monthly' | 'annual'
  currentPlan: Plan
  onSelect: (plan: Plan) => void
  loading?: boolean
  highlighted?: boolean
  /** 외부에서 명시적으로 '현재 플랜'을 지정 (currentPlan 파생값을 덮어씀) */
  isCurrent?: boolean
}

export default function PricingCard({
  plan,
  billingType,
  currentPlan,
  onSelect,
  loading,
  highlighted,
  isCurrent,
}: PricingCardProps) {
  const meta = PLAN_META[plan]
  const features = PLAN_FEATURES[plan]
  // isCurrent prop이 명시된 경우 우선 사용, 그 외엔 currentPlan 비교로 파생
  const isCurrentPlan = isCurrent ?? plan === currentPlan
  const isPro = plan === 'pro'

  function getPrice(): string {
    if (plan === 'free') return '0'
    const prices = PLAN_PRICES[plan as 'basic' | 'pro']
    const monthly = billingType === 'annual' ? Math.round(prices.annual / 12) : prices.monthly
    return monthly.toLocaleString('ko-KR')
  }

  function getAnnualNote(): string | null {
    if (plan === 'free' || billingType !== 'annual') return null
    const prices = PLAN_PRICES[plan as 'basic' | 'pro']
    return `연 ₩${prices.annual.toLocaleString('ko-KR')} 청구`
  }

  function getCtaLabel(): string {
    if (isCurrentPlan) return '현재 사용 중'
    if (plan === 'free') return '무료로 시작'
    return meta.ctaLabel
  }

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-6 transition-shadow',
        highlighted
          ? 'border-purple-400 shadow-lg shadow-purple-100 ring-2 ring-purple-400'
          : isCurrentPlan
          ? 'border-blue-300 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
      )}
    >
      {/* 추천 배지 */}
      {meta.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white shadow">
          {meta.badge}
        </span>
      )}

      {/* 현재 플랜 배지 */}
      {isCurrentPlan && !meta.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white shadow">
          현재 플랜
        </span>
      )}

      {/* 플랜 이름 */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
            meta.badgeColor,
          )}
        >
          {meta.label}
        </span>
      </div>

      {/* 가격 */}
      <div className="mb-1">
        <div className="flex items-end gap-1">
          <span className="text-4xl font-bold text-gray-900">₩{getPrice()}</span>
          <span className="text-gray-400 pb-1 text-sm">/월</span>
        </div>
        {getAnnualNote() && (
          <p className="text-xs text-gray-400 mt-0.5">{getAnnualNote()}</p>
        )}
        {billingType === 'annual' && plan !== 'free' && (
          <p className="text-xs text-green-600 font-medium mt-0.5">연간 구독 시 2개월 무료</p>
        )}
      </div>

      {/* CTA 버튼 */}
      <button
        onClick={() => !isCurrentPlan && onSelect(plan)}
        disabled={isCurrentPlan || loading || plan === 'free'}
        className={cn(
          'mt-5 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5',
          isCurrentPlan || plan === 'free'
            ? 'cursor-default ' + meta.ctaColor
            : meta.ctaColor,
          (isCurrentPlan || loading) && 'opacity-60 cursor-not-allowed',
        )}
      >
        {loading && !isCurrentPlan ? (
          '처리 중...'
        ) : isPro && !isCurrentPlan ? (
          <>
            <Zap className="h-3.5 w-3.5" />
            {getCtaLabel()}
          </>
        ) : (
          getCtaLabel()
        )}
      </button>

      {/* 기능 목록 */}
      <ul className="mt-6 space-y-2.5">
        {features.map((feat) => (
          <li key={feat.text} className="flex items-start gap-2.5">
            <Check
              className={cn(
                'h-4 w-4 shrink-0 mt-0.5',
                feat.highlighted ? 'text-purple-500' : 'text-gray-400',
              )}
            />
            <span
              className={cn(
                'text-sm',
                feat.highlighted ? 'text-gray-900 font-medium' : 'text-gray-600',
              )}
            >
              {feat.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
