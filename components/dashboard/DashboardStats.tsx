'use client'

import { useEffect, useState } from 'react'
import WritingStreak from './WritingStreak'
import WordCountChart from './WordCountChart'

interface StatsData {
  streak: number
  logs: { date: string; words: number }[]
}

/** 스켈레톤 플레이스홀더 */
function StatsSkeleton() {
  return (
    <div className="flex gap-4 mb-6 animate-pulse">
      <div className="w-32 h-32 bg-gray-100 rounded-xl" />
      <div className="flex-1 h-32 bg-gray-100 rounded-xl" />
    </div>
  )
}

/**
 * 집필 통계 위젯 — 스트릭 + 30일 집필량 그래프
 * /api/writing-stats 에서 데이터를 클라이언트 사이드로 가져옴
 */
export default function DashboardStats() {
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

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <WritingStreak streak={data.streak} />
      <WordCountChart logs={data.logs} />
    </div>
  )
}
