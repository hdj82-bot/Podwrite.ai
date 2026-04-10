/**
 * 플랜별 기능 접근 제어
 *
 * 사용 예 (API Route):
 *   const guard = await checkPlanAccess(user.id, 'kdp')
 *   if (!guard.allowed)
 *     return NextResponse.json({ error: guard.reason }, { status: 403 })
 */
import { createServiceClient } from '@/lib/supabase-server'
import { PLAN_LIMITS } from '@/types'
import type { Plan } from '@/types'

/**
 * 챕터의 버전 중 한도를 초과한 오래된 버전 ID 목록 반환
 * (oldest-first FIFO 퇴거)
 */
export async function getVersionsToEvict(
  chapterId: string,
  plan: Plan,
): Promise<string[]> {
  const limit = PLAN_LIMITS[plan].versionsPerChapter
  if (limit === Infinity) return []

  const supabase = createServiceClient()
  const { data: versions } = await supabase
    .from('chapter_versions')
    .select('id')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: false }) // 최신 순

  if (!versions || versions.length < limit) return []

  // limit 개수를 초과하는 오래된 버전들의 id
  return versions.slice(limit - 1).map((v) => v.id)
}

export type GuardedFeature = 'kdp' | 'selling' | 'search' | 'versions_unlimited'

interface GuardResult {
  allowed: boolean
  reason?: string
  plan?: Plan
}

export async function checkPlanAccess(
  userId: string,
  feature: GuardedFeature,
): Promise<GuardResult> {
  const supabase = createServiceClient()

  // 사용자 플랜 조회
  const { data: user, error } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return { allowed: false, reason: '사용자 정보를 확인할 수 없습니다.' }
  }

  const plan = user.plan as Plan
  const limits = PLAN_LIMITS[plan]

  switch (feature) {
    case 'kdp':
      if (!limits.kdp) {
        return {
          allowed: false,
          reason: 'Amazon KDP 기능은 프로 플랜에서 사용할 수 있습니다.',
          plan,
        }
      }
      break

    case 'selling':
      if (!limits.sellingPage) {
        return {
          allowed: false,
          reason: '셀링 페이지 기능은 프로 플랜에서 사용할 수 있습니다.',
          plan,
        }
      }
      break

    case 'search': {
      // 월 검색 횟수 초과 여부 확인
      if (limits.searchPerMonth === Infinity) break // pro: 무제한

      const { data: usage } = await supabase
        .from('search_usage')
        .select('count, reset_at')
        .eq('user_id', userId)
        .single()

      if (usage) {
        // reset_at이 없거나 지났으면 초과 아님 (다음 주기)
        const isExpired = !usage.reset_at || new Date(usage.reset_at) < new Date()
        if (!isExpired && usage.count >= limits.searchPerMonth) {
          return {
            allowed: false,
            reason: `이번 달 자료 검색 횟수(${limits.searchPerMonth}회)를 모두 사용했습니다. 플랜을 업그레이드하거나 다음 달을 기다려주세요.`,
            plan,
          }
        }
      }
      break
    }

    case 'versions_unlimited':
      if (limits.versionsPerChapter !== Infinity) {
        // 무제한은 아니지만 접근 자체는 허용 (버전 수 제한은 DB 트리거로 처리)
        // 여기서는 단순히 plan 정보만 반환
      }
      break
  }

  return { allowed: true, plan }
}

/**
 * 프로젝트 개수 제한 확인
 * (checkPlanAccess와 별도 — 생성 시점에 current count 필요)
 */
export async function checkProjectLimit(userId: string): Promise<GuardResult> {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()

  if (!user) return { allowed: false, reason: '사용자 정보를 확인할 수 없습니다.' }

  const plan = user.plan as Plan
  const limit = PLAN_LIMITS[plan].projects

  if (limit === Infinity) return { allowed: true, plan }

  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if ((count ?? 0) >= limit) {
    return {
      allowed: false,
      reason: `현재 플랜(${plan === 'free' ? '무료' : '베이직'})은 최대 ${limit}개 프로젝트까지 생성할 수 있습니다.`,
      plan,
    }
  }

  return { allowed: true, plan }
}
