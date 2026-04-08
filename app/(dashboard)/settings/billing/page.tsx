/**
 * /settings/billing — 구독 관리 페이지 (대시보드 전용)
 *
 * 섹션:
 *   1. CurrentPlanCard — 현재 플랜, 다음 결제일, 금액
 *   2. 플랜 업그레이드 (PricingCard × 2 or BillingForm)
 *   3. BillingHistory — 결제 내역 테이블
 *   4. CancelConfirmModal — 취소 확인 모달
 */

'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import CurrentPlanCard from '@/components/payment/CurrentPlanCard'
import BillingHistory from '@/components/payment/BillingHistory'
import CancelConfirmModal from '@/components/payment/CancelConfirmModal'
import PricingCard from '@/components/payment/PricingCard'
import BillingForm from '@/components/payment/BillingForm'
import TossScript from '@/components/payment/TossScript'
import type { Plan, Subscription } from '@/types'

type PageState = 'overview' | 'upgrade' | 'billing-form'
type BillingType = 'monthly' | 'annual'

interface UserProfile {
  id: string
  email: string
  plan: Plan
  plan_expires_at: string | null
}

export default function BillingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  const [pageState, setPageState] = useState<PageState>('overview')
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro'>('pro')
  const [billingType, setBillingType] = useState<BillingType>('monthly')
  const [showCancelModal, setShowCancelModal] = useState(false)

  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Toss 리다이렉트 파라미터 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    const success = params.get('success')
    if (err === 'billing_failed') setErrorMsg('결제 등록에 실패했습니다. 다시 시도해주세요.')
    if (success === 'billing_complete') setSuccessMsg('구독이 성공적으로 활성화되었습니다!')
    if (err || success) window.history.replaceState({}, '', '/settings/billing')
  }, [])

  // 사용자 + 구독 정보 로드
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase
        .from('users')
        .select('id, email, plan, plan_expires_at')
        .eq('id', user.id)
        .single()

      if (p) setProfile(p as UserProfile)

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (sub) setSubscription(sub as unknown as Subscription)
      setLoading(false)
    }
    load()
  }, [])

  function handleSelectPlan(plan: Plan) {
    if (plan === 'free') return
    setSelectedPlan(plan as 'basic' | 'pro')
    setPageState('billing-form')
  }

  function handleUpgradeSuccess(plan: Plan) {
    setProfile((prev) => (prev ? { ...prev, plan } : null))
    setSubscription(null) // 새로 로드되도록
    setSuccessMsg(`${plan.toUpperCase()} 플랜이 활성화되었습니다!`)
    setPageState('overview')
    window.location.reload()
  }

  async function handleCancelConfirm() {
    const res = await fetch('/api/subscriptions/cancel', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '취소 실패')

    setSubscription((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
    setSuccessMsg(json.data.message)
    setShowCancelModal(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">로그인이 필요합니다.</p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      {/* 토스페이먼츠 v2 SDK — lazyOnload */}
      <TossScript />
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">구독 및 결제</h1>
          <p className="text-sm text-gray-500 mt-1">플랜을 관리하고 결제 내역을 확인하세요.</p>
        </div>

        {/* 알림 메시지 */}
        {successMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{errorMsg}</p>
          </div>
        )}

        {/* 결제 폼 뷰 */}
        {pageState === 'billing-form' ? (
          <div>
            <button
              onClick={() => setPageState('upgrade')}
              className="mb-6 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              ← 요금제 선택으로
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">결제 등록</h2>
            <BillingForm
              userId={profile.id}
              targetPlan={selectedPlan}
              billingType={billingType}
              currentPlan={profile.plan}
              onSuccess={handleUpgradeSuccess}
              onCancel={() => setPageState('upgrade')}
            />
          </div>
        ) : pageState === 'upgrade' ? (
          /* 요금제 선택 뷰 */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPageState('overview')}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                ← 돌아가기
              </button>
              {/* 월/연간 토글 */}
              <div className="flex items-center gap-3 text-sm">
                <span className={billingType === 'monthly' ? 'font-medium text-gray-900' : 'text-gray-400'}>
                  월간
                </span>
                <button
                  onClick={() => setBillingType((t) => (t === 'monthly' ? 'annual' : 'monthly'))}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    billingType === 'annual' ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      billingType === 'annual' ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
                <span className={billingType === 'annual' ? 'font-medium text-gray-900' : 'text-gray-400'}>
                  연간
                  <span className="ml-1 text-xs text-green-600 font-semibold">2개월 무료</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {(['basic', 'pro'] as const).map((p) => (
                <PricingCard
                  key={p}
                  plan={p}
                  billingType={billingType}
                  currentPlan={profile.plan}
                  onSelect={handleSelectPlan}
                  highlighted={p === 'pro'}
                />
              ))}
            </div>
          </div>
        ) : (
          /* 개요 뷰 */
          <div className="space-y-6">
            {/* 현재 플랜 카드 */}
            <CurrentPlanCard
              plan={profile.plan}
              subscription={subscription}
              onUpgradeClick={() => setPageState('upgrade')}
              onCancelClick={() => setShowCancelModal(true)}
            />

            {/* 결제 내역 */}
            <BillingHistory userId={profile.id} />

            {/* 저작권 안내 */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-5 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700 mb-2">원고 보호 정책</p>
              <p>• 원고 저작권은 100% 작가님께 있습니다. AI 학습에 사용하지 않습니다.</p>
              <p>• 구독 취소 후에도 읽기·다운로드는 30일간 유지됩니다.</p>
              <p>• 서비스 종료 시 30일 전 사전 통보 및 원고 내보내기 기간을 보장합니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* 취소 확인 모달 */}
      {showCancelModal && subscription && (
        <CancelConfirmModal
          plan={profile.plan}
          subscription={subscription}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  )
}
