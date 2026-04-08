/**
 * /api/chapters/[id]
 *
 * GET    — 챕터 전체 데이터 (TipTap content 포함)
 * PATCH  — 메타(title/order_idx) + 콘텐츠 자동저장(content/word_count)
 *          trigger 필드 지정 시 버전도 동시 저장
 * DELETE — 챕터 삭제 + 후속 order_idx 재정렬
 *
 * 인증: 필수 (RLS로 소유권 검증)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'
import { getVersionsToEvict } from '@/lib/plan-guard'
import type { Plan, TipTapDocument, VersionTrigger } from '@/types'

const patchSchema = z.object({
  // 메타 변경
  title: z.string().min(1).max(200).optional(),
  order_idx: z.number().int().min(0).optional(),
  // 콘텐츠 자동저장
  content: z.unknown().optional(),           // TipTapDocument — 런타임 타입 검사 생략
  word_count: z.number().int().min(0).optional(),
  // 버전 스냅샷 트리거 (지정 시 chapter_versions에 행 추가)
  trigger: z.enum(['autosave', 'manual', 'ai_edit']).optional(),
})

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/chapters/[id] ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteCtx,
) {
  const { id } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { data: chapter, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !chapter) {
    return NextResponse.json({ error: '챕터를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ data: chapter })
}

// ── PATCH /api/chapters/[id] ──────────────────────────────────────
// 제목/순서 변경 및 콘텐츠 자동저장을 단일 엔드포인트에서 처리

export async function PATCH(
  req: NextRequest,
  { params }: RouteCtx,
) {
  const { id } = await params
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

  const { trigger, content, word_count, title, order_idx } = parsed.data

  // 업데이트 내용이 trigger만 있으면 의미 없음
  const hasUpdate = title !== undefined || order_idx !== undefined ||
    content !== undefined || word_count !== undefined
  if (!hasUpdate) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  // 챕터 + 소유 프로젝트 조회 (순서 변경 및 버전 플랜 체크용)
  const { data: chapter, error: fetchError } = await supabase
    .from('chapters')
    .select('id, project_id, order_idx, title, content, word_count')
    .eq('id', id)
    .single()

  if (fetchError || !chapter) {
    return NextResponse.json({ error: '챕터를 찾을 수 없습니다.' }, { status: 404 })
  }

  // ── order_idx 변경 시: 연관 챕터 재정렬 (RPC) ──────────────
  if (order_idx !== undefined && order_idx !== chapter.order_idx) {
    const newIdx = order_idx
    const oldIdx = chapter.order_idx
    const projectId = chapter.project_id

    if (newIdx > oldIdx) {
      await supabase.rpc('reorder_chapter_down', {
        p_project_id: projectId,
        p_old_idx: oldIdx,
        p_new_idx: newIdx,
      })
    } else {
      await supabase.rpc('reorder_chapter_up', {
        p_project_id: projectId,
        p_old_idx: oldIdx,
        p_new_idx: newIdx,
      })
    }
  }

  // ── 챕터 업데이트 ─────────────────────────────────────────────
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (title !== undefined)      updateData.title = title
  if (order_idx !== undefined)  updateData.order_idx = order_idx
  if (content !== undefined)    updateData.content = content
  if (word_count !== undefined) updateData.word_count = word_count

  const { data: updated, error: updateError } = await supabase
    .from('chapters')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: '챕터 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // ── 버전 스냅샷 저장 (trigger 지정 시) ───────────────────────
  if (trigger) {
    const contentToSave = (content ?? chapter.content) as TipTapDocument | null
    if (contentToSave) {
      // fire-and-forget: 버전 저장 실패가 자동저장을 방해하지 않도록
      saveVersion(chapter.project_id, id, contentToSave, trigger).catch(() => {})
    }
  }

  return NextResponse.json({ data: updated })
}

// ── DELETE /api/chapters/[id] ─────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: RouteCtx,
) {
  const { id } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 삭제 전 챕터 정보 조회
  const { data: chapter, error: fetchError } = await supabase
    .from('chapters')
    .select('id, project_id, order_idx')
    .eq('id', id)
    .single()

  if (fetchError || !chapter) {
    return NextResponse.json({ error: '챕터를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 마지막 챕터 보호
  const { count } = await supabase
    .from('chapters')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', chapter.project_id)

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: '마지막 챕터는 삭제할 수 없습니다.' },
      { status: 400 },
    )
  }

  // 삭제
  const { error: deleteError } = await supabase
    .from('chapters')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: '챕터 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // 삭제된 챕터 이후의 order_idx를 -1씩 당김
  const { data: remaining } = await supabase
    .from('chapters')
    .select('id, order_idx')
    .eq('project_id', chapter.project_id)
    .gt('order_idx', chapter.order_idx)
    .order('order_idx', { ascending: true })

  if (remaining && remaining.length > 0) {
    await Promise.all(
      remaining.map((c) =>
        supabase
          .from('chapters')
          .update({ order_idx: c.order_idx - 1 })
          .eq('id', c.id),
      ),
    )
  }

  return new Response(null, { status: 204 })
}

// ── 내부: 버전 저장 + FIFO 퇴거 ─────────────────────────────────

async function saveVersion(
  projectId: string,
  chapterId: string,
  content: TipTapDocument,
  trigger: VersionTrigger,
): Promise<void> {
  // 사용자 플랜 조회 (Service client — 버전 한도 계산)
  const supa = createServiceClient()

  const { data: project } = await supa
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (!project) return

  const { data: userRow } = await supa
    .from('users')
    .select('plan')
    .eq('id', project.user_id)
    .single()

  const plan = (userRow?.plan ?? 'free') as Plan

  // 한도 초과분 퇴거
  const toEvict = await getVersionsToEvict(chapterId, plan)
  if (toEvict.length > 0) {
    await supa.from('chapter_versions').delete().in('id', toEvict)
  }

  await supa.from('chapter_versions').insert({
    chapter_id: chapterId,
    content,
    trigger,
  })
}
