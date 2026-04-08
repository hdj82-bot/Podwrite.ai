'use client'

/**
 * BillingForm — 토스페이먼츠 v2 빌링키 발급 폼
 *
 * 흐름:
 *   1. "카드 등록하기" 클릭 → Toss v2 SDK (TossScript로 미리 로드됨)
 *   2. billing({ customerKey }).requestBillingAuth() → 토스 결제창 (팝업)
 *   3. 성공 시 /settings/billing/success?authKey=...&customerKey=... 로 리다이렉트
 *   4. 취소 시 /settings/billing/cancel 로 리다이렉트
 *
 * 토스 클라이언트 키: NEXT_PUBLIC_TOSS_CLIENT_KEY
 * TossScript 컴포넌트가 부모 페이지에 마운트되어 있어야 합니다.
 */

import { useEffect, useState } from 'react'
import { CreditCard, Lock, AlertCircle } from 'lucide-react'
import type { Plan } from '@/types'
import { PLAN_PRICES } from '@/lib/platform-specs'

interface BillingFormProps {
  userId: string
  targetPlan: 'basic' | 'pro'
  billingType: 'monthly' | 'annual'
  currentPlan: Plan
  onSuccess: (plan: Plan) => void
  onCancel: () => void
}

export default function BillingForm({
  userId,
  targetPlan,
  billingType,
  currentPlan,
  onSuccess,
  onCancel,
}: BillingFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY

  const amount =
    billingType === 'annual'
      ? PLAN_PRICES[targetPlan].annual
      : PLAN_PRICES[targetPlan].monthly

  // ── Toss v2 SDK 준비 확인 ────────────────────────────────────────────
  useEffect(() => {
    if (!clientKey) {
      setError('토스페이먼츠 클라이언트 키가 설정되지 않았습니다.')
      return
    }

    // TossScript(lazyOnload)가 로드되면 window.TossPayments 세팅됨
    if (window.TossPayments) {
      setSdkReady(true)
      return
    }

    // SDK가 아직 로드 중이면 toss-payments-sdk-v2 스크립트의 onload 이벤트 대기
    const scriptEl = document.getElementById('toss-payments-sdk-v2')
    if (!scriptEl) {
      setError('결제 모듈을 찾을 수 없습니다. 페이지를 새로고침해주세요.')
      return
    }
    const onLoad = () => setSdkReady(true)
    const onError = () => setError('결제 모듈 로드에 실패했습니다. 새로고침 후 다시 시도해주세요.')
    scriptEl.addEventListener('load', onLoad)
    scriptEl.addEventListener('error', onError)
    return () => {
      scriptEl.removeEventListener('load', onLoad)
      scriptEl.removeEventListener('error', onError)
    }
  }, [clientKey])

  // ── 빌링키 요청 ──────────────────────────────────────────────────────
  async function handlePayment() {
    if (!sdkReady || !window.TossPayments || !clientKey) {
      setError('결제 모듈이 준비되지 않았습니다.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
      const toss = window.TossPayments(clientKey)
      const billing = toss.billing({ customerKey: userId })

      await billing.requestBillingAuth({
        method: '카드',
        successUrl: `${appUrl}/settings/billing/success?plan=${targetPlan}&type=${billingType}`,
        failUrl: `${appUrl}/settings/billing/cancel`,
      })
      // requestBillingAuth는 페이지를 리다이렉트하므로 이 이후 코드는 실행되지 않음
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'USER_CANCEL'
      ) {
        setLoading(false)
        return
      }
      setError('결제 창을 여는 중 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  const planLabel = targetPlan === 'pro' ? 'Pro' : 'Basic'
  const billingLabel = billingType === 'annual' ? '연간' : '월간'

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 플랜 요약 */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-900">{planLabel} 플랜</span>
          <span className="text-sm text-gray-500">{billingLabel}</span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-gray-900">
            ₩{amount.toLocaleString('ko-KR')}
          </span>
          <span className="text-gray-500 mb-0.5">/{billingType === 'annual' ? '년' : '월'}</span>
        </div>
        {billingType === 'annual' && (
          <p className="mt-1 text-xs text-green-600 font-medium">
            월 ₩{(amount / 12).toLocaleString('ko-KR')} — 2개월 무료
          </p>
        )}
        {currentPlan !== 'free' && (
          <p className="mt-2 text-xs text-gray-500">
            기존 구독({currentPlan.toUpperCase()})은 자동으로 해지됩니다.
          </p>
        )}
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 보안 안내 */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <Lock className="h-3.5 w-3.5" />
        <span>결제 정보는 토스페이먼츠가 안전하게 처리합니다. Podwrite.ai에 저장되지 않습니다.</span>
      </div>

      {/* 결제 버튼 */}
      <button
        onClick={handlePayment}
        disabled={loading || !sdkReady || !!error}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          '처리 중...'
        ) : !sdkReady ? (
          '결제 모듈 로딩 중...'
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            카드 등록하기 — ₩{amount.toLocaleString('ko-KR')}
          </>
        )}
      </button>

      <button
        onClick={onCancel}
        disabled={loading}
        className="mt-3 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        취소
      </button>

      {/* 약관 동의 안내 */}
      <p className="mt-4 text-center text-xs text-gray-400">
        결제 등록 시{' '}
        <a href="/terms" className="underline hover:text-gray-600">이용약관</a>
        {' '}및{' '}
        <a href="/privacy" className="underline hover:text-gray-600">개인정보처리방침</a>에
        동의하는 것으로 간주됩니다.
      </p>
    </div>
  )
}
