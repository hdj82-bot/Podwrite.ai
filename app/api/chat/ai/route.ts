/**
 * POST /api/chat/ai
 *
 * AI 집필 보조 스트리밍 엔드포인트
 * - 모델: claude-sonnet-4-6
 * - 응답: SSE (text/event-stream)
 * - 모드: writing(집필보조) / outline(목차기획) / style(문체교열)
 * - 인증: 필수 (로그인 사용자)
 * - 제한: 분당 10회, 플랜별 일일 토큰 한도
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import { streamClaudeChat } from '@/lib/claude'
import {
  chatRateLimit,
  DAILY_TOKEN_LIMITS,
  getDailyTokensUsed,
  incrementDailyTokens,
} from '@/lib/rate-limit'

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(50),
  mode: z.enum(['writing', 'outline', 'style']),
})

export async function POST(req: Request) {
  // ── 인증 ────────────────────────────────────────────────────────
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── 분당 요청 제한 ────────────────────────────────────────────
  const { success: rateLimitOk } = await chatRateLimit.limit(authUser.id)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
      { status: 429 },
    )
  }

  // ── 플랜별 일일 토큰 한도 확인 ───────────────────────────────
  const plan = profile.plan
  const tokenLimit = DAILY_TOKEN_LIMITS[plan]
  if (tokenLimit !== Infinity) {
    const usedToday = await getDailyTokensUsed(authUser.id)
    if (usedToday >= tokenLimit) {
      return NextResponse.json(
        {
          error: '오늘의 AI 사용량을 모두 소진했습니다. 플랜을 업그레이드하거나 내일 다시 시도하세요.',
        },
        { status: 429 },
      )
    }
  }

  // ── 요청 파싱 ────────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // ── Claude 스트리밍 ─────────────────────────────────────────
  const stream = streamClaudeChat(
    body.messages,
    body.mode,
    ({ input_tokens, output_tokens }) => {
      // 스트림 종료 후 실제 토큰 수 기록 (비동기, 실패해도 무시)
      incrementDailyTokens(authUser.id, input_tokens + output_tokens).catch(() => {})
    },
  )

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
