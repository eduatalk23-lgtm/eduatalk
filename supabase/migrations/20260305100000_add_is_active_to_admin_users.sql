-- admin_users 테이블에 is_active 컬럼 추가
-- 계정 비활성화 시스템: is_active + Supabase ban_duration 동기화

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users (tenant_id, is_active);
