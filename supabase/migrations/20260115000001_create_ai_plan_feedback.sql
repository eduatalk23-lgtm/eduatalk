-- AI 플랜 피드백 테이블
-- Phase 4: 피드백 루프 구축

CREATE TABLE IF NOT EXISTS ai_plan_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_group_id UUID REFERENCES plan_groups(id) ON DELETE SET NULL,
  
  -- 피드백 유형
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('modified', 'rejected', 'accepted')),
  
  -- 수정 전후 비교 (modified일 경우)
  original_plan JSONB, -- AI가 생성한 원본
  modified_plan JSONB, -- 관리자가 수정한 버전
  
  -- 수정 상세 정보
  changes_summary JSONB, -- 변경 내역 요약 (추가/삭제/수정된 플랜 수 등)
  
  -- 피드백 메타데이터
  modified_by UUID, -- 수정한 관리자/컨설턴트
  reason TEXT, -- 수정/반려 사유 (선택)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_plan_feedback_tenant ON ai_plan_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_plan_feedback_type ON ai_plan_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_plan_feedback_created ON ai_plan_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_plan_feedback_plan_group ON ai_plan_feedback(plan_group_id);

-- RLS 활성화
ALTER TABLE ai_plan_feedback ENABLE ROW LEVEL SECURITY;

-- 관리자 조회 정책
CREATE POLICY "Admins can view tenant ai plan feedback" ON ai_plan_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.auth_user_id = auth.uid() 
      AND admin_users.tenant_id = ai_plan_feedback.tenant_id
    )
  );

-- 관리자 삽입 정책
CREATE POLICY "Admins can insert ai plan feedback" ON ai_plan_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.auth_user_id = auth.uid() 
      AND admin_users.tenant_id = ai_plan_feedback.tenant_id
    )
  );

COMMENT ON TABLE ai_plan_feedback IS 'AI 플랜 피드백 - 관리자 수정/반려 추적';
COMMENT ON COLUMN ai_plan_feedback.feedback_type IS '피드백 유형: modified (수정됨), rejected (반려됨), accepted (그대로 수락)';
COMMENT ON COLUMN ai_plan_feedback.original_plan IS 'AI가 생성한 원본 플랜 데이터 (JSON)';
COMMENT ON COLUMN ai_plan_feedback.modified_plan IS '관리자가 수정한 플랜 데이터 (JSON)';
COMMENT ON COLUMN ai_plan_feedback.changes_summary IS '변경 내역 요약 (added, removed, modified 카운트 등)';
