-- ============================================
-- Self-Evolving Agent: LLM-as-Judge 평가
-- agent_evaluations 테이블
-- ============================================

CREATE TABLE agent_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE NOT NULL,
  evaluator_model TEXT NOT NULL,
  scores JSONB NOT NULL,
  -- scores 구조:
  -- {
  --   "diagnosis_accuracy": 1-5,
  --   "strategy_realism": 1-5,
  --   "student_consideration": 1-5,
  --   "missed_points": 1-5,
  --   "tool_efficiency": 1-5,
  --   "overall": float
  -- }
  feedback TEXT,
  missed_points_detail TEXT[] DEFAULT '{}',
  expert_alternative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_session ON agent_evaluations(session_id);
CREATE INDEX idx_evaluations_overall ON agent_evaluations(
  ((scores->>'overall')::float) DESC
) WHERE scores->>'overall' IS NOT NULL;

ALTER TABLE agent_evaluations ENABLE ROW LEVEL SECURITY;

-- 평가는 세션의 테넌트를 통해 간접 접근
CREATE POLICY "evaluations_select" ON agent_evaluations
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM agent_sessions
      WHERE tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    )
  );

CREATE POLICY "evaluations_insert" ON agent_evaluations
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM agent_sessions
      WHERE tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    )
  );
