'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 text-center p-8 bg-white">
      {/* 로고 */}
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
          <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </div>
        <span className="text-lg font-bold text-gray-900 tracking-tight">Podwrite.ai</span>
      </div>

      {/* 오류 아이콘 */}
      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      {/* 메시지 */}
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-gray-900">
          문제가 발생했습니다
        </h1>
        <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
          일시적인 오류입니다. 잠시 후 다시 시도해주세요.<br />
          문제가 계속되면 지원팀에 문의해주세요.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-1">오류 코드: {error.digest}</p>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
