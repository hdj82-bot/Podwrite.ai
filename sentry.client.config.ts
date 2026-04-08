/**
 * Sentry 클라이언트 설정
 * 브라우저 환경 에러 추적 + Session Replay
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 트레이스 샘플링: 10% (비용 절감)
  tracesSampleRate: 0.1,

  // Session Replay
  replaysOnErrorSampleRate: 1.0,   // 에러 발생 세션 100% 기록
  replaysSessionSampleRate: 0.05,  // 일반 세션 5% 샘플링

  integrations: [
    Sentry.replayIntegration({
      // 결제/원고 내용 마스킹 (개인정보 보호)
      maskAllText: false,
      maskAllInputs: true,   // 입력 필드 마스킹
      blockAllMedia: false,
    }),
  ],

  // 무시할 에러 패턴
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed',
    /^ChunkLoadError/,
    'Network request failed',
  ],

  // 개발 환경에서는 비활성화
  enabled: process.env.NODE_ENV === 'production',
})
