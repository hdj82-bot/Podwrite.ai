/**
 * Sentry Edge Runtime 설정
 * middleware.ts 및 Edge API Route 에러 추적
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Edge는 런타임 제약으로 샘플링을 낮게 유지
  tracesSampleRate: 0.05,

  enabled: process.env.NODE_ENV === 'production',
})
