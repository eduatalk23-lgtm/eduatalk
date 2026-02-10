-- ============================================================================
-- 리드 활동 기록 테이블
--
-- 리드별 상담/통화/메모 등 활동 이력 관리 (다건)
-- ============================================================================

-- 1. lead_activities 테이블 생성
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  activity_type varchar(50) NOT NULL
    CHECK (activity_type IN (
      'phone_call', 'sms', 'consultation',
      'follow_up', 'status_change', 'note',
      'email', 'meeting'
    )),
  title varchar(500),
  description text,
  previous_status varchar(50),
  new_status varchar(50),
  performed_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  activity_date timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lead_activities_tenant_id
  ON lead_activities(tenant_id);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id
  ON lead_activities(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_activities_performed_by
  ON lead_activities(performed_by);

CREATE INDEX IF NOT EXISTS idx_lead_activities_activity_date
  ON lead_activities(lead_id, activity_date DESC);

-- ============================================================================
-- RLS 활성화 및 정책
-- ============================================================================

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 자기 테넌트의 활동 조회
CREATE POLICY "Admins can view own tenant lead activities"
  ON lead_activities FOR SELECT
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트에 활동 생성
CREATE POLICY "Admins can create lead activities in own tenant"
  ON lead_activities FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 활동 수정
CREATE POLICY "Admins can update lead activities in own tenant"
  ON lead_activities FOR UPDATE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 활동 삭제
CREATE POLICY "Admins can delete lead activities in own tenant"
  ON lead_activities FOR DELETE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- ============================================================================
-- 테이블 코멘트
-- ============================================================================

COMMENT ON TABLE lead_activities IS '리드 활동 기록 테이블 - 상담/통화/메모 등 리드별 활동 이력';
COMMENT ON COLUMN lead_activities.lead_id IS '관련 리드';
COMMENT ON COLUMN lead_activities.activity_type IS '활동 유형: phone_call, sms, consultation, follow_up, status_change, note, email, meeting';
COMMENT ON COLUMN lead_activities.title IS '활동 제목';
COMMENT ON COLUMN lead_activities.description IS '활동 상세 내용';
COMMENT ON COLUMN lead_activities.previous_status IS '이전 파이프라인 상태 (status_change 시)';
COMMENT ON COLUMN lead_activities.new_status IS '변경된 파이프라인 상태 (status_change 시)';
COMMENT ON COLUMN lead_activities.performed_by IS '활동 수행자';
COMMENT ON COLUMN lead_activities.activity_date IS '활동 일시';
COMMENT ON COLUMN lead_activities.metadata IS '추가 메타데이터 (통화 시간, 미팅 장소 등)';
