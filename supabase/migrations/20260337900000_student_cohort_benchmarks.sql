-- ============================================
-- 코호트 벤치마크 스냅샷 테이블
-- tenant-scoped 개인정보 보호 (기관 내 비교만)
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_cohort_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_major VARCHAR(100) NOT NULL,
  school_year INTEGER NOT NULL,
  grade INTEGER CHECK (grade BETWEEN 1 AND 3),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- 코호트 크기
  cohort_size INTEGER NOT NULL DEFAULT 0,

  -- GPA 분포
  avg_gpa NUMERIC(4,2),
  median_gpa NUMERIC(4,2),
  min_gpa NUMERIC(4,2),
  max_gpa NUMERIC(4,2),
  p25_gpa NUMERIC(4,2),
  p75_gpa NUMERIC(4,2),

  -- 역량 평균 (numeric: A+=5, A-=4, B+=3.5, B=3, B-=2.5, C=1.5)
  avg_academic NUMERIC(3,1),
  avg_career NUMERIC(3,1),
  avg_community NUMERIC(3,1),

  -- 콘텐츠 품질 평균
  avg_quality_score NUMERIC(5,1),

  -- 수강 패턴 (JSONB — 상위 10 과목 + 이수율)
  top_courses JSONB,

  -- 입시 결과
  admission_count INTEGER DEFAULT 0,
  acceptance_rate NUMERIC(5,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, target_major, school_year, grade, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_scb_tenant_major
  ON public.student_cohort_benchmarks(tenant_id, target_major);

CREATE INDEX IF NOT EXISTS idx_scb_year
  ON public.student_cohort_benchmarks(school_year);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.student_cohort_benchmarks ENABLE ROW LEVEL SECURITY;

-- admin/consultant: 자기 기관 읽기
CREATE POLICY "cohort_benchmarks_read_own_tenant"
  ON public.student_cohort_benchmarks
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

-- admin만 insert/update/delete (service role은 RLS 우회)
CREATE POLICY "cohort_benchmarks_admin_write"
  ON public.student_cohort_benchmarks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
        AND tenant_id = student_cohort_benchmarks.tenant_id
        AND role IN ('admin', 'super_admin')
    )
  );
