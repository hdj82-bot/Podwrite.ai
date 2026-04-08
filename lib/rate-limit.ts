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

/** AI 채팅: 분당 10회 */
export const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:chat',
})

/** 자료 검색: 분당 5회 */
export const searchRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:search',
})

/** 맞춤법 교정: 분당 20회 */
export const spellcheckRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:spellcheck',
})

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
