/**
 * /api/chapters/[id]/versions
 *
 * GET  — 버전 목록 (content 제외, 최신순)
 * POST — 버전 수동 저장 (플랜별 한도 적용, FIFO 퇴거)
 *
 * 인증: 필수
 *
 * 버전 한도 (PLAN_LIMITS.versionsPerChapter):
 *   free    5개  → 초과 시 가장 오래된 버전 삭제 후 저장
 *   basic  20개  → 동일
 *   pro    무제한
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'
import { getVersionsToEvict } from '@/lib/plan-guard'
import type { Plan, TipTapDocument } from '@/types'

const createSchema = z.object({
  trigger: z.enum(['autosave', 'manual', 'ai_edit']).default('manual'),
  content: z.unknown(),  // TipTapDocument
})

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/chapters/[id]/versions ───────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteCtx,
) {
  const { id: chapterId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 소유권 확인: 챕터 → 프로젝트 → user_id
  const { data: chapter, error: chapErr } = await supabase
    .from('chapters')
    .select('id, project_id, projects!inner(user_id)')
    .eq('id', chapterId)
    .single()

  if (chapErr || !chapter) {
    return NextResponse.json({ error: '챕터를 찾을 수 없습니다.' }, { status: 404 })
  }

  type ChapWithOwner = typeof chapter & { projects: { user_id: string } }
  if ((chapter as ChapWithOwner).projects.user_id !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  // content 제외하여 목록만 반환 (복원 시 [versionId] 엔드포인트 사용)
  const { data: versions, error: verErr } = await supabase
    .from('chapter_versions')
    .select('id, chapter_id, trigger, created_at')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: false })

  if (verErr) {
    return NextResponse.json({ error: '버전 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: versions ?? [] })
}

// ── POST /api/chapters/[id]/versions ──────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: RouteCtx,
) {
  const { id: chapterId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 요청 파싱
  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // 챕터 소유권 + 프로젝트 ID + 플랜 조회
  const { data: chapter, error: chapErr } = await supabase
    .from('chapters')
    .select(`
      id,
      project_id,
      projects!inner (
        user_id,
        users!inner ( plan )
      )
    `)
    .eq('id', chapterId)
    .single()

  if (chapErr || !chapter) {
    return NextResponse.json({ error: '챕터를 찾을 수 없습니다.' }, { status: 404 })
  }

  type ChapFull = typeof chapter & {
    projects: { user_id: string; users: { plan: string }[] }
  }
  const chapFull = chapter as ChapFull

  if (chapFull.projects.user_id !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const plan = (chapFull.projects.users?.[0]?.plan ?? 'free') as Plan

  // ── FIFO 퇴거: 한도 초과 버전 삭제 ─────────────────────────
  const supa = createServiceClient()
  const toEvict = await getVersionsToEvict(chapterId, plan)
  if (toEvict.length > 0) {
    await supa.from('chapter_versions').delete().in('id', toEvict)
  }

  // ── 버전 저장 ─────────────────────────────────────────────────
  const { data: version, error: insertErr } = await supa
    .from('chapter_versions')
    .insert({
      chapter_id: chapterId,
      content: body.content as TipTapDocument,
      trigger: body.trigger,
    })
    .select('id, chapter_id, trigger, created_at')
    .single()

  if (insertErr || !version) {
    return NextResponse.json({ error: '버전 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: version }, { status: 201 })
}
