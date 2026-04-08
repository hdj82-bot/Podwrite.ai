-- Migration: 001_add_kdp_metadata
-- KDP 메타데이터 JSONB 컬럼 추가
--
-- 저장 구조 (참고):
--   {
--     title: string,
--     subtitle: string,
--     author: string,
--     bisac_codes: string[],   -- 최대 2개
--     keywords: string[],      -- 최대 7개
--     description: string,     -- HTML 허용
--     language: string,        -- ISO 639-1 (en, ko, ja, ...)
--     price_usd: number,
--     saved_at: string         -- ISO 8601
--   }

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS kdp_metadata JSONB;

-- GIN 인덱스: kdp_metadata 내부 키로 빠른 검색 지원
CREATE INDEX IF NOT EXISTS idx_projects_kdp_metadata
  ON public.projects USING GIN (kdp_metadata);

COMMENT ON COLUMN public.projects.kdp_metadata IS
  'Amazon KDP 출판용 영문 메타데이터 (title, subtitle, author, bisac_codes, keywords, description, language, price_usd)';
