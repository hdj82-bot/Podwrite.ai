import Link from 'next/link'

export default function NotFoundPage() {
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

      {/* 404 */}
      <p className="text-7xl font-bold text-orange-100 select-none">404</p>

      {/* 메시지 */}
      <div className="space-y-2 -mt-2">
        <h1 className="text-xl font-semibold text-gray-900">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
          요청하신 페이지가 존재하지 않거나<br />
          다른 주소로 이동됐을 수 있습니다.
        </p>
      </div>

      {/* 버튼 */}
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
        >
          대시보드로
        </Link>
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
