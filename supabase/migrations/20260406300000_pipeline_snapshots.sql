-- P2-3: 파이프라인 task_results 스냅샷 — 재실행 시 이전 결과 보존
CREATE TABLE IF NOT EXISTS student_record_analysis_pipeline_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES student_record_analysis_pipelines(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_snapshots_student
  ON student_record_analysis_pipeline_snapshots(student_id, created_at DESC);

-- RLS
ALTER TABLE student_record_analysis_pipeline_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sraps_admin_all" ON student_record_analysis_pipeline_snapshots
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT (auth.jwt()->'user_metadata'->>'tenant_id')::uuid));

COMMENT ON TABLE student_record_analysis_pipeline_snapshots IS '파이프라인 재실행 히스토리 — task_results 덮어쓰기 전 자동 스냅샷';
