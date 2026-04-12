'use client'

/**
 * WritingStreak — GitHub 잔디밭 스타일 집필 기록 그리드
 *
 * 7열 × 7행 = 49일치 집필 활동을 색상으로 표시
 * 색상 기준:
 *   0자     → gray-100 (미작성)
 *   1–99자  → green-200
 *   100–499자 → green-400
 *   500자+  → green-600
 */

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface WritingStreakProps {
  streak: number
  logs?: { date: string; words: number }[]
}

const DAYS = 49 // 7주

function cellColor(words: number): string {
  if (words <= 0)   return 'bg-gray-100'
  if (words < 100)  return 'bg-green-200'
  if (words < 500)  return 'bg-green-400'
  return 'bg-green-600'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function WritingStreak({ streak, logs = [] }: WritingStreakProps) {
  const [tooltip, setTooltip] = useState<{ date: string; words: number; idx: number } | null>(null)

  // logs를 날짜→단어수 맵으로 변환
  const logMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of logs) m[l.date] = l.words
    return m
  }, [logs])

  // 오늘부터 역순으로 49일 날짜 배열 생성
  const cells = useMemo(() => {
    const today = new Date()
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (DAYS - 1 - i))
      const dateStr = d.toISOString().slice(0, 10)
      return { date: dateStr, words: logMap[dateStr] ?? 0 }
    })
  }, [logMap])

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>{streak > 0 ? '🔥' : '✍️'}</span>
          <div>
            <span className="text-xl font-bold text-gray-900 tabular-nums leading-tight">{streak}</span>
            <span className="ml-1 text-xs text-gray-500">일 연속 집필</span>
          </div>
        </div>
        {/* 범례 */}
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span>적음</span>
          {['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-600'].map((cls) => (
            <span key={cls} className={cn('w-3 h-3 rounded-sm border border-gray-200', cls)} />
          ))}
          <span>많음</span>
        </div>
      </div>

      {/* 잔디 그리드 7열 × 7행 */}
      <div className="relative">
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => (
            <div
              key={cell.date}
              className={cn(
                'aspect-square rounded-sm border border-gray-100 cursor-default transition-opacity',
                cellColor(cell.words),
                tooltip?.idx === idx ? 'opacity-80' : '',
              )}
              onMouseEnter={() => setTooltip({ ...cell, idx })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </div>

        {/* 툴팁 */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 bottom-full mb-1.5 left-1/2 -translate-x-1/2
                       bg-gray-900 text-white text-[11px] rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg"
          >
            {formatDate(tooltip.date)} — {tooltip.words > 0 ? `${tooltip.words.toLocaleString('ko-KR')}자` : '미작성'}
          </div>
        )}
      </div>

      {streak === 0 && (
        <p className="text-[11px] text-gray-400 text-center leading-snug">
          오늘 100자 이상 쓰면 기록이 시작돼요
        </p>
      )}
    </div>
  )
}
