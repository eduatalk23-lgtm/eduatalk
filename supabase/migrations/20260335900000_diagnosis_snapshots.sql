-- P2-4: 진단 비교 히스토리 — AI 진단 변경 시 이전 상태 스냅샷
CREATE TABLE IF NOT EXISTS student_record_diagnosis_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id uuid NOT NULL REFERENCES student_record_diagnosis(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  student_id uuid NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  school_year int NOT NULL,
  source varchar(20) NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_diag_snapshots_student ON student_record_diagnosis_snapshots(student_id, school_year, source);

-- RLS
ALTER TABLE student_record_diagnosis_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srds_admin_all" ON student_record_diagnosis_snapshots
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT (auth.jwt()->'user_metadata'->>'tenant_id')::uuid));

COMMENT ON TABLE student_record_diagnosis_snapshots IS '진단 변경 히스토리 — upsert 전 이전 상태 자동 스냅샷';
