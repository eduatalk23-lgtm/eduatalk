-- Phase V1: Prospective 파이프라인 모드 컬럼 추가
-- student_record_analysis_pipelines 테이블에 mode VARCHAR(20) 추가

ALTER TABLE student_record_analysis_pipelines
  ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'analysis';

COMMENT ON COLUMN student_record_analysis_pipelines.mode IS
  'prospective = 기록 없는 신입생(수강계획+진로 기반), analysis = 기록 있는 학생(기존)';
