import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'

// ── 입력 검증 스키마 ─────────────────────────────────────────

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  platform: z.enum(['bookk', 'kyobo', 'kdp']).optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'published']).optional(),
  target_words: z.number().int().min(1000).max(500000).optional(),
  genre: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
})

// ── GET /api/projects/[id] ───────────────────────────────────
// 프로젝트 + 챕터 목록 반환

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      chapters (
        id, project_id, order_idx, title, word_count, created_at, updated_at
      )
    `)
    .eq('id', id)
    .order('order_idx', { referencedTable: 'chapters', ascending: true })
    .single()

  if (error || !project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ data: project })
}

// ── PATCH /api/projects/[id] ─────────────────────────────────
// 프로젝트 메타데이터 수정

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 입력 검증
  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { data: project, error } = await supabase
    .from('projects')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    // RLS가 user_id 소유 확인 — 타인 소유면 data: null 반환
    .select()
    .single()

  if (error || !project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ data: project })
}

// ── DELETE /api/projects/[id] ────────────────────────────────
// 프로젝트 삭제 (챕터·버전 cascade)

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
  // RLS가 user_id 소유 확인

  if (error) {
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: { id } })
}
