/**
 * POST /api/diagnostics/[id]/claim
 *
 * 비회원 진단 → 회원 계정으로 연결
 *
 * 흐름:
 *   1. 비회원이 /api/diagnostics로 원고 진단 → session_token으로 임시 저장
 *   2. 회원가입/로그인 후 이 엔드포인트 호출
 *   3. session_token 검증 후 user_id 업데이트
 *
 * 요청 Body:
 *   { session_token: string }
 *
 * 응답:
 *   { data: { id: string } }
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, createServiceClient } from '@/lib/supabase-server'

const bodySchema = z.object({
  session_token: z.string().min(10),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  // ── 인증 (로그인 필수) ─────────────────────────────────────────
  const authUser = await getCurrentUser()
  if (!authUser) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── 요청 파싱 ─────────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const diagnosticId = params.id
  if (!diagnosticId) {
    return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 })
  }

  // Service client — 비회원 레코드(user_id=null)를 RLS 우회하여 조회/수정
  const supabase = createServiceClient()

  // ── 진단 레코드 조회 ──────────────────────────────────────────
  const { data: diagnostic, error: fetchError } = await supabase
    .from('diagnostics')
    .select('id, user_id, session_token, status')
    .eq('id', diagnosticId)
    .single()

  if (fetchError || !diagnostic) {
    return NextResponse.json({ error: '진단을 찾을 수 없습니다.' }, { status: 404 })
  }

  // ── session_token 검증 ────────────────────────────────────────
  if (diagnostic.session_token !== body.session_token) {
    return NextResponse.json({ error: '유효하지 않은 session_token입니다.' }, { status: 403 })
  }

  // ── 이미 다른 사용자에게 연결된 경우 거부 ───────────────────
  if (diagnostic.user_id !== null && diagnostic.user_id !== authUser.id) {
    return NextResponse.json({ error: '이미 다른 계정에 연결된 진단입니다.' }, { status: 409 })
  }

  // 이미 같은 사용자 → 멱등성 보장
  if (diagnostic.user_id === authUser.id) {
    return NextResponse.json({ data: { id: diagnostic.id } })
  }

  // ── user_id 업데이트 ──────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('diagnostics')
    .update({ user_id: authUser.id })
    .eq('id', diagnosticId)

  if (updateError) {
    return NextResponse.json({ error: '진단 연결 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: diagnosticId } })
}
