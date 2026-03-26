-- ============================================================================
-- Phase D-1: 배치 판정 자동화 — math_variant + placement_snapshots
-- ============================================================================

-- D-1a: 수학 선택과목 구분 필드 추가
ALTER TABLE student_mock_scores
ADD COLUMN IF NOT EXISTS math_variant text
CHECK (math_variant IN ('미적분', '기하', '확률과통계'));

COMMENT ON COLUMN student_mock_scores.math_variant
IS '수학 선택과목 (미적분/기하/확률과통계). NULL이면 subject.name에서 추론 시도';

-- D-1b: 배치 결과 영속화 테이블
CREATE TABLE IF NOT EXISTS student_placement_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_type text NOT NULL CHECK (exam_type IN ('estimated', 'actual', 'pipeline_auto')),
  exam_date text,
  data_year int NOT NULL DEFAULT 2026,
  input_scores jsonb,     -- SuneungScores 원본 (재현용)
  result jsonb NOT NULL,  -- PlacementAnalysisResult 전체
  summary jsonb,          -- PlacementSummary 빠른 접근용
  verdict_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id, tenant_id, exam_type, exam_date)
);

CREATE INDEX idx_placement_snapshots_student
  ON student_placement_snapshots(student_id, created_at DESC);

-- RLS (initplan 최적화 — (SELECT auth.uid()) 패턴)
ALTER TABLE student_placement_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placement_snapshots_admin" ON student_placement_snapshots
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "placement_snapshots_student" ON student_placement_snapshots
  FOR SELECT
  USING (student_id = (SELECT auth.uid()));
