-- 4축×3층 통합 아키텍처 (2026-04-16 D 결정 2)
-- pipeline_type CHECK 제약에 past_analytics + blueprint 추가
ALTER TABLE public.student_record_analysis_pipelines
  DROP CONSTRAINT IF EXISTS student_record_analysis_pipelines_pipeline_type_check;

ALTER TABLE public.student_record_analysis_pipelines
  ADD CONSTRAINT student_record_analysis_pipelines_pipeline_type_check
  CHECK (pipeline_type IN ('legacy', 'grade', 'synthesis', 'past_analytics', 'blueprint'));

COMMENT ON COLUMN public.student_record_analysis_pipelines.pipeline_type IS
  'legacy = 기존 15태스크 단일 파이프라인, grade = 학년별, synthesis = 종합, past_analytics = NEIS 과거 서사/진단/전략(A층), blueprint = 진로→3년 수렴 설계(B층)';

-- past_analytics / blueprint 동시성 보호: 학생당 1개 running/pending
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_running_past_analytics_pipeline
  ON public.student_record_analysis_pipelines (student_id, pipeline_type)
  WHERE pipeline_type = 'past_analytics' AND status IN ('running', 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_running_blueprint_pipeline
  ON public.student_record_analysis_pipelines (student_id, pipeline_type)
  WHERE pipeline_type = 'blueprint' AND status IN ('running', 'pending');
