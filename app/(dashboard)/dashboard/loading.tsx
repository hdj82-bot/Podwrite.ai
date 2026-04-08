/** 대시보드 프로젝트 목록 로딩 스켈레톤 */
export default function DashboardLoading() {
  return (
    <main className="flex-1 px-6 py-8">
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1.5">
          <div className="h-6 w-24 bg-gray-200 rounded-md animate-pulse" />
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* 카드 그리드 스켈레톤 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 p-5 bg-white rounded-xl border border-gray-100 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* 플랫폼·상태 뱃지 */}
            <div className="flex justify-between">
              <div className="h-5 w-14 bg-gray-200 rounded-md" />
              <div className="h-5 w-14 bg-gray-100 rounded-md" />
            </div>
            {/* 제목 */}
            <div className="space-y-1.5">
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-100 rounded" />
            </div>
            {/* 진행률 */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-12 bg-gray-100 rounded" />
                <div className="h-3 w-8 bg-gray-100 rounded" />
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            {/* 수정일 */}
            <div className="h-3 w-16 bg-gray-100 rounded mt-auto" />
          </div>
        ))}
      </div>
    </main>
  )
}
