-- Auto-Bootstrap Phase 2 (2026-04-18)
-- pipeline_type CHECK 제약에 bootstrap 추가 + 동시성 보호 인덱스
ALTER TABLE public.student_record_analysis_pipelines
  DROP CONSTRAINT IF EXISTS student_record_analysis_pipelines_pipeline_type_check;

ALTER TABLE public.student_record_analysis_pipelines
  ADD CONSTRAINT student_record_analysis_pipelines_pipeline_type_check
  CHECK (pipeline_type IN ('legacy', 'grade', 'synthesis', 'past_analytics', 'blueprint', 'bootstrap'));

COMMENT ON COLUMN public.student_record_analysis_pipelines.pipeline_type IS
  'legacy = 기존 15태스크 단일 파이프라인, grade = 학년별, synthesis = 종합, past_analytics = NEIS 과거 서사/진단/전략(A층), blueprint = 진로→3년 수렴 설계(B층), bootstrap = target_major 진입 자동 셋업(Phase 0)';

-- bootstrap 동시성 보호: 학생당 1개 running/pending
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_running_bootstrap_pipeline
  ON public.student_record_analysis_pipelines (student_id, pipeline_type)
  WHERE pipeline_type = 'bootstrap' AND status IN ('running', 'pending');
