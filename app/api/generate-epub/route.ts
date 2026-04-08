/**
 * POST /api/generate-epub
 *
 * EPUB 생성 트리거 → Inngest 백그라운드 잡 발행
 * Pro 플랜 전용 (KDP 글로벌 기능)
 *
 * Body:
 *   project_id  string   — 프로젝트 UUID
 *   language    enum     — 'ko' | 'en'
 *   include_toc boolean  — 목차 포함 여부 (기본 true)
 *
 * 응답: 202 Accepted
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import { inngest } from '@/inngest/client'
import { PLAN_LIMITS } from '@/types'

const schema = z.object({
  project_id: z.string().uuid(),
  language: z.enum(['ko', 'en']).default('ko'),
  include_toc: z.boolean().default(true),
})

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // EPUB 생성은 Pro 플랜 전용
  if (!PLAN_LIMITS[profile.plan].kdp) {
    return NextResponse.json(
      { error: 'EPUB 생성은 Pro 플랜 전용 기능입니다.' },
      { status: 403 },
    )
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const [{ ids }] = await inngest.send({
    name: 'file/epub.requested',
    data: {
      project_id: body.project_id,
      user_id: authUser.id,
      language: body.language,
      include_toc: body.include_toc,
    },
  })

  return NextResponse.json(
    {
      data: {
        job_id: ids[0],
        message: 'EPUB 생성을 시작했습니다. 약 2-5분 후 다운로드 링크가 제공됩니다.',
        estimated_seconds: 120,
      },
    },
    { status: 202 },
  )
}
