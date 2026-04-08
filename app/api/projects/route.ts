/**
 * /api/projects
 *
 * GET    — 내 프로젝트 목록 (최신순)
 * POST   — 새 프로젝트 생성 (플랜별 개수 제한)
 * PATCH  — 프로젝트 수정 (?id=UUID)
 * DELETE — 프로젝트 삭제 (?id=UUID)
 *
 * 플랜별 프로젝트 개수 한도:
 *   free   1개
 *   basic  3개
 *   pro    무제한
 *
 * 인증: 필수 (전 메서드)
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { PLAN_LIMITS } from '@/types'

// ── 스키마 ────────────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(200),
  platform: z.enum(['bookk', 'kyobo', 'kdp']),
  target_words: z.number().int().min(0).max(300_000).default(30_000),
  description: z.string().max(1000).nullable().optional(),
  genre: z.string().max(50).nullable().optional(),
})

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  platform: z.enum(['bookk', 'kyobo', 'kdp']).optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'published']).optional(),
  target_words: z.number().int().min(0).max(300_000).optional(),
  current_words: z.number().int().min(0).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  genre: z.string().max(50).nullable().optional(),
})

// ── GET: 목록 조회 ─────────────────────────────────────────────────

export async function GET() {
  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', authUser.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '프로젝트 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// ── POST: 프로젝트 생성 ───────────────────────────────────────────

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 요청 파싱
  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const supabase = await createServerClient()

  // 플랜별 프로젝트 개수 제한 확인
  const projectLimit = PLAN_LIMITS[profile.plan].projects
  if (projectLimit !== Infinity) {
    const { count, error: countError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)

    if (countError) {
      return NextResponse.json({ error: '프로젝트 확인 중 오류가 발생했습니다.' }, { status: 500 })
    }

    if ((count ?? 0) >= projectLimit) {
      return NextResponse.json(
        {
          error: `현재 플랜(${profile.plan})에서는 최대 ${projectLimit}개의 프로젝트만 생성할 수 있습니다. 플랜을 업그레이드하세요.`,
        },
        { status: 403 },
      )
    }
  }

  // 프로젝트 생성
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: authUser.id,
      title: body.title,
      platform: body.platform,
      target_words: body.target_words,
      description: body.description ?? null,
      genre: body.genre ?? null,
      status: 'draft',
      current_words: 0,
    })
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '프로젝트 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

// ── PATCH: 프로젝트 수정 ─────────────────────────────────────────

export async function PATCH(req: Request) {
  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '프로젝트 ID가 필요합니다.' }, { status: 400 })
  }

  let body: z.infer<typeof updateSchema>
  try {
    body = updateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  const supabase = await createServerClient()

  // RLS로 user_id 검증 (본인 프로젝트만 수정 가능)
  const { data, error } = await supabase
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', authUser.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: '프로젝트 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

// ── DELETE: 프로젝트 삭제 ────────────────────────────────────────

export async function DELETE(req: Request) {
  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '프로젝트 ID가 필요합니다.' }, { status: 400 })
  }

  const supabase = await createServerClient()

  // RLS로 user_id 검증
  const { error, count } = await supabase
    .from('projects')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', authUser.id)

  if (error) {
    return NextResponse.json({ error: '프로젝트 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
  if (count === 0) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' }, { status: 404 })
  }

  return new Response(null, { status: 204 })
}
