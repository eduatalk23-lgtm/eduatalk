-- AI API 사용량 로그 테이블
-- Phase 4: 성능 최적화 및 안정화

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  user_id UUID, -- 요청한 사용자 (관리자/학생)
  
  -- 요청 정보
  action_type TEXT NOT NULL, -- 'generate_plan', 'stream_plan', 'recommend_content', 'optimize_plan'
  planning_mode TEXT, -- 'strategy', 'schedule'
  model_tier TEXT NOT NULL, -- 'fast', 'standard', 'advanced'
  model_id TEXT, -- 실제 사용된 모델 ID
  
  -- 토큰 사용량
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- 비용
  estimated_cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  
  -- 웹 검색 사용 여부
  web_search_enabled BOOLEAN DEFAULT FALSE,
  web_search_results_count INTEGER DEFAULT 0,
  
  -- 결과
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  
  -- 메타데이터
  request_duration_ms INTEGER, -- 요청 처리 시간
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant ON ai_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action ON ai_usage_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_created ON ai_usage_logs(tenant_id, created_at DESC);

-- RLS 활성화
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 관리자 조회 정책
CREATE POLICY "Admins can view tenant ai usage logs" ON ai_usage_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.auth_user_id = auth.uid() 
      AND admin_users.tenant_id = ai_usage_logs.tenant_id
    )
  );

-- 시스템 삽입 정책 (서버 액션에서 삽입)
CREATE POLICY "System can insert ai usage logs" ON ai_usage_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE ai_usage_logs IS 'AI API 사용량 로그 - 비용 모니터링 및 분석용';
COMMENT ON COLUMN ai_usage_logs.action_type IS 'AI 액션 유형: generate_plan, stream_plan, recommend_content, optimize_plan';
COMMENT ON COLUMN ai_usage_logs.planning_mode IS '플랜 생성 모드: strategy (전략), schedule (배정)';
COMMENT ON COLUMN ai_usage_logs.estimated_cost_usd IS '추정 API 비용 (USD)';
