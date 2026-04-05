-- ============================================
-- 동일 학생에 대한 동시 파이프라인 실행 방지
-- partial unique index: status가 pending/running인 행에만 적용
-- ============================================

-- Grade 파이프라인: 학생+학년 단위 1개만 running/pending 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_running_grade_pipeline
  ON student_record_analysis_pipelines (student_id, grade)
  WHERE status IN ('pending', 'running') AND pipeline_type = 'grade';

-- Synthesis 파이프라인: 학생 단위 1개만 running/pending 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_running_synth_pipeline
  ON student_record_analysis_pipelines (student_id)
  WHERE status IN ('pending', 'running') AND pipeline_type = 'synthesis';
