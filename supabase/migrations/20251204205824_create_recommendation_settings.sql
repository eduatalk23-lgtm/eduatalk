-- Migration: Create recommendation_settings table for recommendation system configuration
-- 추천 시스템 설정을 저장하는 테이블 생성

-- 1. recommendation_settings 테이블 생성
CREATE TABLE IF NOT EXISTS recommendation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  setting_type TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, setting_type, setting_key)
);

-- 2. 인덱스 생성
CREATE INDEX idx_recommendation_settings_tenant_type 
  ON recommendation_settings(tenant_id, setting_type);

CREATE INDEX idx_recommendation_settings_setting_type 
  ON recommendation_settings(setting_type);

-- 3. updated_at 자동 업데이트 트리거 함수 (이미 존재할 수 있으므로 CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION update_recommendation_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성
DROP TRIGGER IF EXISTS update_recommendation_settings_updated_at ON recommendation_settings;
CREATE TRIGGER update_recommendation_settings_updated_at
  BEFORE UPDATE ON recommendation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_settings_updated_at();

-- 5. RLS 정책 설정 (관리자만 접근 가능)
ALTER TABLE recommendation_settings ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 가능
CREATE POLICY "recommendation_settings_select" ON recommendation_settings
  FOR SELECT
  USING (
    tenant_id IS NULL OR -- 전역 설정은 모든 관리자가 조회 가능
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = recommendation_settings.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 관리자만 수정 가능
CREATE POLICY "recommendation_settings_update" ON recommendation_settings
  FOR UPDATE
  USING (
    tenant_id IS NULL OR -- 전역 설정은 슈퍼 관리자만 수정 가능 (추후 구현)
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = recommendation_settings.tenant_id
      AND admin_users.role = 'admin'
    )
  );

-- 관리자만 삽입 가능
CREATE POLICY "recommendation_settings_insert" ON recommendation_settings
  FOR INSERT
  WITH CHECK (
    tenant_id IS NULL OR -- 전역 설정은 슈퍼 관리자만 삽입 가능 (추후 구현)
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = recommendation_settings.tenant_id
      AND admin_users.role = 'admin'
    )
  );

-- 관리자만 삭제 가능
CREATE POLICY "recommendation_settings_delete" ON recommendation_settings
  FOR DELETE
  USING (
    tenant_id IS NULL OR -- 전역 설정은 슈퍼 관리자만 삭제 가능 (추후 구현)
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = recommendation_settings.tenant_id
      AND admin_users.role = 'admin'
    )
  );

-- 6. 코멘트 추가
COMMENT ON TABLE recommendation_settings IS '추천 시스템 설정 저장소';
COMMENT ON COLUMN recommendation_settings.tenant_id IS '테넌트 ID (NULL이면 전역 설정)';
COMMENT ON COLUMN recommendation_settings.setting_type IS '설정 타입 (예: range_recommendation, content_recommendation)';
COMMENT ON COLUMN recommendation_settings.setting_key IS '설정 키 (예: pages_per_hour, episodes_per_hour)';
COMMENT ON COLUMN recommendation_settings.setting_value IS '설정 값 (JSON 형식)';
COMMENT ON COLUMN recommendation_settings.version IS '설정 버전 (향후 마이그레이션 관리용)';

