import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // docx, jszip는 Node.js 전용 모듈 — Edge/클라이언트 번들에서 제외
  serverExternalPackages: ['docx', 'jszip'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // 대용량 파일 업로드(10MB)와 Inngest 웹훅 페이로드 허용
  // ※ Next.js 14 App Router에서는 route.ts 내 maxDuration으로 대체
  //   실제 body 크기 제한은 vercel.json의 maxDuration으로 관리
}

export default withSentryConfig(nextConfig, {
  // Sentry 조직/프로젝트 (소스맵 업로드)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 빌드 로그 최소화
  silent: !process.env.CI,

  // 소스맵: 업로드 후 클라이언트 번들에서 제거
  widenClientFileUpload: true,
  hideSourceMaps: true,

  // 빌드 타임 Sentry CLI 로거 비활성화
  disableLogger: true,

  // Tunnel Route: 광고 차단기 우회 (선택 사항)
  // tunnelRoute: '/monitoring-tunnel',

  // 자동 계측 비활성화 옵션
  // autoInstrumentServerFunctions: false,
})
