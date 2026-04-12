'use client'

import { useEffect, useState } from 'react'
import WritingStreak from './WritingStreak'
import WordCountChart from './WordCountChart'
import type { Project } from '@/types'

interface StatsData {
  streak: number
  logs: { date: string; words: number }[]
  activityLogs: { date: string; words: number }[]
}

interface DashboardStatsProps {
  projects?: Project[]
}

/** 스켈레톤 플레이스홀더 */
function StatsSkeleton() {
  return (
    <div className="space-y-4 mb-6 animate-pulse">
      <div className="flex gap-4">
        <div className="flex-1 h-36 bg-gray-100 rounded-xl" />
        <div className="flex-1 h-36 bg-gray-100 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="h-20 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}

/**
 * 집필 통계 위젯 — 스트릭 잔디밭 + 30일 집필량 그래프 + 요약 카드 3개
 * /api/writing-stats 에서 데이터를 클라이언트 사이드로 가져옴
 */
export default function DashboardStats({ projects = [] }: DashboardStatsProps) {
  const [data, setData] = useState<StatsData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/writing-stats')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((json: StatsData) => setData(json))
      .catch(() => setError(true))
  }, [])

  if (error) return null
  if (!data) return <StatsSkeleton />

  // ── 프로젝트 기반 통계 ─────────────────────────────────────────
  const totalWords = projects.reduce((sum, p) => sum + p.current_words, 0)

  const mostActive = projects.reduce<Project | null>((best, p) => {
    if (!best) return p
    return p.updated_at > best.updated_at ? p : best
  }, null)

  const thisMonthPrefix = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const thisMonthWords = (data.activityLogs ?? [])
    .filter((l) => l.date.startsWith(thisMonthPrefix))
    .reduce((sum, l) => sum + l.words, 0)

  return (
    <div className="space-y-4 mb-6">
      {/* 스트릭 잔디밭 + 30일 그래프 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="sm:w-72">
          <WritingStreak streak={data.streak} logs={data.activityLogs ?? []} />
        </div>
        <div className="flex-1">
          <WordCountChart logs={data.logs} />
        </div>
      </div>

      {/* 요약 카드 3개 */}
      {projects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {/* 전체 단어 수 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">전체 단어 수</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums">
              {totalWords.toLocaleString('ko-KR')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">자</p>
          </div>

          {/* 가장 활발한 프로젝트 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">최근 작업 원고</p>
            <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
              {mostActive?.title ?? '—'}
            </p>
          </div>

          {/* 이번 달 집필량 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">이번 달 집필</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums">
              {thisMonthWords.toLocaleString('ko-KR')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">자</p>
          </div>
        </div>
      )}
    </div>
  )
}
