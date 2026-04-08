/**
 * POST /api/generate-docx
 *
 * POD DOCX 생성 트리거 → Inngest 백그라운드 잡 발행
 *
 * Body:
 *   project_id  string   — 프로젝트 UUID
 *   platform    enum     — 'bookk' | 'kyobo' | 'kdp'
 *   include_cover boolean — 표지 포함 여부 (기본 false)
 *
 * 응답:
 *   202 Accepted + { job_id, message }
 *   클라이언트는 Supabase Realtime으로 완료 알림 수신
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import { inngest } from '@/inngest/client'
import { PLAN_LIMITS } from '@/types'

const schema = z.object({
  project_id: z.string().uuid(),
  platform: z.enum(['bookk', 'kyobo', 'kdp']),
  include_cover: z.boolean().default(false),
})

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // KDP 내보내기는 Pro 플랜 전용
  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (body.platform === 'kdp' && !PLAN_LIMITS[profile.plan].kdp) {
    return NextResponse.json(
      { error: 'KDP 내보내기는 Pro 플랜 전용 기능입니다.' },
      { status: 403 },
    )
  }

  // Inngest 이벤트 발행
  const [{ ids }] = await inngest.send({
    name: 'file/docx.requested',
    data: {
      project_id: body.project_id,
      user_id: authUser.id,
      platform: body.platform,
      include_cover: body.include_cover,
    },
  })

  return NextResponse.json(
    {
      data: {
        job_id: ids[0],
        message: 'DOCX 생성을 시작했습니다. 완료되면 자동으로 다운로드 링크가 제공됩니다.',
        estimated_seconds: 30,
      },
    },
    { status: 202 },
  )
}
