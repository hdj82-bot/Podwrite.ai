import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center p-8">
      <p className="text-6xl font-bold text-gray-200">404</p>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          페이지를 찾을 수 없어요
        </h1>
        <p className="text-sm text-gray-500">
          요청하신 페이지가 존재하지 않거나 이동됐을 수 있습니다.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        대시보드로 돌아가기
      </Link>
    </div>
  )
}
