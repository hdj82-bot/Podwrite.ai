/**
 * POST /api/kdp/metadata/save
 *
 * KDP 메타데이터를 projects.kdp_metadata JSONB 컬럼에 저장합니다.
 *
 * body: {
 *   projectId: string (UUID)
 *   metadata: {
 *     title?: string
 *     subtitle?: string
 *     author?: string
 *     bisac_codes?: string[]
 *     keywords?: string[]
 *     description?: string
 *     language?: string
 *     price_usd?: number
 *   }
 * }
 *
 * 응답: { data: { updated_at: string } }
 *
 * 인증: 필수, Pro 플랜 전용
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { PLAN_LIMITS } from '@/types'

const schema = z.object({
  projectId: z.string().uuid(),
  metadata: z.object({
    title: z.string().max(200).optional(),
    subtitle: z.string().max(200).optional(),
    author: z.string().max(100).optional(),
    bisac_codes: z.array(z.string()).max(2).optional(),
    keywords: z.array(z.string()).max(7).optional(),
    description: z.string().max(4000).optional(),
    language: z.string().length(2).optional(),
    price_usd: z.number().min(0.99).max(999.99).optional(),
  }),
})

export async function POST(request: Request) {
  try {
    const { authUser, profile } = await getCurrentUserWithProfile()
    if (!authUser || !profile) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Pro 플랜 전용
    if (!PLAN_LIMITS[profile.plan]?.kdp) {
      return NextResponse.json(
        { error: 'KDP 글로벌 모듈은 Pro 플랜 전용입니다.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '요청 형식이 올바르지 않습니다.', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { projectId, metadata } = parsed.data
    const supabase = createServerClient()

    // 프로젝트 소유권 확인
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', authUser.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' },
        { status: 404 },
      )
    }

    // 기존 kdp_metadata와 병합하여 저장 (부분 업데이트 지원)
    const { data: existing } = await supabase
      .from('projects')
      .select('kdp_metadata')
      .eq('id', projectId)
      .single()

    const merged = {
      ...(existing?.kdp_metadata ?? {}),
      ...metadata,
      saved_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update({ kdp_metadata: merged })
      .eq('id', projectId)
      .eq('user_id', authUser.id)

    if (updateError) {
      console.error('[kdp/metadata/save] update error:', updateError)
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      data: { updated_at: merged.saved_at },
    })
  } catch (err) {
    console.error('[kdp/metadata/save] unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
