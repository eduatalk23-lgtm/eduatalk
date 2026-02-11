-- =============================================
-- Tier 1 기능: 컨설턴트 배정, 상담 확장, 수납 자동화, 현금영수증, 매출 리포트
-- =============================================

-- =============================================
-- 1. consultant_assignments 테이블 (컨설턴트-학생 배정)
-- =============================================
CREATE TABLE IF NOT EXISTS consultant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'secondary', 'assistant')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_consultant_assignment UNIQUE (student_id, enrollment_id, consultant_id, role)
);

COMMENT ON TABLE consultant_assignments IS '컨설턴트-학생 배정 (enrollment_id가 NULL이면 학생 전체 담당)';
COMMENT ON COLUMN consultant_assignments.role IS 'primary=주담당, secondary=부담당, assistant=보조';

CREATE INDEX idx_ca_tenant ON consultant_assignments(tenant_id);
CREATE INDEX idx_ca_student ON consultant_assignments(student_id);
CREATE INDEX idx_ca_consultant ON consultant_assignments(consultant_id);
CREATE INDEX idx_ca_enrollment ON consultant_assignments(enrollment_id) WHERE enrollment_id IS NOT NULL;

ALTER TABLE consultant_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY ca_select_policy ON consultant_assignments FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY ca_insert_policy ON consultant_assignments FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY ca_update_policy ON consultant_assignments FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY ca_delete_policy ON consultant_assignments FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM admin_users WHERE id = auth.uid())
  );

-- =============================================
-- 2. enrollments 확장 (컨설턴트 배정 + 만료 추적)
-- =============================================
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_end_on_expiry BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_notified_at JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN enrollments.consultant_id IS '주담당 컨설턴트 (간편 배정용)';
COMMENT ON COLUMN enrollments.auto_end_on_expiry IS '만료 시 자동으로 completed 상태로 전환 여부';
COMMENT ON COLUMN enrollments.expiry_notified_at IS '만료 알림 발송 기록 (예: {"d30":"2026-01-15","d7":"2026-02-08"})';

CREATE INDEX IF NOT EXISTS idx_enrollments_consultant ON enrollments(consultant_id) WHERE consultant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_expiry ON enrollments(end_date, status) WHERE status = 'active' AND end_date IS NOT NULL;

-- =============================================
-- 3. student_consulting_notes 확장 (세션 기록)
-- =============================================
ALTER TABLE student_consulting_notes
  ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT '기타'
    CHECK (session_type IN ('정기상담','학부모상담','진로상담','성적상담','긴급상담','기타')),
  ADD COLUMN IF NOT EXISTS session_duration INTEGER,
  ADD COLUMN IF NOT EXISTS session_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_visible_to_parent BOOLEAN DEFAULT false;

COMMENT ON COLUMN student_consulting_notes.session_type IS '상담 유형';
COMMENT ON COLUMN student_consulting_notes.session_duration IS '상담 시간 (분 단위)';
COMMENT ON COLUMN student_consulting_notes.session_date IS '상담 일자';
COMMENT ON COLUMN student_consulting_notes.next_action IS '후속 조치 내용';
COMMENT ON COLUMN student_consulting_notes.follow_up_date IS '후속 조치 예정일';
COMMENT ON COLUMN student_consulting_notes.is_visible_to_parent IS '학부모 포털에 공개 여부';

CREATE INDEX IF NOT EXISTS idx_consulting_session_date ON student_consulting_notes(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_consulting_follow_up ON student_consulting_notes(follow_up_date)
  WHERE follow_up_date IS NOT NULL;

-- =============================================
-- 4. payment_records 확장 (현금영수증 + 알림 추적)
-- =============================================
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS cash_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS cash_receipt_key TEXT,
  ADD COLUMN IF NOT EXISTS cash_receipt_type TEXT CHECK (cash_receipt_type IN ('소득공제','지출증빙')),
  ADD COLUMN IF NOT EXISTS reminder_sent_at JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN payment_records.cash_receipt_url IS '현금영수증 조회 URL';
COMMENT ON COLUMN payment_records.cash_receipt_key IS '토스 현금영수증 키';
COMMENT ON COLUMN payment_records.cash_receipt_type IS '소득공제 또는 지출증빙';
COMMENT ON COLUMN payment_records.reminder_sent_at IS '결제 알림 발송 기록 (예: {"pre3":"2026-02-22","overdue3":"2026-02-28"})';

CREATE INDEX IF NOT EXISTS idx_pr_cash_receipt ON payment_records(cash_receipt_key) WHERE cash_receipt_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_unpaid_due ON payment_records(due_date, status) WHERE status IN ('unpaid','partial');

-- =============================================
-- 5. 매출 리포트용 DB 함수
-- =============================================

-- 5-1. 매출 요약 (기간, 프로그램, 컨설턴트 필터)
CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_tenant_id UUID,
  p_start DATE,
  p_end DATE,
  p_program_id UUID DEFAULT NULL,
  p_consultant_id UUID DEFAULT NULL
)
RETURNS TABLE(
  total_billed NUMERIC,
  total_paid NUMERIC,
  total_unpaid NUMERIC,
  collection_rate NUMERIC,
  payment_count BIGINT,
  student_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(pr.amount), 0),
    COALESCE(SUM(pr.paid_amount), 0),
    COALESCE(SUM(pr.amount - pr.paid_amount), 0),
    CASE
      WHEN SUM(pr.amount) > 0
      THEN ROUND(SUM(pr.paid_amount) / SUM(pr.amount) * 100, 1)
      ELSE 0
    END,
    COUNT(*)::BIGINT,
    COUNT(DISTINCT pr.student_id)::BIGINT
  FROM payment_records pr
  JOIN enrollments e ON e.id = pr.enrollment_id
  WHERE pr.tenant_id = p_tenant_id
    AND pr.created_at::DATE BETWEEN p_start AND p_end
    AND (p_program_id IS NULL OR e.program_id = p_program_id)
    AND (p_consultant_id IS NULL OR e.consultant_id = p_consultant_id);
END;
$$;

-- 5-2. 월별 매출 (추이 차트용)
CREATE OR REPLACE FUNCTION get_monthly_revenue(
  p_tenant_id UUID,
  p_start DATE,
  p_end DATE,
  p_program_id UUID DEFAULT NULL
)
RETURNS TABLE(
  month TEXT,
  billed NUMERIC,
  paid NUMERIC,
  unpaid NUMERIC,
  rate NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', pr.created_at), 'YYYY-MM'),
    COALESCE(SUM(pr.amount), 0),
    COALESCE(SUM(pr.paid_amount), 0),
    COALESCE(SUM(pr.amount - pr.paid_amount), 0),
    CASE
      WHEN SUM(pr.amount) > 0
      THEN ROUND(SUM(pr.paid_amount) / SUM(pr.amount) * 100, 1)
      ELSE 0
    END
  FROM payment_records pr
  JOIN enrollments e ON e.id = pr.enrollment_id
  WHERE pr.tenant_id = p_tenant_id
    AND pr.created_at::DATE BETWEEN p_start AND p_end
    AND (p_program_id IS NULL OR e.program_id = p_program_id)
  GROUP BY DATE_TRUNC('month', pr.created_at)
  ORDER BY DATE_TRUNC('month', pr.created_at) DESC;
END;
$$;

-- 5-3. 프로그램별 매출 (파이 차트용)
CREATE OR REPLACE FUNCTION get_program_revenue(
  p_tenant_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE(
  program_id UUID,
  program_name TEXT,
  total_billed NUMERIC,
  total_paid NUMERIC,
  enrollment_count BIGINT,
  pct NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM payment_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_start AND p_end;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(pr.amount), 0),
    COALESCE(SUM(pr.paid_amount), 0),
    COUNT(DISTINCT e.id)::BIGINT,
    CASE
      WHEN v_total > 0
      THEN ROUND(COALESCE(SUM(pr.amount), 0) / v_total * 100, 1)
      ELSE 0
    END
  FROM programs p
  LEFT JOIN enrollments e ON e.program_id = p.id AND e.tenant_id = p_tenant_id
  LEFT JOIN payment_records pr ON pr.enrollment_id = e.id
    AND pr.created_at::DATE BETWEEN p_start AND p_end
  WHERE p.tenant_id = p_tenant_id
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(pr.amount), 0) > 0
  ORDER BY 3 DESC;
END;
$$;
