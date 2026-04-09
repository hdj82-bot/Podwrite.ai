/**
 * lib/email.ts 테스트
 *
 * 검증 항목:
 *  - sendWelcomeEmail: Resend.emails.send 호출 인자 (from / to / subject)
 *  - sendBillingFailedEmail: Resend.emails.send 호출 인자
 *  - SECRET_RESEND_API_KEY 누락 시 EmailError throw
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Resend } from 'resend'

// ── Resend 모킹 ──────────────────────────────────────────────────────────────
// vi.mock은 호이스팅되므로 import 순서와 무관하게 먼저 적용됩니다.
vi.mock('resend', () => ({
  Resend: vi.fn(),
}))

// 모킹 이후 실제 테스트 대상 임포트
import { sendWelcomeEmail, sendBillingFailedEmail, EmailError } from '@/lib/email'

// ── 공통 setUp ───────────────────────────────────────────────────────────────

describe('lib/email', () => {
  const mockSend = vi.fn()

  beforeEach(() => {
    // 테스트마다 환경변수 설정 및 Resend mock 초기화
    process.env.SECRET_RESEND_API_KEY = 'test-resend-key-xxxx'
    vi.mocked(Resend).mockImplementation(
      () => ({ emails: { send: mockSend } }) as unknown as Resend,
    )
    mockSend.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null })
  })

  afterEach(() => {
    delete process.env.SECRET_RESEND_API_KEY
    vi.clearAllMocks()
  })

  // ── sendWelcomeEmail ────────────────────────────────────────────────────────

  describe('sendWelcomeEmail', () => {
    it('Resend.emails.send를 정확히 1회 호출한다', async () => {
      await sendWelcomeEmail('user@example.com', '홍길동')
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('from이 Podwrite.ai 발신 주소다', async () => {
      await sendWelcomeEmail('user@example.com', '홍길동')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Podwrite.ai <noreply@podwrite.ai>',
        }),
      )
    })

    it('to가 인자로 받은 이메일과 일치한다', async () => {
      await sendWelcomeEmail('writer@test.com', '홍길동')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'writer@test.com' }),
      )
    })

    it('subject에 수신자 이름이 포함된다', async () => {
      await sendWelcomeEmail('user@example.com', '김철수')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('김철수'),
        }),
      )
    })
  })

  // ── sendBillingFailedEmail ─────────────────────────────────────────────────

  describe('sendBillingFailedEmail', () => {
    it('Resend.emails.send를 정확히 1회 호출한다', async () => {
      await sendBillingFailedEmail('billing@example.com', '이영희')
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('from이 Podwrite.ai 발신 주소다', async () => {
      await sendBillingFailedEmail('billing@example.com', '이영희')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Podwrite.ai <noreply@podwrite.ai>',
        }),
      )
    })

    it('to가 인자로 받은 이메일과 일치한다', async () => {
      await sendBillingFailedEmail('pay@test.com', '이영희')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'pay@test.com' }),
      )
    })

    it('subject에 "결제 실패" 문자열이 포함된다', async () => {
      await sendBillingFailedEmail('billing@example.com', '이영희')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('결제 실패'),
        }),
      )
    })
  })

  // ── SECRET_RESEND_API_KEY 누락 ──────────────────────────────────────────────

  describe('SECRET_RESEND_API_KEY가 없을 때', () => {
    it('sendWelcomeEmail 호출 시 EmailError를 throw한다', async () => {
      delete process.env.SECRET_RESEND_API_KEY
      await expect(
        sendWelcomeEmail('user@example.com', '홍길동'),
      ).rejects.toThrow(EmailError)
    })

    it('sendBillingFailedEmail 호출 시 EmailError를 throw한다', async () => {
      delete process.env.SECRET_RESEND_API_KEY
      await expect(
        sendBillingFailedEmail('user@example.com', '홍길동'),
      ).rejects.toThrow(EmailError)
    })

    it('throw된 에러의 name이 "EmailError"다', async () => {
      delete process.env.SECRET_RESEND_API_KEY
      try {
        await sendWelcomeEmail('user@example.com', '홍길동')
        expect.fail('에러가 발생해야 합니다')
      } catch (err) {
        expect(err).toBeInstanceOf(EmailError)
        expect((err as EmailError).name).toBe('EmailError')
      }
    })

    it('Resend.emails.send는 호출되지 않는다', async () => {
      delete process.env.SECRET_RESEND_API_KEY
      try {
        await sendWelcomeEmail('user@example.com', '홍길동')
      } catch {
        // 에러 무시 — send 호출 여부만 확인
      }
      expect(mockSend).not.toHaveBeenCalled()
    })
  })
})
