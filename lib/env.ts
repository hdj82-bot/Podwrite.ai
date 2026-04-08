/**
 * 필수 환경변수 유효성 검증
 *
 * app/layout.tsx 서버 컴포넌트에서 호출 → 빌드/시작 시 즉시 감지
 *
 * ※ 변수명은 각 lib/* 파일의 실제 사용 이름과 일치해야 합니다.
 *   변경 시 lib/claude.ts, lib/toss-payments.ts 등도 함께 확인하세요.
 */

// ── 서버 전용 필수 변수 ────────────────────────────────────────────────

const SERVER_REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',          // lib/supabase.ts, lib/supabase-server.ts
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',     // lib/supabase.ts
  'SUPABASE_SERVICE_ROLE_KEY',         // lib/supabase-server.ts (RLS 우회)
  'ANTHROPIC_API_KEY',                 // lib/claude.ts
  'PERPLEXITY_API_KEY',               // lib/perplexity.ts
  'SECRET_TOSS_SECRET_KEY',           // lib/toss-payments.ts
  'UPSTASH_REDIS_REST_URL',           // lib/rate-limit.ts (@upstash/redis)
  'UPSTASH_REDIS_REST_TOKEN',         // lib/rate-limit.ts
  'SECRET_INNGEST_SIGNING_KEY',       // inngest/client.ts
] as const

// ── 선택적 변수 (없으면 경고만) ────────────────────────────────────────

const OPTIONAL_WITH_WARN = [
  'SECRET_RESEND_API_KEY',            // inngest/billing-cycle.ts (이메일 없으면 메일 미발송)
  'NEXT_PUBLIC_SENTRY_DSN',           // sentry.client.config.ts
  'SENTRY_AUTH_TOKEN',                // 소스맵 업로드 (CI에서만 필요)
  'NEXT_PUBLIC_TOSS_CLIENT_KEY',      // BillingForm.tsx
  'NEXT_PUBLIC_APP_URL',              // 리다이렉트 URL (없으면 origin 사용)
] as const

// ── 검증 함수 ──────────────────────────────────────────────────────────

/**
 * 필수 환경변수 검증 — 누락 시 즉시 에러 throw
 *
 * app/layout.tsx (서버 컴포넌트)에서 호출:
 *   import { validateEnv } from '@/lib/env'
 *   validateEnv()
 */
export function validateEnv(): void {
  // 클라이언트 번들에서 실행되면 skip (NEXT_PUBLIC_* 만 가능)
  if (typeof window !== 'undefined') return

  const missing = SERVER_REQUIRED.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `[Podwrite.ai] 필수 환경변수 누락:\n${missing.map((k) => `  • ${k}`).join('\n')}\n\n` +
      `Vercel 대시보드 또는 .env.local 파일에 위 변수를 추가하세요.`,
    )
  }

  // 선택적 변수 경고
  if (process.env.NODE_ENV === 'development') {
    const missingOptional = OPTIONAL_WITH_WARN.filter((key) => !process.env[key])
    if (missingOptional.length > 0) {
      console.warn(
        `[Podwrite.ai] 선택적 환경변수 미설정 (일부 기능 제한):\n${missingOptional.map((k) => `  • ${k}`).join('\n')}`,
      )
    }
  }
}

/**
 * 특정 환경변수 값 반환 — 서버 전용
 * 없으면 에러 (런타임 조기 실패)
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`[Podwrite.ai] 환경변수 없음: ${key}`)
  return value
}
