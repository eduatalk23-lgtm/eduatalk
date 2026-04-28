-- A1 (2026-04-28): Hyperedge snapshot
-- edge_snapshots 패턴 차용. student_record_hyperedges (현재 상태) 와 별개로
-- pipeline_id 단위 JSONB 동결을 누적하여 cross-run drift / theme stability 분석 자산화.

CREATE TABLE IF NOT EXISTS public.student_record_hyperedge_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.students(id)
                    ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES public.student_record_analysis_pipelines(id)
                    ON DELETE CASCADE,
  hyperedge_count INTEGER NOT NULL DEFAULT 0,
  hyperedges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, pipeline_id)
);

ALTER TABLE public.student_record_hyperedge_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_hyperedge_snapshots" ON public.student_record_hyperedge_snapshots
  FOR ALL
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.tenant_id = (
        SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_hyperedge_snapshots_student_computed
  ON public.student_record_hyperedge_snapshots (student_id, computed_at DESC);

COMMENT ON TABLE public.student_record_hyperedge_snapshots IS
  'A1 (2026-04-28): pipeline_id별 hyperedge JSONB 동결. cross-run theme stability / drift 분석용.';
