/**
 * Vitest 설정
 *
 * 설치 필요 (npm install -D):
 *   vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
 *
 * 실행:
 *   npm test          — watch 모드
 *   npm run test:ui   — 브라우저 UI
 *   npx vitest run    — CI (단회 실행)
 */
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // API Route·lib 함수는 Node.js 환경에서 실행
    // React 컴포넌트 테스트가 필요한 파일은 파일 상단에
    //   // @vitest-environment jsdom
    // 주석을 추가하면 파일 단위로 환경을 전환할 수 있습니다.
    environment: 'node',

    // describe/it/expect 전역 사용을 원하면 true로 변경하고
    // tsconfig.json compilerOptions.types 에 "vitest/globals" 추가
    globals: false,

    // 테스트 파일 경로 패턴
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],

    // 커버리지 (npx vitest run --coverage 로 실행)
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['lib/supabase*.ts', 'lib/env.ts'],
    },
  },

  resolve: {
    // tsconfig.json의 "@/*" → "./*" 경로 별칭과 동일하게 설정
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
