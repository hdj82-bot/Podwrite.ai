import Link from 'next/link'

/**
 * 랜딩 페이지 — 최소 진입점
 * Window 2 (에디터 프론트)가 /dashboard 구현 후 교체 가능
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Podwrite.ai</h1>
        <p className="mt-3 text-lg text-gray-600">
          AI와 함께 기획부터 출판 파일까지 — 한 화면에서
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          무료로 시작하기
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          로그인
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-4 max-w-2xl text-center text-sm">
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-1">AI 집필 보조</div>
          <div className="text-gray-500">자료 검색·맞춤법·문체 교열</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-1">규격 자동 보장</div>
          <div className="text-gray-500">부크크·교보·KDP 포맷</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-1">원스톱 출판</div>
          <div className="text-gray-500">DOCX·EPUB·PDF 즉시 생성</div>
        </div>
      </div>
    </main>
  )
}
