/**
 * lib/email.ts — Resend 이메일 발송 공통 헬퍼
 *
 * 모든 Resend 호출은 이 파일을 통해 일원화합니다.
 * 환경변수: SECRET_RESEND_API_KEY, NEXT_PUBLIC_APP_URL
 */

import { Resend } from 'resend'

const FROM = 'Podwrite.ai <noreply@podwrite.ai>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'

const PLAN_DISPLAY: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
}

function getResend(): Resend {
  const key = process.env.SECRET_RESEND_API_KEY
  if (!key) throw new EmailError('SECRET_RESEND_API_KEY 환경변수가 설정되지 않았습니다.')
  return new Resend(key)
}

// ── 공통 HTML 헬퍼 ─────────────────────────────────────────────────────────

function wrapHtml(content: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
  <div style="background: #1e1b4b; padding: 24px 32px;">
    <span style="color: white; font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">Podwrite.ai</span>
  </div>
  <div style="padding: 32px;">
    ${content}
  </div>
  <div style="border-top: 1px solid #e5e7eb; padding: 20px 32px; font-size: 12px; color: #6b7280; line-height: 1.6;">
    Podwrite.ai · 한국 독립 작가를 위한 AI 출판 플랫폼<br/>
    문의: <a href="mailto:support@podwrite.ai" style="color: #6b7280;">support@podwrite.ai</a>
  </div>
</div>`
}

function ctaButton(text: string, url: string): string {
  return `<a href="${url}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 16px;">${text}</a>`
}

// ── 회원가입 환영 이메일 ────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const resend = getResend()

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] 환영합니다, ${name}님!`,
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">환영합니다, ${name}님!</h2>
      <p>Podwrite.ai에 가입해 주셔서 감사합니다.<br/>
      AI와 함께하는 글쓰기 여정을 지금 시작해 보세요.</p>
      <h3 style="color: #374151; margin-top: 24px;">주요 기능 안내</h3>
      <ul style="line-height: 2; padding-left: 20px; color: #374151;">
        <li><strong>AI 에디터</strong> — Claude AI와 함께 원고 기획·집필</li>
        <li><strong>맞춤법 교정</strong> — 전문 교정 API 연동</li>
        <li><strong>POD 파일 생성</strong> — DOCX / EPUB 자동 생성 (북크, 교보 규격)</li>
        <li><strong>KDP 글로벌</strong> — 영문 번역 및 Amazon KDP 제출 패키지</li>
      </ul>
      ${ctaButton('대시보드 시작하기', `${APP_URL}/dashboard`)}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        무료 플랜으로 원고 1편, 챕터 3개까지 이용 가능합니다.<br/>
        더 많은 기능은 <a href="${APP_URL}/pricing" style="color: #2563eb;">요금제 페이지</a>에서 확인하세요.
      </p>
    `),
  })
}

// ── 결제 성공 이메일 ────────────────────────────────────────────────────────

export async function sendBillingSuccessEmail(
  to: string,
  name: string,
  plan: string,
  amount: number,
): Promise<void> {
  const resend = getResend()
  const planDisplay = PLAN_DISPLAY[plan] ?? plan.toUpperCase()
  const amountFormatted = amount.toLocaleString('ko-KR')
  const billedAt = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] ${planDisplay} 플랜 결제가 완료되었습니다`,
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">결제 완료 안내</h2>
      <p>안녕하세요, ${name}님. 결제가 정상적으로 처리되었습니다.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <tr style="background: #f9fafb;">
          <td style="padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">플랜</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${planDisplay}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">결제 금액</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">₩${amountFormatted} / 월</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 12px 16px; font-weight: 600;">결제일</td>
          <td style="padding: 12px 16px;">${billedAt}</td>
        </tr>
      </table>
      ${ctaButton('대시보드로 이동', `${APP_URL}/dashboard`)}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        결제 내역은 <a href="${APP_URL}/settings/billing" style="color: #2563eb;">설정 &gt; 결제</a>에서 확인하실 수 있습니다.
      </p>
    `),
  })
}

// ── 결제 실패 재시도 안내 이메일 (1·2차 실패, 재시도 예정) ───────────────────────

export async function sendBillingRetryEmail(
  to: string,
  name: string,
  attempt: number,
  retryDate: Date,
): Promise<void> {
  const resend = getResend()
  const retryDateFormatted = retryDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const remainingAttempts = 3 - attempt

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] 결제 실패 안내 — ${retryDateFormatted}에 재시도됩니다`,
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">결제 실패 안내</h2>
      <p>안녕하세요, ${name}님.</p>
      <p>정기결제 처리 중 오류가 발생했습니다.<br/>
      <strong>${retryDateFormatted}</strong>에 자동으로 재시도합니다.</p>
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; font-size: 14px;">
        남은 재시도 횟수: <strong>${remainingAttempts}회</strong><br/>
        재시도가 모두 실패하면 플랜이 무료로 변경됩니다.
      </div>
      <p style="font-size: 14px; color: #374151;">
        카드 정보를 미리 확인하거나 결제 수단을 변경하시면 재시도 시 정상 처리됩니다.
      </p>
      ${ctaButton('결제 수단 변경하기', `${APP_URL}/settings/billing`)}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        문의사항은 <a href="mailto:support@podwrite.ai" style="color: #2563eb;">support@podwrite.ai</a>로 연락 주세요.
      </p>
    `),
  })
}

// ── 구독 만료 D-7 알림 이메일 ──────────────────────────────────────────────────

export async function sendSubscriptionExpiringEmail(
  to: string,
  name: string,
  plan: string,
  expiresAt: Date,
): Promise<void> {
  const resend = getResend()
  const planDisplay = PLAN_DISPLAY[plan] ?? plan.toUpperCase()
  const expiresFormatted = expiresAt.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] ${planDisplay} 플랜이 7일 후 만료됩니다`,
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">구독 만료 예정 안내</h2>
      <p>안녕하세요, ${name}님.</p>
      <p><strong>${planDisplay} 플랜</strong>이 <strong>${expiresFormatted}</strong>에 만료됩니다.</p>
      <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 20px 0; font-size: 14px; line-height: 1.8;">
        만료 후에도 원고·챕터·다운로드 기능은 <strong>30일간</strong> 유지됩니다.<br/>
        재구독하시면 모든 기능이 즉시 복원됩니다.
      </div>
      ${ctaButton('구독 재시작하기', `${APP_URL}/settings/billing`)}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        이미 구독을 유지 중이시라면 이 이메일을 무시해 주세요.
      </p>
    `),
  })
}

// ── 결제 실패 이메일 (최종 실패, 플랜 다운그레이드) ────────────────────────────

export async function sendBillingFailedEmail(to: string, name: string): Promise<void> {
  const resend = getResend()

  await resend.emails.send({
    from: FROM,
    to,
    subject: '[Podwrite.ai] 결제 실패 안내 — 플랜이 무료로 변경되었습니다',
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">결제 실패 안내</h2>
      <p>안녕하세요, ${name}님.</p>
      <p>월정기결제가 3회 시도 후 최종 실패하여 플랜이 <strong>무료(Free)</strong>로 변경되었습니다.</p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; font-size: 14px;">
        원고, 챕터, 다운로드 기능은 <strong>30일간</strong> 유지됩니다.<br/>
        재구독하시면 즉시 모든 기능이 복원됩니다.
      </div>
      ${ctaButton('재구독하기', `${APP_URL}/settings/billing`)}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        카드 정보 변경 후 재시도하거나, 문의사항은
        <a href="mailto:support@podwrite.ai" style="color: #2563eb;">support@podwrite.ai</a>로 연락 주세요.
      </p>
    `),
  })
}

// ── 비밀번호 재설정 이메일 ─────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = getResend()

  await resend.emails.send({
    from: FROM,
    to,
    subject: '[Podwrite.ai] 비밀번호 재설정 안내',
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">비밀번호 재설정</h2>
      <p>비밀번호 재설정 요청이 접수되었습니다.</p>
      <p>아래 버튼을 클릭하여 새 비밀번호를 설정하세요.<br/>
      링크는 요청 후 <strong>1시간</strong> 동안만 유효합니다.</p>
      ${ctaButton('비밀번호 재설정하기', resetUrl)}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        이 요청을 하지 않으셨다면 이 이메일을 무시하세요.<br/>
        비밀번호는 변경되지 않습니다.
      </p>
    `),
  })
}

// ── 구독 취소 이메일 ────────────────────────────────────────────────────────

export async function sendSubscriptionCancelledEmail(to: string, plan: string): Promise<void> {
  const resend = getResend()
  const planDisplay = PLAN_DISPLAY[plan] ?? plan.toUpperCase()

  await resend.emails.send({
    from: FROM,
    to,
    subject: '[Podwrite.ai] 구독이 취소되었습니다',
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">구독 취소 안내</h2>
      <p><strong>${planDisplay} 플랜</strong> 구독이 취소되었습니다.</p>
      <p>원고, 챕터, 다운로드 기능은 <strong>30일간</strong> 유지됩니다.<br/>
      재구독하시면 모든 기능이 즉시 복원됩니다.</p>
      ${ctaButton('재구독하기', `${APP_URL}/settings/billing`)}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        항상 Podwrite.ai를 이용해 주셔서 감사합니다.
      </p>
    `),
  })
}

// ── 파일 생성 완료 이메일 ──────────────────────────────────────────────────

/**
 * DOCX / EPUB 파일 생성 완료 알림
 *
 * @param to            수신자 이메일
 * @param projectTitle  원고 제목
 * @param fileType      'DOCX' | 'EPUB'
 * @param downloadUrl   서명된 다운로드 URL
 * @param expiresHours  링크 유효 시간 (기본 24)
 */
export async function sendFileReadyEmail(
  to: string,
  projectTitle: string,
  fileType: 'DOCX' | 'EPUB',
  downloadUrl: string,
  expiresHours = 24,
): Promise<void> {
  const resend = getResend()

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] ${fileType} 파일이 준비되었습니다`,
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">${fileType} 파일이 준비되었습니다</h2>
      <p><strong>${projectTitle}</strong> 원고의 ${fileType} 파일 생성이 완료되었습니다.</p>
      ${ctaButton(`${fileType} 파일 다운로드`, downloadUrl)}
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">
        이 링크는 <strong>${expiresHours}시간</strong> 동안 유효합니다.
      </p>
    `),
  })
}

// ── 파일 생성 실패 이메일 ──────────────────────────────────────────────────

/**
 * DOCX / EPUB 파일 생성 실패 알림
 *
 * @param to            수신자 이메일
 * @param projectTitle  원고 제목
 * @param fileType      'DOCX' | 'EPUB'
 */
export async function sendFileFailedEmail(
  to: string,
  projectTitle: string,
  fileType: 'DOCX' | 'EPUB',
): Promise<void> {
  const resend = getResend()

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] ${fileType} 파일 생성에 실패했습니다`,
    html: wrapHtml(`
      <h2 style="margin-top: 0; color: #111827;">${fileType} 파일 생성 실패</h2>
      <p><strong>${projectTitle}</strong> 원고의 ${fileType} 파일 생성 중 오류가 발생했습니다.</p>
      <p style="color: #6b7280;">잠시 후 다시 시도해 주세요. 문제가 지속되면 고객 지원에 문의해 주세요.</p>
      ${ctaButton('대시보드로 이동', `${APP_URL}/dashboard`)}
    `),
  })
}

// ── 에러 클래스 ────────────────────────────────────────────────────────────

export class EmailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailError'
  }
}
