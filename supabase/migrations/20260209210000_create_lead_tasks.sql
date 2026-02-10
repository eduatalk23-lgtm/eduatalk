-- ============================================================================
-- 리드 태스크 관리 시스템
--
-- 팔로업 콜, 서류 수집, 체험 예약 등 리드별 할 일 추적
-- SLA 기반 자동 생성 및 기한 초과 감지 지원
-- ============================================================================

-- 1. lead_tasks 테이블 생성
CREATE TABLE IF NOT EXISTS lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,

  task_type varchar(50) NOT NULL
    CHECK (task_type IN (
      'first_contact', 'follow_up_call', 'send_proposal',
      'schedule_trial', 'post_trial_follow_up', 'collect_documents',
      'payment_confirm', 'custom'
    )),
  title varchar(500) NOT NULL,
  description text,
  priority varchar(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  due_date timestamptz NOT NULL,
  completed_at timestamptz,
  is_overdue boolean NOT NULL DEFAULT false,
  is_auto_created boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lead_tasks_tenant_id
  ON lead_tasks(tenant_id);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id
  ON lead_tasks(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_to
  ON lead_tasks(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_tasks_status
  ON lead_tasks(tenant_id, status)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_lead_tasks_due_date
  ON lead_tasks(tenant_id, due_date)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_lead_tasks_overdue
  ON lead_tasks(tenant_id, is_overdue)
  WHERE is_overdue = true;

-- ============================================================================
-- updated_at 자동 갱신 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION update_lead_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_lead_tasks_updated_at ON lead_tasks;
CREATE TRIGGER trigger_lead_tasks_updated_at
  BEFORE UPDATE ON lead_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_tasks_updated_at();

-- ============================================================================
-- RLS 활성화 및 정책
-- ============================================================================

ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own tenant tasks"
  ON lead_tasks FOR SELECT
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

CREATE POLICY "Admins can create tasks in own tenant"
  ON lead_tasks FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update own tenant tasks"
  ON lead_tasks FOR UPDATE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete own tenant tasks"
  ON lead_tasks FOR DELETE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- ============================================================================
-- 테이블 코멘트
-- ============================================================================

COMMENT ON TABLE lead_tasks IS '리드 태스크 관리 - 팔로업, 서류수집, 결제확인 등 할일 추적';
COMMENT ON COLUMN lead_tasks.task_type IS '태스크 유형: first_contact, follow_up_call, send_proposal 등';
COMMENT ON COLUMN lead_tasks.priority IS '우선순위: high, medium, low';
COMMENT ON COLUMN lead_tasks.status IS '상태: pending, in_progress, completed, cancelled';
COMMENT ON COLUMN lead_tasks.due_date IS '마감일시 (SLA 기준)';
COMMENT ON COLUMN lead_tasks.is_overdue IS '기한 초과 여부 (CRON 또는 조회 시 갱신)';
COMMENT ON COLUMN lead_tasks.is_auto_created IS '자동 생성 여부 (파이프라인 상태 변경 시)';
