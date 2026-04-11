-- E2: 경고 히스토리 스냅샷 — 파이프라인 완료 시 RecordWarning[] 자동 저장
CREATE TABLE IF NOT EXISTS student_record_warning_snapshots (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   uuid        NOT NULL REFERENCES student_record_analysis_pipelines(id) ON DELETE CASCADE,
  tenant_id     uuid        NOT NULL REFERENCES tenants(id),
  student_id    uuid        NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_type varchar(20) NOT NULL,   -- 'grade' | 'synthesis'
  grade         smallint,               -- NULL for synthesis
  warnings      jsonb       NOT NULL,   -- RecordWarning[] 직렬화
  warning_count smallint    NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 학생별 최신순 조회
CREATE INDEX idx_warning_snapshots_student
  ON student_record_warning_snapshots(student_id, created_at DESC);

-- 파이프라인당 1개 제한 (중복 방지)
CREATE UNIQUE INDEX idx_warning_snapshots_pipeline
  ON student_record_warning_snapshots(pipeline_id);

-- RLS: tenant scope (initplan 최적화)
ALTER TABLE student_record_warning_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srws_admin_all" ON student_record_warning_snapshots
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT (auth.jwt()->'user_metadata'->>'tenant_id')::uuid));

COMMENT ON TABLE student_record_warning_snapshots IS
  '경고 히스토리 — 파이프���인 완료 시 RecordWarning[] 자동 스냅샷 (E2)';
