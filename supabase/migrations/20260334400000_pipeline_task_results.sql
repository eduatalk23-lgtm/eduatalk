-- ============================================
-- 파이프라인 task_results JSONB 컬럼 추가
-- AI 분석 원본 결과를 태스크별로 저장하여
-- 페이지 이탈 후에도 분석 결과 재로드 가능
-- ============================================

BEGIN;

ALTER TABLE student_record_analysis_pipelines
  ADD COLUMN IF NOT EXISTS task_results JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN student_record_analysis_pipelines.task_results
  IS '태스크별 AI 분석 원본 결과 (connections, storylines 등)';

COMMIT;
