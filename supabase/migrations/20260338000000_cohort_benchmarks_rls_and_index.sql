-- ============================================
-- 코호트 벤치마크 RLS 강화 + 인덱스 추가
-- #4: SELECT 정책에 role IN ('admin','super_admin','consultant') 조건 추가
-- #5: snapshot_date 인덱스 추가 (최신 스냅샷 조회 최적화)
-- ============================================

-- ─── #4: RLS SELECT 정책 교체 ───────────────────────────────────────────────

DROP POLICY IF EXISTS "cohort_benchmarks_read_own_tenant" ON public.student_cohort_benchmarks;

CREATE POLICY "cohort_benchmarks_read_own_tenant"
  ON public.student_cohort_benchmarks
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin', 'consultant')
    )
  );

-- ─── #5: snapshot_date 내림차순 인덱스 ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_scb_snapshot_date
  ON public.student_cohort_benchmarks(snapshot_date DESC);
