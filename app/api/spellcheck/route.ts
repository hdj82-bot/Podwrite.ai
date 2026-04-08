/**
 * POST /api/spellcheck
 *
 * 맞춤법 교정 엔드포인트
 * - CLOVA Spell Checker API (500자 단위 분할 병렬 처리)
 * - 인증: 필수
 * - 제한: 분당 20회
 *
 * 요청 Body:
 *   { text: string }  — 최대 50,000자
 *
 * 응답:
 *   { data: SpellCheckCorrection[] }
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/supabase-server'
import { checkSpelling } from '@/lib/spellcheck'
import { spellcheckRateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({
  text: z.string().min(1).max(50_000),
})

export async function POST(req: Request) {
  // ── 인증 ────────────────────────────────────────────────────────
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── 분당 요청 제한 ────────────────────────────────────────────
  const { success: rateLimitOk } = await spellcheckRateLimit.limit(user.id)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
      { status: 429 },
    )
  }

  // ── 요청 파싱 ────────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // ── 맞춤법 교정 ───────────────────────────────────────────────
  try {
    const corrections = await checkSpelling(body.text)
    return NextResponse.json({ data: corrections })
  } catch {
    return NextResponse.json(
      { error: '맞춤법 교정 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.' },
      { status: 502 },
    )
  }
}
