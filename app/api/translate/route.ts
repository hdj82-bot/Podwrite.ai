/**
 * POST /api/translate
 *
 * 한→영 번역 트리거 → Inngest 백그라운드 잡 발행
 * Pro 플랜 전용 (KDP 글로벌 기능)
 *
 * Body:
 *   project_id  string     — 프로젝트 UUID
 *   chapter_ids string[]   — 번역할 챕터 ID 목록 (빈 배열 = 전체)
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
  chapter_ids: z.array(z.string().uuid()).default([]),
})

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 번역은 Pro 플랜 전용
  if (!PLAN_LIMITS[profile.plan].kdp) {
    return NextResponse.json(
      { error: '번역 기능은 Pro 플랜 전용입니다.' },
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
    name: 'file/translate.requested',
    data: {
      project_id: body.project_id,
      user_id: authUser.id,
      chapter_ids: body.chapter_ids,
    },
  })

  const chapterCount = body.chapter_ids.length
  const message =
    chapterCount > 0
      ? `${chapterCount}개 챕터 번역을 시작했습니다. 챕터당 약 1-2분 소요됩니다.`
      : '전체 챕터 번역을 시작했습니다. 약 2-10분 소요됩니다.'

  return NextResponse.json(
    {
      data: {
        job_id: ids[0],
        message,
        estimated_seconds: chapterCount > 0 ? chapterCount * 90 : 300,
      },
    },
    { status: 202 },
  )
}
