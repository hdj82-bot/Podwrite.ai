-- ============================================================
-- Migration 005: 정기결제 스키마 (retry_count + billing_history)
--
-- billing-cycle.ts 크론 잡이 필요로 하는 컬럼/테이블:
--   - subscriptions.retry_count        결제 실패 재시도 횟수
--   - subscriptions.billing_failed_at  최초 결제 실패 시각 (재시도 추적용)
--   - billing_history                  결제 이력 감사 로그
-- ============================================================

-- ── subscriptions 컬럼 추가 ─────────────────────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS retry_count        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_failed_at  timestamptz;

-- ── billing_history 테이블 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  order_id         text,
  payment_key      text,
  amount           integer     NOT NULL,
  plan             text        NOT NULL,
  -- pending → confirmed | failed
  status           text        NOT NULL DEFAULT 'pending',
  billed_at        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS billing_history_subscription_id_idx
  ON billing_history (subscription_id);
CREATE INDEX IF NOT EXISTS billing_history_order_id_idx
  ON billing_history (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS billing_history_order_id_unique
  ON billing_history (order_id)
  WHERE order_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 결제 이력만 조회 가능
CREATE POLICY "users_read_own_billing_history"
  ON billing_history FOR SELECT
  USING (user_id = auth.uid());

-- 서비스 롤(백엔드)만 INSERT/UPDATE 가능 (RLS 우회)
-- billing-cycle.ts, webhook route는 service role 키 사용
