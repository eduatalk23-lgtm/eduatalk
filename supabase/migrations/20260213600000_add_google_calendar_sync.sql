-- ============================================================
-- Google Calendar 동기화를 위한 테이블 및 컬럼 추가
-- ============================================================

-- 1) OAuth 토큰 저장 테이블
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  google_email TEXT,
  sync_enabled BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (admin_user_id)
);

ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON google_oauth_tokens
  FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_google_oauth_tokens_tenant ON google_oauth_tokens(tenant_id);
CREATE INDEX idx_google_oauth_tokens_admin ON google_oauth_tokens(admin_user_id);

-- 2) consultation_schedules에 Google 이벤트 연동 컬럼 추가
ALTER TABLE consultation_schedules
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_shared_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_sync_status TEXT DEFAULT 'pending'
    CHECK (google_sync_status IN ('pending','synced','failed','not_applicable'));

-- 3) 동기화 실패 시 재시도 큐
CREATE TABLE IF NOT EXISTS google_calendar_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES consultation_schedules(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create','update','cancel')),
  target TEXT NOT NULL CHECK (target IN ('personal','shared','both')),
  admin_user_id UUID REFERENCES admin_users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE google_calendar_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON google_calendar_sync_queue
  FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_gcal_sync_queue_status ON google_calendar_sync_queue(status)
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_gcal_sync_queue_schedule ON google_calendar_sync_queue(schedule_id);
CREATE INDEX idx_gcal_sync_queue_tenant ON google_calendar_sync_queue(tenant_id);
