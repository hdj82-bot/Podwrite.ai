-- ============================================================
-- Migration 006: 파일 익스포트 + 진단 만료 스키마
--
-- 1. file_exports: DOCX/EPUB 생성 결과 저장 + Supabase Realtime 알림
--    generate-docx.ts, generate-epub.ts 잡이 INSERT → 클라이언트 알림
-- 2. diagnostics.expires_at: 비회원 진단 7일 자동 만료
-- 3. chapter_versions.trigger 코멘트: translation 트리거 명시
-- ============================================================

-- ── 1. file_exports 테이블 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_exports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  -- 파일 종류: 'docx' | 'epub'
  file_type     text        NOT NULL,
  -- DOCX 플랫폼: 'bookk' | 'kyobo' | 'kdp' | null
  platform      text,
  -- EPUB 언어: 'ko' | 'en' | null
  language      text,
  -- 상태: 'pending' | 'completed' | 'failed'
  status        text        NOT NULL DEFAULT 'pending',
  download_url  text,
  storage_path  text,
  -- 다운로드 URL 만료 시각 (completed 시 now + 24h)
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS file_exports_project_id_idx
  ON file_exports (project_id);
CREATE INDEX IF NOT EXISTS file_exports_user_id_idx
  ON file_exports (user_id);

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE file_exports ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 익스포트만 조회 가능
CREATE POLICY "users_read_own_file_exports"
  ON file_exports FOR SELECT
  USING (user_id = auth.uid());

-- ── Supabase Realtime 활성화 ───────────────────────────────────────
-- generate-docx/epub 잡이 INSERT 시 클라이언트에 즉시 알림 전달
ALTER PUBLICATION supabase_realtime ADD TABLE file_exports;

-- ── 2. diagnostics.expires_at 컬럼 추가 ───────────────────────────
-- analyze-diagnostic.ts 잡이 비회원 진단에 7일 만료 설정
ALTER TABLE diagnostics
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- ── 3. chapter_versions.trigger 코멘트 ────────────────────────────
-- translate.ts 잡이 trigger='translation'으로 번역 이력 저장
COMMENT ON COLUMN chapter_versions.trigger
  IS 'manual | ai_edit | translation';
