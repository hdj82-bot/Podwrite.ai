/**
 * Inngest 클라이언트 & 함수 레지스트리
 *
 * API Route: app/api/inngest/route.ts 에서 serve() 호출
 *
 * 환경변수:
 *   SECRET_INNGEST_SIGNING_KEY — 프로덕션 서명 검증 (server-only)
 *   INNGEST_DEV — 'true' 시 로컬 devserver 모드
 */

import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'podwrite-ai',
  signingKey: process.env.SECRET_INNGEST_SIGNING_KEY,
})

// ── 이벤트 타입 정의 ───────────────────────────────────────────────────
// inngest/generate-docx.ts, generate-epub.ts, translate.ts, billing-cycle.ts
// 에서 참조하는 이벤트 스키마

export type PodwriteEvents = {
  // DOCX 생성
  'file/docx.requested': {
    data: {
      project_id: string
      user_id: string
      platform: 'bookk' | 'kyobo' | 'kdp'
      include_cover: boolean
    }
  }
  // EPUB 생성
  'file/epub.requested': {
    data: {
      project_id: string
      user_id: string
      language: 'ko' | 'en'
      include_toc: boolean
    }
  }
  // 번역
  'file/translate.requested': {
    data: {
      project_id: string
      user_id: string
      chapter_ids: string[] // 빈 배열 = 전체 챕터
    }
  }
  // 월 정기결제 크론 (스케줄러가 발생시킴)
  'billing/cycle.trigger': {
    data: Record<string, never>
  }
  // 원고 진단 비동기 분석
  'diagnostic/analyze': {
    data: {
      diagnosticId: string
      textContent: string
      wordCount: number
      fileName: string
    }
  }
  // KDP 제출 패키지 생성
  'kdp/package.requested': {
    data: {
      project_id: string
      user_id: string
      metadata?: {
        title?: string
        subtitle?: string
        author?: string
        bisac_codes?: string[]
        bisac_code?: string
        bisac_label?: string
        keywords?: string[]
        description?: string
        language?: string
        price_usd?: number
        ai_disclosure?: string
      }
    }
  }
}
