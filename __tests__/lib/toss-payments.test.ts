/**
 * lib/toss-payments.ts 테스트
 *
 * 검증 항목:
 *  - generateOrderId: 'POD-' 접두사, 커스텀 접두사, 고유성, 길이 범위
 *  - TossPaymentsError: code / statusCode / message / name / instanceof
 *
 * fetch 의존 함수(confirmBillingAuth, chargeBilling, getPayment)는
 * vi.stubGlobal('fetch', ...) 패턴으로 테스트합니다.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  generateOrderId,
  TossPaymentsError,
  confirmBillingAuth,
  chargeBilling,
} from '@/lib/toss-payments'

// ── generateOrderId ───────────────────────────────────────────────────────────

describe('generateOrderId', () => {
  it("기본 접두사 'POD-'로 시작한다", () => {
    expect(generateOrderId()).toMatch(/^POD-/)
  })

  it('커스텀 접두사를 사용할 수 있다', () => {
    expect(generateOrderId('SUB')).toMatch(/^SUB-/)
    expect(generateOrderId('ORD')).toMatch(/^ORD-/)
  })

  it('토스 orderId 조건: 6-64자 범위', () => {
    const id = generateOrderId()
    expect(id.length).toBeGreaterThanOrEqual(6)
    expect(id.length).toBeLessThanOrEqual(64)
  })

  it('연속 100회 생성 시 모두 고유하다 (충돌 없음)', () => {
    const ids = Array.from({ length: 100 }, () => generateOrderId())
    expect(new Set(ids).size).toBe(100)
  })

  it('영숫자와 하이픈만 포함한다', () => {
    // 토스 orderId 허용 문자: 영문 대소문자, 숫자, 특수문자(-_.)
    const id = generateOrderId()
    expect(id).toMatch(/^[A-Z0-9-]+$/)
  })
})

// ── TossPaymentsError ─────────────────────────────────────────────────────────

describe('TossPaymentsError', () => {
  it('code와 statusCode를 올바르게 저장한다', () => {
    const err = new TossPaymentsError('INVALID_CARD', '카드 정보 오류', 400)

    expect(err.code).toBe('INVALID_CARD')
    expect(err.statusCode).toBe(400)
  })

  it('message를 올바르게 저장한다', () => {
    const err = new TossPaymentsError('NOT_FOUND_PAYMENT', '결제 내역 없음', 404)
    expect(err.message).toBe('결제 내역 없음')
  })

  it('name이 "TossPaymentsError"다', () => {
    const err = new TossPaymentsError('ERR', '오류', 500)
    expect(err.name).toBe('TossPaymentsError')
  })

  it('Error의 인스턴스다', () => {
    const err = new TossPaymentsError('ERR', '오류', 500)
    expect(err).toBeInstanceOf(Error)
  })

  it('TossPaymentsError의 인스턴스다', () => {
    const err = new TossPaymentsError('ERR', '오류', 500)
    expect(err).toBeInstanceOf(TossPaymentsError)
  })

  it('다양한 statusCode를 올바르게 담는다', () => {
    const cases: Array<[string, number]> = [
      ['FORBIDDEN', 403],
      ['NOT_FOUND_PAYMENT', 404],
      ['INVALID_REQUEST', 400],
      ['INTERNAL_SERVER_ERROR', 500],
    ]
    for (const [code, statusCode] of cases) {
      const err = new TossPaymentsError(code, '메시지', statusCode)
      expect(err.code).toBe(code)
      expect(err.statusCode).toBe(statusCode)
    }
  })
})

// ── fetch를 사용하는 함수 (vi.stubGlobal) ────────────────────────────────────

describe('confirmBillingAuth', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    process.env.SECRET_TOSS_SECRET_KEY = 'test_secret_key'
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    delete process.env.SECRET_TOSS_SECRET_KEY
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('성공 응답 시 billingKey를 반환한다', async () => {
    const mockBillingKey: Record<string, string> = {
      billingKey: 'billing_test_abc123',
      customerKey: 'customer-uuid',
      authenticatedAt: '2026-04-09T00:00:00Z',
      method: '카드',
    }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockBillingKey,
    })

    const result = await confirmBillingAuth('auth_key_123', 'customer-uuid')
    expect(result.billingKey).toBe('billing_test_abc123')
  })

  it('실패 응답 시 TossPaymentsError를 throw한다', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'INVALID_CARD_EXPIRY_YEAR', message: '카드 유효기간 오류' }),
    })

    await expect(
      confirmBillingAuth('bad_auth_key', 'customer-uuid'),
    ).rejects.toThrow(TossPaymentsError)
  })

  it('실패 응답의 code/statusCode가 올바르다', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ code: 'INVALID_CARD_EXPIRY_YEAR', message: '카드 유효기간 오류' }),
    })

    try {
      await confirmBillingAuth('bad_auth_key', 'customer-uuid')
      expect.fail('에러가 발생해야 합니다')
    } catch (err) {
      expect(err).toBeInstanceOf(TossPaymentsError)
      expect((err as TossPaymentsError).code).toBe('INVALID_CARD_EXPIRY_YEAR')
      expect((err as TossPaymentsError).statusCode).toBe(422)
    }
  })
})

describe('chargeBilling', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    process.env.SECRET_TOSS_SECRET_KEY = 'test_secret_key'
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    delete process.env.SECRET_TOSS_SECRET_KEY
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('성공 응답 시 paymentKey를 반환한다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentKey: 'pay_key_test',
        orderId: 'POD-XXXXX-YYYYY',
        orderName: 'Pro 플랜',
        status: 'DONE',
        totalAmount: 19900,
        requestedAt: '2026-04-09T00:00:00Z',
        approvedAt: '2026-04-09T00:00:01Z',
        balanceAmount: 19900,
        method: '카드',
        currency: 'KRW',
      }),
    })

    const result = await chargeBilling({
      billingKey: 'billing_key',
      customerKey: 'cust_key',
      amount: 19900,
      orderId: generateOrderId(),
      orderName: 'Pro 플랜',
    })

    expect(result.paymentKey).toBe('pay_key_test')
    expect(result.status).toBe('DONE')
  })

  it('청구 실패 시 TossPaymentsError를 throw한다', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'EXCEED_MAX_CARD_INSTALLMENT_PLAN', message: '한도 초과' }),
    })

    await expect(
      chargeBilling({
        billingKey: 'billing_key',
        customerKey: 'cust_key',
        amount: 19900,
        orderId: generateOrderId(),
        orderName: 'Pro 플랜',
      }),
    ).rejects.toThrow(TossPaymentsError)
  })
})
