-- 학년 단위 독립 파이프라인 재구조화 (Step 1: 기반 레이어)
-- student_record_analysis_pipelines 테이블에 grade/pipeline_type/parent_pipeline_id 추가

ALTER TABLE student_record_analysis_pipelines
  ADD COLUMN IF NOT EXISTS grade SMALLINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pipeline_type VARCHAR(20) DEFAULT 'legacy'
    CHECK (pipeline_type IN ('legacy', 'grade', 'synthesis')),
  ADD COLUMN IF NOT EXISTS parent_pipeline_id UUID REFERENCES student_record_analysis_pipelines(id);

COMMENT ON COLUMN student_record_analysis_pipelines.grade IS
  'grade 파이프라인일 때 처리 대상 학년 (1/2/3). legacy/synthesis는 NULL.';

COMMENT ON COLUMN student_record_analysis_pipelines.pipeline_type IS
  'legacy = 기존 15태스크 단일 파이프라인, grade = 학년별 5태스크, synthesis = 종합 10태스크';

COMMENT ON COLUMN student_record_analysis_pipelines.parent_pipeline_id IS
  'grade 파이프라인에서 소속되는 synthesis 파이프라인 ID (또는 그룹 루트 ID). NULL = 독립 실행.';

-- grade 파이프라인 조회용 인덱스 (학생 + 학년 + 타입)
CREATE INDEX IF NOT EXISTS idx_pipeline_student_grade
  ON student_record_analysis_pipelines (student_id, grade, pipeline_type)
  WHERE pipeline_type = 'grade';

-- synthesis 파이프라인 조회용 인덱스 (학생 + 타입)
CREATE INDEX IF NOT EXISTS idx_pipeline_student_synthesis
  ON student_record_analysis_pipelines (student_id, pipeline_type)
  WHERE pipeline_type = 'synthesis';
