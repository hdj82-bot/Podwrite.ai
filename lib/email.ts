/**
 * lib/email.ts — Resend 이메일 발송 공통 헬퍼
 *
 * 모든 Resend 호출은 이 파일을 통해 일원화합니다.
 * 호출 측에서 API 키 유무를 신경 쓸 필요 없습니다 (키 없으면 조용히 스킵).
 */

import { Resend } from 'resend'

const FROM = 'Podwrite.ai <noreply@podwrite.ai>'
const SUPPORT = 'support@podwrite.ai'

function getResend(): Resend | null {
  const key = process.env.SECRET_RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'
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
  if (!resend) return

  const base = appUrl()

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] ${fileType} 파일이 준비되었습니다`,
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #111827;">${fileType} 파일이 준비되었습니다</h2>
  <p>안녕하세요.</p>
  <p><strong>${projectTitle}</strong> 원고의 ${fileType} 파일 생성이 완료되었습니다.</p>
  <a href="${downloadUrl}"
     style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
    ${fileType} 파일 다운로드
  </a>
  <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
    이 링크는 <strong>${expiresHours}시간</strong> 동안 유효합니다.
  </p>
  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    <a href="${base}" style="color: #888;">Podwrite.ai</a> | 문의: ${SUPPORT}
  </p>
</div>`,
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
  if (!resend) return

  const base = appUrl()

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Podwrite.ai] ${fileType} 파일 생성에 실패했습니다`,
    html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #111827;">${fileType} 파일 생성 실패</h2>
  <p>안녕하세요.</p>
  <p><strong>${projectTitle}</strong> 원고의 ${fileType} 파일 생성 중 오류가 발생했습니다.</p>
  <p>잠시 후 다시 시도해 주세요. 문제가 지속되면 고객 지원에 문의해 주세요.</p>
  <a href="${base}/dashboard"
     style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
    대시보드로 이동
  </a>
  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    <a href="${base}" style="color: #888;">Podwrite.ai</a> | 문의: ${SUPPORT}
  </p>
</div>`,
  })
}
