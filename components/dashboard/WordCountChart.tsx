import { cn } from '@/lib/utils'

interface LogEntry {
  date: string  // YYYY-MM-DD
  words: number
}

interface WordCountChartProps {
  logs: LogEntry[]
}

/** 날짜 문자열에서 "M/D" 형식 반환 */
function formatMonthDay(dateStr: string): string {
  const [, mm, dd] = dateStr.split('-')
  return `${parseInt(mm)}/${parseInt(dd)}`
}

/**
 * 최근 30일 집필량 막대 그래프
 * 외부 차트 라이브러리 없이 Tailwind CSS로 구현
 */
export default function WordCountChart({ logs }: WordCountChartProps) {
  const maxWords = Math.max(...logs.map((l) => l.words), 1)

  // X축 레이블: 인덱스 0(가장 오래된), 29(오늘)
  // 7일 간격으로 5개 레이블 표시 (29일 전 / 22 / 15 / 8 / 오늘)
  const labelIndices = [0, 7, 14, 21, 29]

  return (
    <div className="flex-1 p-5 bg-white rounded-xl border border-gray-200">
      {/* 헤더 */}
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">최근 30일 집필량</h3>
        <span className="text-xs text-gray-400">단위: 자(字)</span>
      </div>

      {/* 바 차트 */}
      <div className="flex items-end gap-[2px] h-20" role="img" aria-label="30일 집필량 그래프">
        {logs.map((log, i) => {
          const isToday = i === logs.length - 1
          const heightPct = (log.words / maxWords) * 100
          // 최소 높이: 집필량이 있으면 4%, 없으면 2%
          const displayHeight = log.words > 0 ? Math.max(heightPct, 4) : 2

          return (
            <div
              key={log.date}
              className="group relative flex-1 flex flex-col justify-end h-full"
            >
              {/* 바 */}
              <div
                className={cn(
                  'w-full rounded-sm transition-colors',
                  log.words >= 100
                    ? isToday
                      ? 'bg-blue-600'
                      : 'bg-blue-400 group-hover:bg-blue-500'
                    : log.words > 0
                    ? 'bg-blue-200 group-hover:bg-blue-300'
                    : 'bg-gray-100',
                )}
                style={{ height: `${displayHeight}%` }}
              />

              {/* 호버 툴팁 */}
              <div
                className={cn(
                  'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5',
                  'hidden group-hover:block z-10 pointer-events-none',
                )}
              >
                <div className="bg-gray-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap shadow-sm">
                  <span className="text-gray-300 mr-1">{formatMonthDay(log.date)}</span>
                  {log.words.toLocaleString('ko-KR')}자
                </div>
                {/* 말풍선 꼬리 */}
                <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
              </div>
            </div>
          )
        })}
      </div>

      {/* X축 레이블 */}
      <div className="flex justify-between mt-1.5 px-[1px]">
        {labelIndices.map((idx) => {
          const entry = logs[idx]
          if (!entry) return <span key={idx} className="text-xs text-gray-400" />
          return (
            <span key={idx} className="text-[11px] text-gray-400">
              {idx === 29 ? '오늘' : formatMonthDay(entry.date)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
