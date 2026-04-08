/**
 * /api/chapters
 *
 * GET  ?projectId=UUID  — 챕터 목록 (content 제외, 순서대로)
 * POST              — 챕터 생성
 *
 * 인증: 필수 (RLS로 소유권 검증)
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'

const createSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(200).default('새 챕터'),
  order_idx: z.number().int().min(0).optional(), // 미지정시 마지막에 추가
})

// ── GET ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId 파라미터가 필요합니다.' }, { status: 400 })
  }

  // 프로젝트 소유 확인 (RLS)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  // content 제외 — 에디터는 개별 챕터 API로 가져옴
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('id, project_id, order_idx, title, word_count, created_at, updated_at')
    .eq('project_id', projectId)
    .order('order_idx', { ascending: true })

  if (error) {
    return NextResponse.json({ error: '챕터 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: chapters ?? [] })
}

// ── POST ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // 프로젝트 소유 확인 (RLS)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', body.project_id)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' }, { status: 404 })
  }

  // order_idx 미지정시 현재 최댓값 + 1
  let orderIdx = body.order_idx
  if (orderIdx === undefined) {
    const { data: last } = await supabase
      .from('chapters')
      .select('order_idx')
      .eq('project_id', body.project_id)
      .order('order_idx', { ascending: false })
      .limit(1)
      .maybeSingle()

    orderIdx = (last?.order_idx ?? -1) + 1
  }

  const { data: chapter, error } = await supabase
    .from('chapters')
    .insert({
      project_id: body.project_id,
      title: body.title,
      order_idx: orderIdx,
      content: null,
      word_count: 0,
    })
    .select()
    .single()

  if (error || !chapter) {
    return NextResponse.json({ error: '챕터 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: chapter }, { status: 201 })
}
