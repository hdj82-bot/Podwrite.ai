-- Migration: 004_waitlist
-- 베타 테스터 대기자 명단 테이블
--
-- 저장 구조:
--   id         uuid  PK, 자동 생성
--   email      text  UNIQUE — 중복 신청 방지
--   created_at timestamptz 신청 시각 (기본값: now())
--
-- RLS 정책:
--   INSERT — anon·authenticated 모두 허용 (공개 폼에서 이메일 수집)
--   SELECT  — service_role만 허용 (관리자 전용)

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_email_unique UNIQUE (email)
);

COMMENT ON TABLE  public.waitlist           IS '베타 테스터 대기자 이메일 목록';
COMMENT ON COLUMN public.waitlist.email     IS '신청자 이메일 (UNIQUE)';
COMMENT ON COLUMN public.waitlist.created_at IS '신청 시각';

-- ── Row Level Security ───────────────────────────────────────────────

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- INSERT: 누구나 가능 (비회원 포함) — 공개 베타 신청 폼
CREATE POLICY "waitlist_insert_public"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: service_role만 허용 (대시보드·관리자 API에서만 조회)
CREATE POLICY "waitlist_select_service_role"
  ON public.waitlist
  FOR SELECT
  TO service_role
  USING (true);
