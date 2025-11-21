-- Migration: Add tenant_id to core data tables
-- Description: Core Data 테이블에 tenant_id 컬럼 추가 (tenant isolation)
-- Date: 2025-01-07

-- ============================================
-- 1. student_plan 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_plan 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_student_plan_tenant_id ON student_plan(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_plan_tenant_student ON student_plan(tenant_id, student_id);

-- ============================================
-- 2. student_block_schedule 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_block_schedule 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_student_block_schedule_tenant_id ON student_block_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_block_schedule_tenant_student ON student_block_schedule(tenant_id, student_id);

-- ============================================
-- 3. student_school_scores 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_school_scores 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_school_scores_tenant_id ON student_school_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_scores_tenant_student ON student_school_scores(tenant_id, student_id);

-- ============================================
-- 4. student_mock_scores 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_mock_scores 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_mock_scores_tenant_id ON student_mock_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mock_scores_tenant_student ON student_mock_scores(tenant_id, student_id);

-- ============================================
-- 5. student_content_progress 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_content_progress 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_content_progress_tenant_id ON student_content_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_tenant_student ON student_content_progress(tenant_id, student_id);

-- ============================================
-- 6. student_custom_contents 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_custom_contents 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_custom_contents_tenant_id ON student_custom_contents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_contents_tenant_student ON student_custom_contents(tenant_id, student_id);

-- ============================================
-- 7. recommended_contents 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE recommended_contents 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recommended_contents_tenant_id ON recommended_contents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recommended_contents_tenant_student ON recommended_contents(tenant_id, student_id);

-- ============================================
-- 8. student_analysis 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_analysis 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_student_analysis_tenant_id ON student_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_analysis_tenant_student ON student_analysis(tenant_id, student_id);

-- ============================================
-- 9. student_consulting_notes 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_consulting_notes 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_consulting_notes_tenant_id ON student_consulting_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consulting_notes_tenant_student ON student_consulting_notes(tenant_id, student_id);

-- ============================================
-- 10. make_scenario_logs 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE make_scenario_logs 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_make_scenario_logs_tenant_id ON make_scenario_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_make_scenario_logs_tenant_student ON make_scenario_logs(tenant_id, student_id);

-- ============================================
-- 11. student_goals 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_goals 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_student_goals_tenant_id ON student_goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_goals_tenant_student ON student_goals(tenant_id, student_id);

-- ============================================
-- 12. student_goal_progress 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_goal_progress 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_goal_progress_tenant_id ON student_goal_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_tenant_student ON student_goal_progress(tenant_id, student_id);

-- ============================================
-- 13. student_study_sessions 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_study_sessions 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_study_sessions_tenant_id ON student_study_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_tenant_student ON student_study_sessions(tenant_id, student_id);

-- ============================================
-- 14. student_history 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_history 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_student_history_tenant_id ON student_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_history_tenant_student ON student_history(tenant_id, student_id);

-- ============================================
-- 15. books 테이블에 tenant_id 추가 (학생별 책)
-- ============================================

ALTER TABLE books 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_books_tenant_id ON books(tenant_id);

-- student_id 컬럼이 있는 경우에만 인덱스 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'student_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_books_tenant_student ON books(tenant_id, student_id);
  END IF;
END $$;

-- ============================================
-- 16. lectures 테이블에 tenant_id 추가 (학생별 강의)
-- ============================================

ALTER TABLE lectures 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_lectures_tenant_id ON lectures(tenant_id);

-- student_id 컬럼이 있는 경우에만 인덱스 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'student_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_lectures_tenant_student ON lectures(tenant_id, student_id);
  END IF;
END $$;

-- ============================================
-- 17. parent_student_links 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE parent_student_links 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_parent_student_links_tenant_id ON parent_student_links(tenant_id);

-- ============================================
-- 18. 코멘트 추가 (문서화)
-- ============================================

COMMENT ON COLUMN student_plan.tenant_id IS '학습 계획이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_block_schedule.tenant_id IS '블록 스케줄이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_school_scores.tenant_id IS '내신 성적이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_mock_scores.tenant_id IS '모의고사 성적이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_content_progress.tenant_id IS '콘텐츠 진행률이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_custom_contents.tenant_id IS '커스텀 콘텐츠가 속한 기관(tenant) ID';
COMMENT ON COLUMN recommended_contents.tenant_id IS '추천 콘텐츠가 속한 기관(tenant) ID';
COMMENT ON COLUMN student_analysis.tenant_id IS '학생 분석 데이터가 속한 기관(tenant) ID';
COMMENT ON COLUMN student_consulting_notes.tenant_id IS '상담노트가 속한 기관(tenant) ID';
COMMENT ON COLUMN make_scenario_logs.tenant_id IS '시나리오 생성 로그가 속한 기관(tenant) ID';
COMMENT ON COLUMN student_goals.tenant_id IS '학습 목표가 속한 기관(tenant) ID';
COMMENT ON COLUMN student_goal_progress.tenant_id IS '목표 진행률이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_study_sessions.tenant_id IS '학습 세션이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_history.tenant_id IS '학습 히스토리가 속한 기관(tenant) ID';
COMMENT ON COLUMN books.tenant_id IS '책이 속한 기관(tenant) ID';
COMMENT ON COLUMN lectures.tenant_id IS '강의가 속한 기관(tenant) ID';
COMMENT ON COLUMN parent_student_links.tenant_id IS '부모-학생 연결이 속한 기관(tenant) ID';

