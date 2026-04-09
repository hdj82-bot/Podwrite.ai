/**
 * /api/waitlist
 *
 * POST — 베타 테스터 대기자 이메일 등록
 *   - 비인증 요청 허용 (랜딩페이지 공개 폼)
 *   - 중복 이메일은 에러 대신 200으로 조용히 처리
 *   - IP 기준 시간당 5회 레이트 리밋
 *
 * 요청 (JSON):
 *   { email: string }
 *
 * 응답:
 *   200 { message: "등록되었습니다." | "이미 등록된 이메일입니다." }
 *   400 { error: "이메일 형식이 올바르지 않습니다." }
 *   429 { error: "잠시 후 다시 시도해 주세요." }
 *   500 { error: "등록 중 오류가 발생했습니다." }
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { waitlistRateLimit } from '@/lib/rate-limit'

// RFC 5322 간소화 이메일 검증
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// PostgreSQL UNIQUE 위반 에러 코드
const PG_UNIQUE_VIOLATION = '23505'

export async function POST(req: Request) {
  // ── 1. 레이트 리밋 ───────────────────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous'

  const { success } = await waitlistRateLimit.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: '잠시 후 다시 시도해 주세요.' },
      { status: 429 },
    )
  }

  // ── 2. 입력 검증 ─────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    )
  }

  const email = typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>).email
    : undefined

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: '이메일 형식이 올바르지 않습니다.' },
      { status: 400 },
    )
  }

  const normalizedEmail = email.trim().toLowerCase()

  // ── 3. Supabase INSERT ──────────────────────────────────────────
  // service_role 사용: anon RLS 정책도 허용하지만, API Route에서는
  // 쿠키 기반 세션 없이 신뢰할 수 있는 클라이언트가 필요하므로 service_role 사용
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('waitlist')
    .insert({ email: normalizedEmail })

  if (error) {
    // 중복 이메일 — UNIQUE 위반은 조용히 200 처리
    if (error.code === PG_UNIQUE_VIOLATION) {
      return NextResponse.json({ message: '이미 등록된 이메일입니다.' })
    }

    console.error('[waitlist] insert error:', error.message)
    return NextResponse.json(
      { error: '등록 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ message: '등록되었습니다.' })
}
