-- ============================================================
-- Podwrite.ai — 개발용 시드 데이터
-- 주의: 로컬 개발 전용. 프로덕션에 실행 금지.
-- ============================================================

-- 테스트 사용자 (auth.users에 직접 삽입 — 로컬 전용)
-- 실제 비밀번호: test1234!

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'free@test.com',
  crypt('test1234!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}'
), (
  '00000000-0000-0000-0000-000000000002',
  'pro@test.com',
  crypt('test1234!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- users 프로필 (handle_new_user 트리거가 자동 생성하지만 seed에서 플랜 지정)
UPDATE public.users SET plan = 'free' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.users SET plan = 'pro', plan_expires_at = NOW() + INTERVAL '1 year'
  WHERE id = '00000000-0000-0000-0000-000000000002';

-- 테스트 프로젝트
INSERT INTO public.projects (id, user_id, title, platform, status, target_words, genre)
VALUES
  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   '나의 첫 번째 소설', 'bookk', 'in_progress', 50000, '소설'),
  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002',
   'Claude와 함께하는 AI 글쓰기', 'kdp', 'draft', 30000, '자기계발')
ON CONFLICT (id) DO NOTHING;

-- 테스트 챕터
INSERT INTO public.chapters (id, project_id, order_idx, title, content, word_count)
VALUES
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   0, '1장 - 시작',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"첫 번째 챕터입니다."}]}]}'::jsonb,
   6),
  ('20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001',
   1, '2장 - 전개',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"두 번째 챕터입니다."}]}]}'::jsonb,
   6)
ON CONFLICT (id) DO NOTHING;
