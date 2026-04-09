/**
 * GET /api/writing-stats
 *
 * 대시보드용 집필 통계 반환
 * - streak: 연속 집필 일수 (KST 자정 기준, 100자 이상)
 * - logs: 최근 30일 날짜별 집필량 (누락 날짜는 words=0으로 채움)
 *
 * 인증: 필수
 */
import { NextResponse } from 'next/server'
import {
  createServerClient,
  getWritingStreak,
  getWritingLogs30Days,
  getKSTDateString,
} from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const [streak, rawLogs] = await Promise.all([
    getWritingStreak(user.id),
    getWritingLogs30Days(user.id),
  ])

  // 최근 30일 날짜 배열 생성 (오래된 것부터 → 오늘 순)
  const logMap = new Map(rawLogs.map((l) => [l.log_date, l.words]))
  const logs: { date: string; words: number }[] = []

  for (let i = 29; i >= 0; i--) {
    const date = getKSTDateString(i)
    logs.push({ date, words: logMap.get(date) ?? 0 })
  }

  return NextResponse.json({ streak, logs })
}
