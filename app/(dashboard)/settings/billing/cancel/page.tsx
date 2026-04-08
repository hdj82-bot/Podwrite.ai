/**
 * /settings/billing/cancel — 빌링키 발급 취소 페이지
 *
 * 토스페이먼츠 requestBillingAuth() 실패/취소 시 이 URL로 리다이렉트됩니다.
 * 쿼리파라미터:
 *   code    — 토스 오류 코드
 *   message — 오류 메시지
 */

import Link from 'next/link'
import { XCircle, ArrowLeft } from 'lucide-react'

interface SearchParams {
  code?: string
  message?: string
}

export default async function BillingCancelPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { code, message } = searchParams

  const displayMessage =
    message ?? (code === 'USER_CANCEL' ? '결제를 취소하셨습니다.' : '카드 등록이 취소되었습니다.')

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <XCircle className="h-9 w-9 text-gray-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">결제가 취소됐습니다</h1>

        <p className="text-sm text-gray-500 mb-8">{displayMessage}</p>

        <Link
          href="/settings/billing"
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          구독 관리로 돌아가기
        </Link>
      </div>
    </div>
  )
}
