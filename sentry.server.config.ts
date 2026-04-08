/**
 * Sentry 서버(Node.js) 설정
 * API Route / Server Component 에러 추적
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  // 민감 정보 필터링
  beforeSend(event) {
    // 이메일 주소 마스킹
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      if (typeof data.email === 'string') {
        data.email = data.email.replace(/(.{2}).+(@.+)/, '$1***$2')
      }
    }

    // Authorization 헤더 제거
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>
      delete headers['authorization']
      delete headers['x-api-key']
      delete headers['cookie']
    }

    return event
  },

  // 개발 환경에서는 비활성화
  enabled: process.env.NODE_ENV === 'production',
})
