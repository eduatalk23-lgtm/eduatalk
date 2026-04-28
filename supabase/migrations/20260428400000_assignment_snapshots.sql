-- A2 (2026-04-28): 가이드 배정 drift snapshot
-- exploration_guide_assignments 는 append-only (신규만 INSERT, SKIP) 라
-- "이번 run 에서 어떤 가이드가 새로 배정됐는지 / 어떤 가이드가 이번에 빠졌는지"
-- cross-run 비교가 불가능. pipeline_id 단위 ranked snapshot 을 별도 테이블에 동결.

CREATE TABLE IF NOT EXISTS public.exploration_guide_assignment_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES public.students(id)
                     ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id      UUID NOT NULL REFERENCES public.student_record_analysis_pipelines(id)
                     ON DELETE CASCADE,
  assignment_count INTEGER NOT NULL DEFAULT 0,
  -- assignments_json: [{ guide_id, slot, finalScore, matchReason }, ...]
  assignments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, pipeline_id)
);

ALTER TABLE public.exploration_guide_assignment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_assignment_snapshots" ON public.exploration_guide_assignment_snapshots
  FOR ALL
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.tenant_id = (
        SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_assignment_snapshots_student_computed
  ON public.exploration_guide_assignment_snapshots (student_id, computed_at DESC);

COMMENT ON TABLE public.exploration_guide_assignment_snapshots IS
  'A2 (2026-04-28): pipeline_id별 ranked 가이드 배정 동결. cross-run drift / 신규·탈락 가이드 diff 분석용.';
