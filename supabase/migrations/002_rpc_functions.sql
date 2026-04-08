-- ============================================================
-- Migration 002: 챕터 순서 변경 RPC 함수
-- app/api/chapters/[id]/route.ts의 supabase.rpc() 호출에 필요
-- 실행: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 챕터 아래로 이동 ─────────────────────────────────────────
-- 예: order_idx 1 → 3 으로 이동할 때
--   기존 2, 3번 챕터를 각각 1, 2로 당김

CREATE OR REPLACE FUNCTION reorder_chapter_down(
  p_project_id  UUID,
  p_old_idx     INTEGER,
  p_new_idx     INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- RLS 없이 실행 (호출자 권한 검증은 API Route에서 처리)
AS $$
BEGIN
  UPDATE public.chapters
  SET    order_idx = order_idx - 1
  WHERE  project_id = p_project_id
    AND  order_idx > p_old_idx
    AND  order_idx <= p_new_idx;
END;
$$;

-- ── 챕터 위로 이동 ───────────────────────────────────────────
-- 예: order_idx 3 → 1 로 이동할 때
--   기존 1, 2번 챕터를 각각 2, 3으로 밈

CREATE OR REPLACE FUNCTION reorder_chapter_up(
  p_project_id  UUID,
  p_old_idx     INTEGER,
  p_new_idx     INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chapters
  SET    order_idx = order_idx + 1
  WHERE  project_id = p_project_id
    AND  order_idx >= p_new_idx
    AND  order_idx < p_old_idx;
END;
$$;

-- 실행 권한 부여 (anon, authenticated 역할 모두 허용)
GRANT EXECUTE ON FUNCTION reorder_chapter_down(UUID, INTEGER, INTEGER)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION reorder_chapter_up(UUID, INTEGER, INTEGER)
  TO anon, authenticated;
