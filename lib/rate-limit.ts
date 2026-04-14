/**
 * Upstash Redis 기반 요청 제한 + 일일 토큰 사용량 추적
 *
 * 환경 변수:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { Plan } from '@/types'

const redis = Redis.fromEnv()

// ── API별 분당 요청 제한 ─────────────────────────────────────────

/** AI 집필 보조: 분당 5회 */
export const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:chat',
})

/** 자료 검색: 분당 3회 */
export const searchRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 m'),
  prefix: 'rl:search',
})

/** 맞춤법 교정: 분당 2회 */
export const spellcheckRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, '1 m'),
  prefix: 'rl:spellcheck',
})

/** 베타 대기자 등록: IP당 시간당 5회 */
export const waitlistRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:waitlist',
})

/** 원고 진단: 분당 1회 (Claude API 비용 보호) */
export const diagnosticsRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '1 m'),
  prefix: 'rl:diagnostics',
})

// ── 429 응답 헬퍼 ────────────────────────────────────────────────

/**
 * Rate limit 초과 시 일관된 429 응답 생성
 * @param reset  Upstash limit() 반환값의 reset (ms 단위 Unix timestamp)
 */
export function rateLimitResponse(reset: number): Response {
  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return Response.json(
    { error: `잠시 후 다시 시도하세요. (${retryAfterSec}초 후 가능)` },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    },
  )
}

// ── 플랜별 일일 토큰 한도 ────────────────────────────────────────

export const DAILY_TOKEN_LIMITS: Record<Plan, number> = {
  free: 10_000,
  basic: 100_000,
  pro: Infinity,
}

// ── 일일 토큰 사용량 추적 (Redis) ─────────────────────────────────

function todayKey(userId: string): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return `tokens:${userId}:${date}`
}

/** 오늘 사용한 토큰 수 조회 */
export async function getDailyTokensUsed(userId: string): Promise<number> {
  const count = await redis.get<number>(todayKey(userId))
  return count ?? 0
}

/** 토큰 사용량 누적 (25시간 TTL — 자정 이후에도 안전하게 만료) */
export async function incrementDailyTokens(userId: string, tokens: number): Promise<void> {
  const key = todayKey(userId)
  await redis.incrby(key, tokens)
  await redis.expire(key, 25 * 60 * 60)
}
