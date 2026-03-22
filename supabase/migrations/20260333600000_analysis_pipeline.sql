-- ============================================
-- Phase B: AI 초기 분석 파이프라인 상태 테이블
-- 컨설턴트가 1-click으로 5개 AI 태스크를 실행하고
-- 진행 상태를 DB에 저장하여 페이지 이탈 후에도 추적
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS student_record_analysis_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by UUID REFERENCES user_profiles(id),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- 태스크별 상태 (pending | running | completed | failed)
  tasks JSONB NOT NULL DEFAULT '{
    "course_recommendation": "pending",
    "guide_matching": "pending",
    "setek_guide": "pending",
    "activity_summary": "pending",
    "competency_analysis": "pending"
  }'::jsonb,

  -- 태스크별 결과 스니펫 (미리보기용, 2줄 요약)
  task_previews JSONB DEFAULT '{}'::jsonb,

  -- 실행 시점의 입력 스냅샷 (target_major 변경 대비)
  input_snapshot JSONB,

  -- 에러 상세 (태스크별 에러 메시지)
  error_details JSONB,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 실행 중인 파이프라인 빠른 조회
CREATE INDEX IF NOT EXISTS idx_pipeline_student_active
  ON student_record_analysis_pipelines (student_id)
  WHERE status IN ('pending', 'running');

-- 학생별 최신 파이프라인 조회
CREATE INDEX IF NOT EXISTS idx_pipeline_student_latest
  ON student_record_analysis_pipelines (student_id, created_at DESC);

-- RLS 정책 (initplan 최적화)
ALTER TABLE student_record_analysis_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_select_own_tenant" ON student_record_analysis_pipelines
  FOR SELECT USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au WHERE au.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "pipeline_insert_own_tenant" ON student_record_analysis_pipelines
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au WHERE au.id = (SELECT auth.uid())
    )
  );

CREATE POLICY "pipeline_update_own_tenant" ON student_record_analysis_pipelines
  FOR UPDATE USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au WHERE au.id = (SELECT auth.uid())
    )
  );

COMMENT ON TABLE student_record_analysis_pipelines IS 'AI 초기 분석 파이프라인 상태 추적 (Phase B)';

COMMIT;
