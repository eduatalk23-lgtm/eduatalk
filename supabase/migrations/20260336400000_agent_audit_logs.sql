-- ============================================
-- 에이전트 감사 로그 테이블
-- 컨설턴트의 학생 데이터 접근/분석 이력 추적
-- ============================================

CREATE TABLE agent_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  student_id UUID NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  duration_ms INT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_audit_tenant ON agent_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_agent_audit_user ON agent_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_agent_audit_student ON agent_audit_logs(student_id, created_at DESC);

ALTER TABLE agent_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_own_tenant" ON agent_audit_logs
  FOR SELECT USING (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

CREATE POLICY "admin_insert_own_tenant" ON agent_audit_logs
  FOR INSERT WITH CHECK (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));
