-- ============================================
-- 수강 계획 테이블 (Course Planning)
-- 학생별 3개년 과목 수강 계획 관리
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_course_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id            UUID NOT NULL REFERENCES public.students(id)
                          ON UPDATE CASCADE ON DELETE CASCADE,
  subject_id            UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  grade                 INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester              INTEGER NOT NULL CHECK (semester IN (1, 2)),
  -- 3단계 상태: recommended → confirmed → completed
  plan_status           VARCHAR(20) NOT NULL DEFAULT 'recommended'
                          CHECK (plan_status IN ('recommended', 'confirmed', 'completed')),
  source                VARCHAR(20) NOT NULL DEFAULT 'auto'
                          CHECK (source IN ('auto', 'consultant', 'student', 'import')),
  recommendation_reason TEXT,
  is_school_offered     BOOLEAN,
  priority              INTEGER DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, subject_id, grade, semester)
);

-- 인덱스
CREATE INDEX idx_scp_student ON public.student_course_plans (student_id);
CREATE INDEX idx_scp_tenant_student ON public.student_course_plans (tenant_id, student_id);
CREATE INDEX idx_scp_status ON public.student_course_plans (plan_status);

-- updated_at 자동 갱신
CREATE TRIGGER set_student_course_plans_updated_at
  BEFORE UPDATE ON public.student_course_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS 정책
-- ============================================
ALTER TABLE public.student_course_plans ENABLE ROW LEVEL SECURITY;

-- Admin/Consultant: 전체 CRUD
CREATE POLICY "student_course_plans_admin_all"
  ON public.student_course_plans FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- Student: 본인 SELECT (추천 포함 보여줌)
CREATE POLICY "student_course_plans_student_read"
  ON public.student_course_plans FOR SELECT
  USING (student_id = (SELECT auth.uid()));

-- Parent: 자녀 SELECT
CREATE POLICY "student_course_plans_parent_read"
  ON public.student_course_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.student_id = student_course_plans.student_id
        AND psl.parent_id = (SELECT auth.uid())
    )
  );
