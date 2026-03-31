-- ============================================
-- Self-Evolving Agent: 세션 트레이스 인프라
-- agent_sessions (세션 메타) + agent_step_traces (스텝별 추론)
-- ============================================

-- ── agent_sessions ──
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  student_id UUID REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  model_id TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  system_prompt_hash TEXT,
  total_steps SMALLINT DEFAULT 0,
  total_input_tokens INT DEFAULT 0,
  total_output_tokens INT DEFAULT 0,
  duration_ms INT,
  stop_reason TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_sessions_tenant ON agent_sessions(tenant_id, created_at DESC);
CREATE INDEX idx_agent_sessions_student ON agent_sessions(student_id, created_at DESC);
CREATE INDEX idx_agent_sessions_user ON agent_sessions(user_id, created_at DESC);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_sessions_select" ON agent_sessions
  FOR SELECT USING (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

CREATE POLICY "agent_sessions_insert" ON agent_sessions
  FOR INSERT WITH CHECK (tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid));

-- ── agent_step_traces ──
CREATE TABLE agent_step_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE NOT NULL,
  step_index SMALLINT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('tool-call', 'text', 'think')),
  tool_name TEXT,
  tool_input JSONB,
  tool_output JSONB,
  text_content TEXT,
  reasoning TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_step_traces_session ON agent_step_traces(session_id, step_index);

ALTER TABLE agent_step_traces ENABLE ROW LEVEL SECURITY;

-- step_traces는 session을 통해 간접 접근 (session의 tenant_id로 필터)
CREATE POLICY "step_traces_select" ON agent_step_traces
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM agent_sessions
      WHERE tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    )
  );

CREATE POLICY "step_traces_insert" ON agent_step_traces
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM agent_sessions
      WHERE tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    )
  );
