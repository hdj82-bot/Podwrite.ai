/**
 * 토스페이먼츠 서버 클라이언트
 *
 * 사용하는 환경변수:
 *   SECRET_TOSS_SECRET_KEY — 토스 시크릿 키 (server-only)
 *   NEXT_PUBLIC_TOSS_CLIENT_KEY — 클라이언트 키 (브라우저용)
 *
 * 주요 기능:
 *   - 빌링키 발급 확인 (authKey → billingKey)
 *   - 자동결제 청구
 *   - 웹훅 서명 검증
 */

const TOSS_BASE_URL = 'https://api.tosspayments.com'

function getTossAuth(): string {
  const secretKey = process.env.SECRET_TOSS_SECRET_KEY
  if (!secretKey) throw new Error('SECRET_TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.')
  return 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
}

// ── 타입 ──────────────────────────────────────────────────────────────

export interface TossBillingKeyResponse {
  billingKey: string
  customerKey: string
  authenticatedAt: string
  method: string
  card?: {
    issuerCode: string
    acquirerCode: string
    number: string // 마스킹됨
    cardType: string
    ownerType: string
  }
}

export interface TossPaymentResponse {
  paymentKey: string
  orderId: string
  orderName: string
  status: 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED'
  requestedAt: string
  approvedAt: string
  totalAmount: number
  balanceAmount: number
  method: string
  currency: string
  card?: {
    number: string
    installmentPlanMonths: number
    isInterestFree: boolean
  }
}

export interface TossWebhookPayload {
  eventType: 'PAYMENT_STATUS_CHANGED' | 'BILLING_STATUS_CHANGED'
  createdAt: string
  data: {
    paymentKey?: string
    orderId?: string
    status?: string
    billingKey?: string
  }
}

export interface TossErrorResponse {
  code: string
  message: string
}

// ── 빌링키 발급 ───────────────────────────────────────────────────────

/**
 * authKey를 billingKey로 교환 (카드 등록 완료 단계)
 * POST /v1/billing/authorizations/confirm
 */
export async function confirmBillingAuth(
  authKey: string,
  customerKey: string,
): Promise<TossBillingKeyResponse> {
  const res = await fetch(`${TOSS_BASE_URL}/v1/billing/authorizations/confirm`, {
    method: 'POST',
    headers: {
      Authorization: getTossAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authKey, customerKey }),
  })

  const json = await res.json()

  if (!res.ok) {
    const err = json as TossErrorResponse
    throw new TossPaymentsError(err.code, err.message, res.status)
  }

  return json as TossBillingKeyResponse
}

// ── 자동결제 청구 ─────────────────────────────────────────────────────

export interface BillingChargeParams {
  billingKey: string
  customerKey: string
  amount: number
  orderId: string
  orderName: string
  customerEmail?: string
  customerName?: string
}

/**
 * 빌링키로 자동결제 청구
 * POST /v1/billing/{billingKey}
 */
export async function chargeBilling(params: BillingChargeParams): Promise<TossPaymentResponse> {
  const { billingKey, ...body } = params

  const res = await fetch(`${TOSS_BASE_URL}/v1/billing/${billingKey}`, {
    method: 'POST',
    headers: {
      Authorization: getTossAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()

  if (!res.ok) {
    const err = json as TossErrorResponse
    throw new TossPaymentsError(err.code, err.message, res.status)
  }

  return json as TossPaymentResponse
}

// ── 결제 조회 ──────────────────────────────────────────────────────────

/**
 * paymentKey로 결제 상세 조회
 * GET /v1/payments/{paymentKey}
 */
export async function getPayment(paymentKey: string): Promise<TossPaymentResponse> {
  const res = await fetch(`${TOSS_BASE_URL}/v1/payments/${paymentKey}`, {
    headers: { Authorization: getTossAuth() },
  })

  const json = await res.json()

  if (!res.ok) {
    const err = json as TossErrorResponse
    throw new TossPaymentsError(err.code, err.message, res.status)
  }

  return json as TossPaymentResponse
}

// ── 웹훅 서명 검증 ────────────────────────────────────────────────────

/**
 * 토스페이먼츠 웹훅 페이로드 서명 검증
 * X-Toss-Signature 헤더를 HMAC-SHA256으로 검증
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const secretKey = process.env.SECRET_TOSS_SECRET_KEY
  if (!secretKey) return false

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const computedSig = Buffer.from(signatureBuffer).toString('base64')
    return computedSig === signature
  } catch {
    return false
  }
}

// ── orderId 생성 ──────────────────────────────────────────────────────

/** 토스 주문 ID 생성 (6-64자 영숫자·특수문자) */
export function generateOrderId(prefix: string = 'POD'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

// ── 에러 클래스 ────────────────────────────────────────────────────────

export class TossPaymentsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'TossPaymentsError'
  }
}
