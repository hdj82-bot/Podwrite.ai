-- ============================================================
-- Migration 003: writing_logs — 일별 집필량 추적
-- 스펙 4.8: 스트릭 카운터 + 30일 집필량 그래프용 데이터
-- ============================================================

-- ── 테이블 ────────────────────────────────────────────────────
-- user_id + log_date 복합 PK (날짜당 1행, 중복 없음)
CREATE TABLE IF NOT EXISTS public.writing_logs (
  user_id   UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date  DATE    NOT NULL,
  words     INTEGER NOT NULL DEFAULT 0 CHECK (words >= 0),
  PRIMARY KEY (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_writing_logs_user_date
  ON public.writing_logs(user_id, log_date DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.writing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "writing_logs: 본인만"
  ON public.writing_logs
  FOR ALL
  USING (auth.uid() = user_id);

-- ── 집필량 원자적 증가 함수 ───────────────────────────────────
-- chapters PATCH 에서 word_count 증가분을 누적할 때 사용
-- SECURITY DEFINER → 서비스 키 없이 서버 API Route에서 호출 가능
CREATE OR REPLACE FUNCTION increment_writing_log(
  p_user_id UUID,
  p_date    DATE,
  p_words   INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.writing_logs (user_id, log_date, words)
  VALUES (p_user_id, p_date, p_words)
  ON CONFLICT (user_id, log_date)
  DO UPDATE SET words = writing_logs.words + EXCLUDED.words;
END;
$$;
