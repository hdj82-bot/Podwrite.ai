/**
 * /api/projects/[id]/chapters
 *
 * GET  — 챕터 목록 (content 제외, order_idx ASC)
 * POST — 챕터 생성 (order_idx 자동, 빈 TipTap 문서로 초기화)
 *
 * 인증: 필수
 * 소유권: RLS + 프로젝트 존재 확인
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import type { TipTapDocument } from '@/types'

/** 빈 TipTap 문서 — 에디터 초기 상태 */
const EMPTY_TIPTAP_DOC: TipTapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

const createSchema = z.object({
  title: z.string().min(1).max(200).default('새 챕터'),
})

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/projects/[id]/chapters ───────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteCtx,
) {
  const { id: projectId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 프로젝트 소유 확인 (RLS — 타인 소유면 null 반환)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  // content 제외 — 에디터는 개별 챕터 GET /api/chapters/[id] 로 로드
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

// ── POST /api/projects/[id]/chapters ─────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: RouteCtx,
) {
  const { id: projectId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 요청 파싱 (body 없으면 기본값 사용)
  let body: z.infer<typeof createSchema>
  try {
    const raw = await req.json().catch(() => ({}))
    body = createSchema.parse(raw)
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // 프로젝트 소유 확인 (RLS)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' }, { status: 404 })
  }

  // 현재 마지막 order_idx + 1
  const { data: last } = await supabase
    .from('chapters')
    .select('order_idx')
    .eq('project_id', projectId)
    .order('order_idx', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrderIdx = (last?.order_idx ?? -1) + 1

  // 챕터 생성 — content를 빈 TipTap 문서로 초기화
  const { data: chapter, error } = await supabase
    .from('chapters')
    .insert({
      project_id: projectId,
      title: body.title,
      order_idx: nextOrderIdx,
      content: EMPTY_TIPTAP_DOC,
      word_count: 0,
    })
    .select()
    .single()

  if (error || !chapter) {
    return NextResponse.json({ error: '챕터 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // 프로젝트 updated_at 갱신 (목록 정렬 최신화)
  await supabase
    .from('projects')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', projectId)

  return NextResponse.json({ data: chapter }, { status: 201 })
}
