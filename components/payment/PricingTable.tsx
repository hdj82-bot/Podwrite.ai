'use client'

/**
 * PricingTable — 요금제 비교표
 *
 * props:
 *   currentPlan  현재 사용자 플랜 (하이라이트용)
 *   onSelectPlan 플랜 선택 콜백
 */

import { useState } from 'react'
import { Check, X, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import type { Plan } from '@/types'
import { PLAN_PRICES } from '@/lib/platform-specs'

interface PricingTableProps {
  currentPlan: Plan
  onSelectPlan: (plan: 'basic' | 'pro', billingType: 'monthly' | 'annual') => void
  loading?: boolean
}

interface Feature {
  label: string
  free: string | boolean
  basic: string | boolean
  pro: string | boolean
}

const FEATURES: Feature[] = [
  { label: '프로젝트', free: '1개', basic: '3개', pro: '무제한' },
  { label: '월 자료 검색', free: '10회', basic: '30회', pro: '무제한' },
  { label: '버전 스냅샷', free: '챕터당 5개', basic: '챕터당 20개', pro: '무제한' },
  { label: '클라우드 저장소', free: '50MB', basic: '500MB', pro: '10GB' },
  { label: '원고 내보내기', free: true, basic: true, pro: true },
  { label: 'AI 집필 보조', free: true, basic: true, pro: true },
  { label: '맞춤법 교정', free: true, basic: true, pro: true },
  { label: '셀링 페이지 생성', free: false, basic: false, pro: true },
  { label: 'Amazon KDP 글로벌', free: false, basic: false, pro: true },
  { label: '한→영 번역', free: false, basic: false, pro: true },
  { label: 'EPUB 생성', free: false, basic: false, pro: true },
]

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-green-500" />
  if (value === false) return <X className="mx-auto h-5 w-5 text-gray-300" />
  return <span className="text-sm text-gray-700">{value}</span>
}

export default function PricingTable({ currentPlan, onSelectPlan, loading }: PricingTableProps) {
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly')

  function price(plan: 'basic' | 'pro'): string {
    const amount =
      billingType === 'annual' ? PLAN_PRICES[plan].annual / 12 : PLAN_PRICES[plan].monthly
    return amount.toLocaleString('ko-KR')
  }

  function totalPrice(plan: 'basic' | 'pro'): string {
    return (
      billingType === 'annual'
        ? PLAN_PRICES[plan].annual
        : PLAN_PRICES[plan].monthly
    ).toLocaleString('ko-KR')
  }

  return (
    <div className="w-full">
      {/* ROI 메시지 */}
      <p className="mb-6 text-center text-sm font-medium text-blue-700 bg-blue-50 rounded-lg py-3 px-4">
        책 한 권 판매 수익 &gt; 한 달 구독료. 팔리면 본전입니다.
      </p>

      {/* 월/연간 토글 */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <span
          className={clsx('text-sm', billingType === 'monthly' ? 'font-semibold text-gray-900' : 'text-gray-500')}
        >
          월간
        </span>
        <button
          onClick={() => setBillingType((t) => (t === 'monthly' ? 'annual' : 'monthly'))}
          className={clsx(
            'relative h-6 w-11 rounded-full transition-colors',
            billingType === 'annual' ? 'bg-blue-600' : 'bg-gray-300',
          )}
          aria-label="연간/월간 전환"
        >
          <span
            className={clsx(
              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              billingType === 'annual' && 'translate-x-5',
            )}
          />
        </button>
        <span
          className={clsx('text-sm', billingType === 'annual' ? 'font-semibold text-gray-900' : 'text-gray-500')}
        >
          연간
          <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">
            2개월 무료
          </span>
        </span>
      </div>

      {/* 플랜 카드 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-10">
        {/* Free */}
        <div className={clsx('rounded-2xl border p-6', currentPlan === 'free' && 'border-blue-400 ring-2 ring-blue-400')}>
          <h3 className="text-lg font-semibold text-gray-900">Free</h3>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            ₩0<span className="text-base font-normal text-gray-500">/월</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">영원히 무료</p>
          <button
            disabled
            className="mt-6 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-400 cursor-not-allowed"
          >
            {currentPlan === 'free' ? '현재 플랜' : '무료로 시작'}
          </button>
        </div>

        {/* Basic */}
        <div
          className={clsx(
            'rounded-2xl border p-6',
            currentPlan === 'basic' && 'border-blue-400 ring-2 ring-blue-400',
          )}
        >
          <h3 className="text-lg font-semibold text-gray-900">Basic</h3>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            ₩{price('basic')}
            <span className="text-base font-normal text-gray-500">/월</span>
          </p>
          {billingType === 'annual' && (
            <p className="mt-1 text-xs text-gray-400">연 ₩{totalPrice('basic')} 일괄 청구</p>
          )}
          <button
            onClick={() => onSelectPlan('basic', billingType)}
            disabled={loading || currentPlan === 'basic'}
            className={clsx(
              'mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition-colors',
              currentPlan === 'basic'
                ? 'border border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-gray-700',
            )}
          >
            {currentPlan === 'basic' ? '현재 플랜' : loading ? '처리 중...' : 'Basic 시작하기'}
          </button>
        </div>

        {/* Pro */}
        <div
          className={clsx(
            'rounded-2xl border-2 p-6 relative',
            currentPlan === 'pro' ? 'border-blue-400 ring-2 ring-blue-400' : 'border-blue-600',
          )}
        >
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            추천
          </span>
          <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            ₩{price('pro')}
            <span className="text-base font-normal text-gray-500">/월</span>
          </p>
          {billingType === 'annual' && (
            <p className="mt-1 text-xs text-gray-400">연 ₩{totalPrice('pro')} 일괄 청구</p>
          )}
          <button
            onClick={() => onSelectPlan('pro', billingType)}
            disabled={loading || currentPlan === 'pro'}
            className={clsx(
              'mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition-colors',
              currentPlan === 'pro'
                ? 'border border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700',
            )}
          >
            {currentPlan === 'pro' ? '현재 플랜' : loading ? '처리 중...' : (
              <span className="flex items-center justify-center gap-1.5">
                <Zap className="h-4 w-4" /> Pro 시작하기
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 기능 비교표 */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-center text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="py-3 px-4 text-left font-semibold text-gray-700">기능</th>
              <th className="py-3 px-4 font-semibold text-gray-700">Free</th>
              <th className="py-3 px-4 font-semibold text-gray-700">Basic</th>
              <th className="py-3 px-4 font-semibold text-blue-700">Pro</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feat, i) => (
              <tr key={feat.label} className={clsx('border-b last:border-0', i % 2 === 0 && 'bg-white', i % 2 !== 0 && 'bg-gray-50/50')}>
                <td className="py-3 px-4 text-left text-gray-700">{feat.label}</td>
                <td className="py-3 px-4">
                  <FeatureCell value={feat.free} />
                </td>
                <td className="py-3 px-4">
                  <FeatureCell value={feat.basic} />
                </td>
                <td className="py-3 px-4">
                  <FeatureCell value={feat.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 저작권 안내 */}
      <p className="mt-6 text-center text-xs text-gray-500">
        원고 저작권은 작가님께 있습니다. AI 학습에 사용하지 않습니다. 언제든 꺼내가실 수 있습니다.
      </p>
    </div>
  )
}
