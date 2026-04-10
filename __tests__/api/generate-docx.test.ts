/**
 * POST /api/generate-docx 테스트
 *
 * 검증 항목:
 *  - 미인증 → 401
 *  - Free/Basic 플랜에서 KDP 요청 → 403
 *  - Pro 플랜에서 KDP 요청 → 202
 *  - bookk/kyobo 플랫폼 → 202
 *  - 잘못된 UUID → 400
 *  - 유효하지 않은 platform → 400
 *  - 정상 요청 시 Inngest 이벤트 발행 확인
 *  - 응답에 job_id 및 estimated_seconds 포함
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  getCurrentUserWithProfile: vi.fn(),
}))

vi.mock('@/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}))

vi.mock('@/types', () => ({
  PLAN_LIMITS: {
    free: { projects: 1, searchPerMonth: 10, kdp: false },
    basic: { projects: 3, searchPerMonth: 30, kdp: false },
    pro: { projects: Infinity, searchPerMonth: Infinity, kdp: true },
  },
}))

import { POST } from '@/app/api/generate-docx/route'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import { inngest } from '@/inngest/client'

// ── 헬퍼 ─────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/generate-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_PROJECT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const VALID_BODY = {
  project_id: VALID_PROJECT_ID,
  platform: 'bookk',
  include_cover: false,
}

// ── 테스트 ────────────────────────────────────────────────────────

describe('POST /api/generate-docx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'basic' },
    } as never)
    vi.mocked(inngest.send).mockResolvedValue([{ ids: ['inngest-job-id-001'] }] as never)
  })

  // ── 인증 ────────────────────────────────────────────────────────

  it('미인증 요청 → 401', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: null,
      profile: null,
    } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('로그인')
  })

  // ── KDP 플랜 제한 ─────────────────────────────────────────────

  it('free 플랜에서 kdp 요청 → 403 (Pro 전용)', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'free' },
    } as never)
    const res = await POST(makeRequest({ ...VALID_BODY, platform: 'kdp' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Pro 플랜')
  })

  it('basic 플랜에서 kdp 요청 → 403', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'basic' },
    } as never)
    const res = await POST(makeRequest({ ...VALID_BODY, platform: 'kdp' }))
    expect(res.status).toBe(403)
  })

  it('pro 플랜에서 kdp 요청 → 202', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'pro' },
    } as never)
    const res = await POST(makeRequest({ ...VALID_BODY, platform: 'kdp' }))
    expect(res.status).toBe(202)
  })

  // ── 플랫폼별 정상 요청 ─────────────────────────────────────────

  it('bookk 플랫폼 요청 → 202 + job_id 반환', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, platform: 'bookk' }))
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.data.job_id).toBe('inngest-job-id-001')
  })

  it('kyobo 플랫폼 요청 → 202', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, platform: 'kyobo' }))
    expect(res.status).toBe(202)
  })

  it('include_cover: true 옵션도 정상 처리된다', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, include_cover: true }))
    expect(res.status).toBe(202)
  })

  // ── 요청 형식 검증 ────────────────────────────────────────────

  it('project_id가 UUID 형식이 아니면 → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, project_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('잘못된 요청')
  })

  it('platform이 유효하지 않으면 → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, platform: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('project_id 누락 → 400', async () => {
    const res = await POST(makeRequest({ platform: 'bookk' }))
    expect(res.status).toBe(400)
  })

  // ── Inngest 이벤트 발행 ─────────────────────────────────────────

  it('정상 요청 시 file/docx.requested 이벤트를 발행한다', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'file/docx.requested',
        data: expect.objectContaining({
          project_id: VALID_PROJECT_ID,
          platform: 'bookk',
          include_cover: false,
        }),
      }),
    )
  })

  it('Inngest 이벤트 data에 user_id가 포함된다', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: 'user-uuid-001' }),
      }),
    )
  })

  it('응답에 estimated_seconds가 포함된다', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(typeof body.data.estimated_seconds).toBe('number')
  })
})
