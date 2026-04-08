'use client'

import { useEffect } from 'react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center p-8">
      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <div>
        <p className="font-medium text-gray-900 mb-1">잠시 문제가 생겼어요</p>
        <p className="text-sm text-gray-500">페이지를 새로 고침하거나 다시 시도해주세요.</p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        다시 시도
      </button>
    </div>
  )
}
