import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'

const patchSchema = z.object({
  terms_agreed_at: z.string().datetime().optional(),
  privacy_agreed_at: z.string().datetime().optional(),
  display_name: z.string().max(50).optional(),
})

// ── GET /api/user/profile ─────────────────────────────────────

export async function GET() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ data: profile })
}

// ── PATCH /api/user/profile ───────────────────────────────────
// 약관 동의 날짜만 수정 가능 (이메일·플랜은 수정 불가)

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }

  const { data: profile, error } = await supabase
    .from('users')
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select()
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: '업데이트 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: profile })
}
