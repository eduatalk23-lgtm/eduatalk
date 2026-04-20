-- ============================================
-- Phase G S-1: ai_subagent_runs
-- Shell 오케스트레이터가 서브에이전트(record-sub/plan-sub/admission-sub)를
-- tool 로 호출할 때의 라이프사이클 추적 테이블.
-- 실제 step-level trace 는 기존 agent_sessions/agent_step_traces 재사용.
-- ============================================

CREATE TABLE ai_subagent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  student_id UUID REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  subagent_name TEXT NOT NULL CHECK (
    subagent_name IN ('record-sub', 'plan-sub', 'admission-sub')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  ),
  input TEXT NOT NULL,
  model_id TEXT,
  -- agent_sessions 연결(raw step trace 저장). 세션이 끊겨도 run 자체는 유지.
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  summary JSONB,
  error TEXT,
  total_input_tokens INT,
  total_output_tokens INT,
  usd_cost NUMERIC(10, 6),
  step_count SMALLINT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subagent_runs_tenant
  ON ai_subagent_runs(tenant_id, created_at DESC);
CREATE INDEX idx_subagent_runs_student
  ON ai_subagent_runs(student_id, created_at DESC);
CREATE INDEX idx_subagent_runs_user
  ON ai_subagent_runs(user_id, created_at DESC);
-- 진행 중인 run polling 용 partial index
CREATE INDEX idx_subagent_runs_active
  ON ai_subagent_runs(status, created_at DESC)
  WHERE status IN ('pending', 'running');

ALTER TABLE ai_subagent_runs ENABLE ROW LEVEL SECURITY;

-- tenant 내부 admin/consultant 만 SELECT. agent_sessions 와 동일한 JWT 기반 가드.
CREATE POLICY "subagent_runs_select" ON ai_subagent_runs
  FOR SELECT USING (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );

CREATE POLICY "subagent_runs_insert" ON ai_subagent_runs
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );

-- 런타임이 status/summary/error/완료시간 갱신. 동일 tenant 스코프.
CREATE POLICY "subagent_runs_update" ON ai_subagent_runs
  FOR UPDATE USING (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  )
  WITH CHECK (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );
