/**
 * POST /api/kdp/package
 *
 * KDP 제출 패키지 생성 → Inngest 백그라운드 잡 발행
 *
 * 패키지 내용 (Inngest 잡에서 처리):
 *   - ebook.epub        (번역된 영문 EPUB — epub-generator.ts 활용)
 *   - interior.docx     (Supabase Storage에서)
 *   - cover/            (업로드된 표지)
 *   - metadata.json     (KDP 메타데이터 JSON)
 *   - metadata.xlsx     (KDP 메타데이터 스프레드시트)
 *   - README.txt        (KDP 제출 가이드)
 *
 * body: { projectId, aiDisclosure?, metadata? }
 * 응답: 202 Accepted + { job_id, message }
 *
 * 완료 알림: Supabase Realtime (projects.kdp_package JSONB 업데이트)
 *
 * 인증: Pro 플랜 전용 (checkPlanAccess)
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { checkPlanAccess } from '@/lib/plan-guard'
import { inngest } from '@/inngest/client'

const schema = z.object({
  projectId: z.string().uuid(),
  aiDisclosure: z.enum(['none', 'some', 'primary']).optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      author: z.string().optional(),
      bisac_codes: z.array(z.string()).max(2).optional(),
      bisac_code: z.string().optional(),
      bisac_label: z.string().optional(),
      keywords: z.array(z.string()).max(7).optional(),
      description: z.string().optional(),
      language: z.string().optional(),
      price_usd: z.number().optional(),
    })
    .optional(),
})

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const access = await checkPlanAccess(authUser.id, 'kdp')
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason ?? 'KDP 패키지 생성은 Pro 플랜 전용 기능입니다.' },
      { status: 403 },
    )
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  // 프로젝트 소유권 확인
  const supabase = await createServerClient()
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', body.projectId)
    .eq('user_id', authUser.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 패키지 생성 상태 초기화 (Realtime 구독 클라이언트가 즉시 pending 확인 가능)
  await supabase
    .from('projects')
    .update({ kdp_package: { status: 'pending', requested_at: new Date().toISOString() } })
    .eq('id', body.projectId)

  // Inngest 이벤트 발행
  const [{ ids }] = await inngest.send({
    name: 'kdp/package.requested',
    data: {
      project_id: body.projectId,
      user_id: authUser.id,
      metadata: body.metadata
        ? { ...body.metadata, ai_disclosure: body.aiDisclosure }
        : body.aiDisclosure
          ? { ai_disclosure: body.aiDisclosure }
          : undefined,
    },
  })

  return NextResponse.json(
    {
      data: {
        job_id: ids[0],
        message: 'KDP 패키지 생성을 시작했습니다. 완료되면 자동으로 다운로드 링크가 제공됩니다.',
      },
    },
    { status: 202 },
  )
}
