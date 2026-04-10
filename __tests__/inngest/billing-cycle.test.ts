/**
 * inngest/billing-cycle.ts 테스트
 *
 * 검증 항목:
 *  - 결제 대상 없음 → { success: true, processed: 0 }
 *  - 결제 성공 → next_billing_at +1개월 업데이트
 *  - 1차 실패 (daysSinceDue < 3) → next_billing_at = 내일, 구독 유지
 *  - 3일 연속 실패 (daysSinceDue >= 3) → subscription.status='expired', user.plan='free'
 *  - 3일 연속 실패 → 결제 실패 이메일 발송
 *  - DB 조회 실패 → Error throw
 *
 * 모킹:
 *  - @/inngest/client → createFunction 핸들러를 vi.hoisted()로 캡처
 *  - @/lib/supabase-server → createServiceClient (체이닝 mock)
 *  - @/lib/toss-payments → chargeBilling, generateOrderId, TossPaymentsError
 *  - @/lib/email → sendBillingFailedEmail
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── vi.hoisted: createFunction 핸들러 캡처 ──────────────────────────────────

const handlerRef = vi.hoisted(() => ({
  fn: null as ((ctx: { step: unknown }) => Promise<unknown>) | null,
}))

// ── 모킹 (호이스팅) ──────────────────────────────────────────────────────────

vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: (
      _opts: unknown,
      _trigger: unknown,
      handler: (ctx: { step: unknown }) => Promise<unknown>,
    ) => {
      handlerRef.fn = handler
      return {}
    },
  },
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/toss-payments', () => {
  class TossPaymentsError extends Error {
    code: string
    statusCode: number
    constructor(message: string, code: string, statusCode: number) {
      super(message)
      this.name = 'TossPaymentsError'
      this.code = code
      this.statusCode = statusCode
    }
  }
  return {
    chargeBilling: vi.fn(),
    generateOrderId: vi.fn().mockReturnValue('CYCLE-TEST-001'),
    TossPaymentsError,
  }
})

vi.mock('@/lib/email', () => ({
  sendBillingFailedEmail: vi.fn(),
}))

// 모킹 이후 임포트 (임포트 시 createFunction 호출 → handlerRef.fn 등록됨)
import '@/inngest/billing-cycle'
import { createServiceClient } from '@/lib/supabase-server'
import { chargeBilling, TossPaymentsError } from '@/lib/toss-payments'
import { sendBillingFailedEmail } from '@/lib/email'

// ── 타입 ─────────────────────────────────────────────────────────

interface SubscriptionRow {
  id: string
  user_id: string
  toss_billing_key: string
  plan: string
  amount: number
  next_billing_at: string
}

// ── 헬퍼 ─────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function makeSubscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub-uuid-001',
    user_id: 'user-uuid-001',
    toss_billing_key: 'billing-key-xxx',
    plan: 'basic',
    amount: 9_900,
    next_billing_at: new Date().toISOString(),
    ...overrides,
  }
}

/** step.run(name, fn) → fn() 즉시 실행 */
function makeStep() {
  return {
    run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  }
}

function makeSupabase(
  subscriptions: SubscriptionRow[],
  fetchError: { message: string } | null = null,
  userEmail = 'user@example.com',
) {
  // 구독 목록 조회: .select().eq('status','active').lte('next_billing_at', now)
  const fetchLte = vi.fn().mockResolvedValue({
    data: fetchError ? null : subscriptions,
    error: fetchError,
  })
  const fetchEq = vi.fn().mockReturnValue({ lte: fetchLte })
  const subsFetchSelect = vi.fn().mockReturnValue({ eq: fetchEq })

  // update: .update({...}).eq('id', sub.id)
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  // users select (sendBillingFailedEmailForUser): .select('email, name').eq('id',...).single()
  const userSingle = vi.fn().mockResolvedValue({
    data: { email: userEmail, name: '테스터' },
    error: null,
  })
  const usersEq = vi.fn().mockReturnValue({ single: userSingle })
  const usersSelect = vi.fn().mockReturnValue({ eq: usersEq })

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return { select: subsFetchSelect, update }
      }
      if (table === 'users') {
        return { select: usersSelect, update }
      }
      return {}
    }),
    _update: update,
    _updateEq: updateEq,
  }
}

async function runHandler(step = makeStep()) {
  return handlerRef.fn!({ step })
}

// ── 테스트 ────────────────────────────────────────────────────────

describe('billingCycleJob', () => {
  let mockSupabase: ReturnType<typeof makeSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SECRET_RESEND_API_KEY = 'test-resend-key'
    mockSupabase = makeSupabase([])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(chargeBilling).mockResolvedValue({ status: 'DONE', paymentKey: 'pk-test-001' } as never)
    vi.mocked(sendBillingFailedEmail).mockResolvedValue(undefined)
  })

  // ── 핸들러 등록 ───────────────────────────────────────────────────

  it('모듈 임포트 시 createFunction 핸들러가 등록된다', () => {
    expect(handlerRef.fn).not.toBeNull()
    expect(typeof handlerRef.fn).toBe('function')
  })

  // ── 결제 대상 없음 ─────────────────────────────────────────────

  it('결제 대상 구독이 없으면 processed: 0을 반환한다', async () => {
    mockSupabase = makeSupabase([])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    const result = await runHandler()
    expect(result).toMatchObject({ success: true, processed: 0 })
  })

  // ── 결제 성공 ─────────────────────────────────────────────────

  it('결제 성공 시 next_billing_at을 +1개월로 업데이트한다', async () => {
    const sub = makeSubscription()
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)

    await runHandler()

    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ next_billing_at: expect.any(String) }),
    )
    // 업데이트된 날짜가 현재보다 미래여야 함
    const updateArg = mockSupabase._update.mock.calls[0]?.[0] as { next_billing_at: string }
    expect(new Date(updateArg.next_billing_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('결제 성공 시 chargeBilling에 billingKey, amount, orderId가 전달된다', async () => {
    const sub = makeSubscription({ toss_billing_key: 'bkey-xyz', plan: 'pro', amount: 19_900 })
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)

    await runHandler()

    expect(chargeBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        billingKey: 'bkey-xyz',
        amount: 19_900,
        orderId: expect.any(String),
      }),
    )
  })

  it('결제 성공 시 구독 만료 처리를 하지 않는다', async () => {
    const sub = makeSubscription()
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)

    await runHandler()

    expect(mockSupabase._update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
    )
  })

  // ── 1차 결제 실패 (재시도 예약) ─────────────────────────────────

  it('첫 실패 (daysSinceDue < 3) → next_billing_at을 내일로 업데이트한다', async () => {
    // next_billing_at = 1일 전 → daysSinceDue = 1 < 3
    const sub = makeSubscription({ next_billing_at: daysAgo(1) })
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(chargeBilling).mockRejectedValue(
      new TossPaymentsError('카드 한도 초과', 'EXCEED_LIMIT', 400),
    )

    await runHandler()

    // status='expired' 업데이트가 없어야 함
    expect(mockSupabase._update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
    )
    // next_billing_at 재설정은 있어야 함
    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ next_billing_at: expect.any(String) }),
    )
  })

  it('첫 실패 시 결제 실패 이메일을 발송하지 않는다', async () => {
    const sub = makeSubscription({ next_billing_at: daysAgo(1) })
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(chargeBilling).mockRejectedValue(
      new TossPaymentsError('카드 오류', 'CARD_ERROR', 400),
    )

    await runHandler()

    expect(sendBillingFailedEmail).not.toHaveBeenCalled()
  })

  // ── 3일 연속 실패 (최종 만료) ─────────────────────────────────

  it('3일 연속 실패 (daysSinceDue >= 3) → subscription.status를 expired로 업데이트한다', async () => {
    // next_billing_at = 4일 전 → daysSinceDue = 4 >= 3
    const sub = makeSubscription({ next_billing_at: daysAgo(4) })
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(chargeBilling).mockRejectedValue(
      new TossPaymentsError('결제 실패', 'PAYMENT_FAILED', 400),
    )

    await runHandler()

    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'expired',
        cancelled_at: expect.any(String),
      }),
    )
  })

  it('3일 연속 실패 → user.plan을 free로 다운그레이드한다', async () => {
    const sub = makeSubscription({ next_billing_at: daysAgo(4) })
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(chargeBilling).mockRejectedValue(
      new TossPaymentsError('결제 실패', 'PAYMENT_FAILED', 400),
    )

    await runHandler()

    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free', plan_expires_at: null }),
    )
  })

  it('3일 연속 실패 → sendBillingFailedEmail을 호출한다', async () => {
    const sub = makeSubscription({ next_billing_at: daysAgo(4) })
    mockSupabase = makeSupabase([sub], null, 'user@example.com')
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(chargeBilling).mockRejectedValue(
      new TossPaymentsError('결제 실패', 'PAYMENT_FAILED', 400),
    )

    await runHandler()

    expect(sendBillingFailedEmail).toHaveBeenCalledWith('user@example.com', expect.any(String))
  })

  it('3일 연속 실패 시 daysSinceDue가 정확히 3이어도 만료 처리한다', async () => {
    const sub = makeSubscription({ next_billing_at: daysAgo(3) })
    mockSupabase = makeSupabase([sub])
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(chargeBilling).mockRejectedValue(
      new TossPaymentsError('결제 실패', 'PAYMENT_FAILED', 400),
    )

    await runHandler()

    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
    )
  })

  // ── DB 조회 실패 ──────────────────────────────────────────────

  it('구독 조회 DB 오류 → Error throw', async () => {
    mockSupabase = makeSupabase([], { message: '구독 조회 실패' })
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)

    await expect(runHandler()).rejects.toThrow('구독 조회 실패')
  })
})
