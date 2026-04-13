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
  createServiceClient,
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

  // 오늘 집필량 (KST 기준)
  const todayWords = logMap.get(getKSTDateString(0)) ?? 0

  // ── 잔디밭용 49일(7주) 활동 로그 ─────────────────────────────
  let activityLogs: { date: string; words: number }[] = []
  try {
    const svc = createServiceClient()
    const since49 = getKSTDateString(48)
    const { data: raw49 } = await svc
      .from('writing_logs')
      .select('log_date, words')
      .eq('user_id', user.id)
      .gte('log_date', since49)

    const map49 = new Map((raw49 ?? []).map((l) => [l.log_date, l.words]))
    for (let i = 48; i >= 0; i--) {
      const date = getKSTDateString(i)
      activityLogs.push({ date, words: map49.get(date) ?? 0 })
    }
  } catch {
    // writing_logs 테이블 미존재 등 오류 시 빈 배열로 폴백
    activityLogs = []
  }

  return NextResponse.json({ streak, logs, activityLogs, todayWords })
}
