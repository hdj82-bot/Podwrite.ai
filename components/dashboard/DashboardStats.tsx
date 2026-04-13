'use client'

import { useEffect, useState } from 'react'
import WritingStreak from './WritingStreak'
import WordCountChart from './WordCountChart'
import { getWritingPrefs } from '@/lib/writing-prefs'
import type { Project } from '@/types'

interface StatsData {
  streak: number
  logs: { date: string; words: number }[]
  activityLogs: { date: string; words: number }[]
  todayWords: number
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
  const [dailyGoal, setDailyGoal] = useState(0)

  useEffect(() => {
    fetch('/api/writing-stats')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((json: StatsData) => setData(json))
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    setDailyGoal(getWritingPrefs().dailyWordGoal)
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

      {/* 오늘의 집필 목표 카드 */}
      {dailyGoal > 0 && data && (() => {
        const today = data.todayWords ?? 0
        const achieved = today >= dailyGoal
        const pct = Math.min(100, Math.round((today / dailyGoal) * 100))
        const remaining = dailyGoal - today

        if (achieved) {
          return (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <span className="text-2xl select-none">🎉</span>
              <div>
                <p className="text-sm font-semibold text-green-800">오늘 목표 달성!</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {today.toLocaleString('ko-KR')}자 집필 완료 (목표 {dailyGoal.toLocaleString('ko-KR')}자)
                </p>
              </div>
            </div>
          )
        }

        return (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">오늘의 목표</p>
              <p className="text-xs font-semibold text-gray-700 tabular-nums">
                {dailyGoal.toLocaleString('ko-KR')}자
              </p>
            </div>
            {/* 프로그레스 바 */}
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                목표까지 {remaining.toLocaleString('ko-KR')}자 남음
              </p>
              <p className="text-xs text-gray-500 tabular-nums">
                {today.toLocaleString('ko-KR')} / {dailyGoal.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        )
      })()}

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
