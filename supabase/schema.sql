-- ============================================================
-- Podwrite.ai — Supabase PostgreSQL 스키마
-- 실행: Supabase Dashboard > SQL Editor 에서 전체 실행
-- 또는: supabase db reset (로컬 개발)
-- ============================================================

-- 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM 타입 ─────────────────────────────────────────────────

CREATE TYPE plan_type AS ENUM ('free', 'basic', 'pro');
CREATE TYPE platform_type AS ENUM ('bookk', 'kyobo', 'kdp');
CREATE TYPE project_status AS ENUM ('draft', 'in_progress', 'completed', 'published');
CREATE TYPE version_trigger AS ENUM ('ai_edit', 'autosave', 'manual');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');
CREATE TYPE diagnostic_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ── 테이블 1: users ───────────────────────────────────────────
-- auth.users (Supabase Auth) 와 1:1 매핑

CREATE TABLE public.users (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL UNIQUE,
  plan              plan_type NOT NULL DEFAULT 'free',
  plan_expires_at   TIMESTAMPTZ,
  terms_agreed_at   TIMESTAMPTZ,
  privacy_agreed_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 테이블 2: projects ────────────────────────────────────────

CREATE TABLE public.projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  platform        platform_type NOT NULL DEFAULT 'bookk',
  status          project_status NOT NULL DEFAULT 'draft',
  target_words    INTEGER NOT NULL DEFAULT 30000,
  current_words   INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  description     TEXT,
  genre           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);

-- ── 테이블 3: chapters ────────────────────────────────────────

CREATE TABLE public.chapters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  order_idx   INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL DEFAULT '새 챕터',
  content     JSONB,              -- TipTap JSON 문서
  word_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, order_idx)
);

CREATE INDEX idx_chapters_project_id ON public.chapters(project_id);

-- ── 테이블 4: chapter_versions ────────────────────────────────

CREATE TABLE public.chapter_versions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id  UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,     -- 스냅샷 시점의 TipTap JSON
  trigger     version_trigger NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chapter_versions_chapter_id ON public.chapter_versions(chapter_id);
CREATE INDEX idx_chapter_versions_created_at ON public.chapter_versions(created_at DESC);

-- ── 테이블 5: search_results ──────────────────────────────────

CREATE TABLE public.search_results (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  query       TEXT NOT NULL,
  results     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_results_project_id ON public.search_results(project_id);
-- 동일 쿼리 24시간 내 캐시 조회용
CREATE INDEX idx_search_results_query_created ON public.search_results(project_id, query, created_at DESC);

-- ── 테이블 6: search_usage ────────────────────────────────────

CREATE TABLE public.search_usage (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  count     INTEGER NOT NULL DEFAULT 0,
  reset_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_search_usage_user_id ON public.search_usage(user_id);

-- ── 테이블 7: diagnostics ─────────────────────────────────────

CREATE TABLE public.diagnostics (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- 비회원 null 허용
  session_token      TEXT NOT NULL UNIQUE,                                  -- 비회원 식별용
  file_storage_path  TEXT,
  report             JSONB,
  status             diagnostic_status NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnostics_user_id ON public.diagnostics(user_id);
CREATE INDEX idx_diagnostics_session_token ON public.diagnostics(session_token);

-- ── 테이블 8: subscriptions ───────────────────────────────────

CREATE TABLE public.subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  toss_billing_key  TEXT NOT NULL,
  plan              plan_type NOT NULL,
  status            subscription_status NOT NULL DEFAULT 'pending',
  amount            INTEGER NOT NULL,           -- 원 단위
  next_billing_at   TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
-- 정기결제 크론 잡에서 next_billing_at <= NOW() 조회용
CREATE INDEX idx_subscriptions_next_billing ON public.subscriptions(next_billing_at)
  WHERE status = 'active';

-- ── 자동 updated_at 트리거 ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 신규 가입 시 users 행 자동 생성 ──────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 챕터 수정 시 project.current_words 자동 갱신 ─────────────

CREATE OR REPLACE FUNCTION sync_project_word_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.projects
  SET current_words = (
    SELECT COALESCE(SUM(word_count), 0)
    FROM public.chapters
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_word_count
  AFTER INSERT OR UPDATE OF word_count OR DELETE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION sync_project_word_count();

-- ── 버전 개수 초과 시 오래된 버전 자동 삭제 (플랜별) ──────────

CREATE OR REPLACE FUNCTION trim_chapter_versions()
RETURNS TRIGGER AS $$
DECLARE
  v_user_plan plan_type;
  v_limit INTEGER;
BEGIN
  -- 해당 챕터의 소유자 플랜 조회
  SELECT u.plan INTO v_user_plan
  FROM public.users u
  JOIN public.projects p ON p.user_id = u.id
  JOIN public.chapters c ON c.project_id = p.id
  WHERE c.id = NEW.chapter_id;

  -- 플랜별 버전 한도
  v_limit := CASE v_user_plan
    WHEN 'free'  THEN 5
    WHEN 'basic' THEN 20
    WHEN 'pro'   THEN 2147483647  -- 무제한
    ELSE 5
  END;

  -- 한도 초과 시 오래된 버전 삭제
  DELETE FROM public.chapter_versions
  WHERE id IN (
    SELECT id FROM public.chapter_versions
    WHERE chapter_id = NEW.chapter_id
    ORDER BY created_at DESC
    OFFSET v_limit
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trim_versions
  AFTER INSERT ON public.chapter_versions
  FOR EACH ROW EXECUTE FUNCTION trim_chapter_versions();

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions   ENABLE ROW LEVEL SECURITY;

-- users: 본인만 조회/수정
CREATE POLICY "users: 본인만 조회" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users: 본인만 수정" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- projects: 본인 소유만
CREATE POLICY "projects: 본인만 조회" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects: 본인만 생성" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects: 본인만 수정" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects: 본인만 삭제" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- chapters: 소유 프로젝트의 챕터만
CREATE POLICY "chapters: 본인만 조회" ON public.chapters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = chapters.project_id AND user_id = auth.uid())
  );
CREATE POLICY "chapters: 본인만 생성" ON public.chapters
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "chapters: 본인만 수정" ON public.chapters
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = chapters.project_id AND user_id = auth.uid())
  );
CREATE POLICY "chapters: 본인만 삭제" ON public.chapters
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = chapters.project_id AND user_id = auth.uid())
  );

-- chapter_versions: 소유 챕터의 버전만
CREATE POLICY "versions: 본인만 조회" ON public.chapter_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chapters c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = chapter_versions.chapter_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "versions: 본인만 생성" ON public.chapter_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chapters c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = chapter_id AND p.user_id = auth.uid()
    )
  );

-- search_results: 소유 프로젝트만
CREATE POLICY "search_results: 본인만" ON public.search_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = search_results.project_id AND user_id = auth.uid())
  );

-- search_usage: 본인만
CREATE POLICY "search_usage: 본인만" ON public.search_usage
  FOR ALL USING (auth.uid() = user_id);

-- diagnostics: 본인 또는 비회원 session_token 기반
CREATE POLICY "diagnostics: 본인 조회" ON public.diagnostics
  FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );
CREATE POLICY "diagnostics: 누구나 생성" ON public.diagnostics
  FOR INSERT WITH CHECK (true);  -- 비회원도 생성 가능
CREATE POLICY "diagnostics: 본인만 수정" ON public.diagnostics
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- subscriptions: 본인만
CREATE POLICY "subscriptions: 본인만" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- ── Storage 버킷 ──────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('manuscripts', 'manuscripts', false, 52428800,  -- 50MB
    ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/pdf', 'text/plain']),
  ('exports', 'exports', false, 104857600,         -- 100MB
    ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/pdf', 'application/epub+zip',
          'application/zip']),
  ('covers', 'covers', true, 10485760,             -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "manuscripts: 본인만" ON storage.objects
  FOR ALL USING (bucket_id = 'manuscripts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "exports: 본인만" ON storage.objects
  FOR ALL USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "covers: 공개 조회" ON storage.objects
  FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "covers: 본인만 업로드" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
