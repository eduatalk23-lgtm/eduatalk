-- 기관별 전역 스케줄러 설정 테이블 생성
CREATE TABLE IF NOT EXISTS tenant_scheduler_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- 학습일/복습일 비율
  default_study_days INTEGER NOT NULL DEFAULT 6 CHECK (default_study_days BETWEEN 1 AND 7),
  default_review_days INTEGER NOT NULL DEFAULT 1 CHECK (default_review_days BETWEEN 0 AND 7),
  
  -- 기타 기본 옵션
  default_weak_subject_focus TEXT DEFAULT 'medium' CHECK (default_weak_subject_focus IN ('low', 'medium', 'high')),
  default_review_scope TEXT DEFAULT 'full' CHECK (default_review_scope IN ('full', 'partial')),
  
  -- 시간 설정 기본값
  default_lunch_time JSONB DEFAULT '{"start": "12:00", "end": "13:00"}'::jsonb,
  default_study_hours JSONB DEFAULT '{"start": "09:00", "end": "18:00"}'::jsonb,
  default_self_study_hours JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id)
);

-- RLS 정책 설정
ALTER TABLE tenant_scheduler_settings ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 가능
CREATE POLICY "tenant_scheduler_settings_select" ON tenant_scheduler_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = tenant_scheduler_settings.tenant_id
      AND users.role IN ('admin', 'consultant')
    )
  );

-- 관리자만 수정 가능
CREATE POLICY "tenant_scheduler_settings_update" ON tenant_scheduler_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = tenant_scheduler_settings.tenant_id
      AND users.role = 'admin'
    )
  );

-- 관리자만 삽입 가능
CREATE POLICY "tenant_scheduler_settings_insert" ON tenant_scheduler_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = tenant_scheduler_settings.tenant_id
      AND users.role = 'admin'
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_tenant_scheduler_settings_updated_at
  BEFORE UPDATE ON tenant_scheduler_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX idx_tenant_scheduler_settings_tenant_id ON tenant_scheduler_settings(tenant_id);

-- 코멘트 추가
COMMENT ON TABLE tenant_scheduler_settings IS '기관별 전역 스케줄러 기본 설정';
COMMENT ON COLUMN tenant_scheduler_settings.default_study_days IS '주당 기본 학습일 수 (1-7)';
COMMENT ON COLUMN tenant_scheduler_settings.default_review_days IS '주당 기본 복습일 수 (0-7)';
COMMENT ON COLUMN tenant_scheduler_settings.default_weak_subject_focus IS '취약과목 집중 모드 (low, medium, high)';
COMMENT ON COLUMN tenant_scheduler_settings.default_review_scope IS '복습 범위 (full: 전체, partial: 축소)';

