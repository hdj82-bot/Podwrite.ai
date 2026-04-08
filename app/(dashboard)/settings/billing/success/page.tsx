/**
 * /settings/billing/success — 빌링키 발급 성공 페이지
 *
 * 토스페이먼츠 requestBillingAuth() 성공 시 이 URL로 리다이렉트됩니다.
 * 쿼리파라미터:
 *   authKey      — 토스 인증 키
 *   customerKey  — 고객 키 (user ID)
 *   plan         — 'basic' | 'pro' (successUrl에 포함된 커스텀 파라미터)
 *   type         — 'monthly' | 'annual'
 *
 * 서버 컴포넌트에서 /api/subscriptions/create-billing 호출 후
 * 결과에 따라 성공/실패 UI를 렌더링합니다.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'

interface SearchParams {
  authKey?: string
  customerKey?: string
  plan?: string
  type?: string
}

interface BillingSuccessResult {
  ok: boolean
  planLabel: string
  nextBillingAt: string | null
  error: string | null
}

async function confirmBilling(
  authKey: string,
  customerKey: string,
  plan: 'basic' | 'pro',
  billingType: 'monthly' | 'annual',
  baseUrl: string,
): Promise<BillingSuccessResult> {
  try {
    const res = await fetch(`${baseUrl}/api/subscriptions/create-billing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 서버 컴포넌트에서 호출 시 쿠키 전달 필요
      // Next.js 14 서버 컴포넌트에서는 credentials: 'include' 대신
      // 아래 cookies() 패턴 사용 권장
      body: JSON.stringify({ authKey, customerKey, plan, billing_type: billingType }),
    })
    const json = await res.json()

    if (!res.ok) {
      return { ok: false, planLabel: plan, nextBillingAt: null, error: json.error ?? '결제 오류' }
    }

    const planLabels = { basic: '베이직', pro: '프로' }
    return {
      ok: true,
      planLabel: planLabels[plan] ?? plan,
      nextBillingAt: json.data?.next_billing_at ?? null,
      error: null,
    }
  } catch (err) {
    return {
      ok: false,
      planLabel: plan,
      nextBillingAt: null,
      error: err instanceof Error ? err.message : '네트워크 오류',
    }
  }
}

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { authKey, customerKey, plan, type } = searchParams

  // 필수 파라미터 없으면 billing으로
  if (!authKey || !customerKey) {
    redirect('/settings/billing?error=missing_params')
  }

  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  // customerKey는 반드시 본인 user_id
  if (customerKey !== authUser.id) {
    redirect('/settings/billing?error=invalid_customer')
  }

  const validPlan = plan === 'pro' ? 'pro' : 'basic'
  const validType = type === 'annual' ? 'annual' : 'monthly'

  // 배포 환경 baseUrl (서버 컴포넌트 fetch는 절대 URL 필요)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const result = await confirmBilling(authKey, customerKey, validPlan, validType, baseUrl)

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {result.ok ? (
          /* 성공 */
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-9 w-9 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">구독이 시작됐습니다!</h1>
            <p className="text-gray-600 mb-2">
              <span className="font-semibold text-purple-700">{result.planLabel} 플랜</span>이
              활성화되었습니다.
            </p>
            {result.nextBillingAt && (
              <p className="text-sm text-gray-400 mb-8">
                다음 결제일:{' '}
                {new Date(result.nextBillingAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white py-3 text-sm font-semibold text-center transition-colors"
              >
                대시보드로 이동
              </Link>
              <Link
                href="/settings/billing"
                className="w-full rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 text-sm font-medium text-center transition-colors"
              >
                구독 관리
              </Link>
            </div>
          </div>
        ) : (
          /* 실패 */
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-9 w-9 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">결제 등록에 실패했습니다</h1>
            <p className="text-sm text-gray-500 mb-2">{result.error}</p>
            <p className="text-xs text-gray-400 mb-8">
              카드 정보를 다시 확인하거나 다른 카드로 시도해보세요.
            </p>
            <Link
              href="/settings/billing"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              결제 다시 시도하기
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
