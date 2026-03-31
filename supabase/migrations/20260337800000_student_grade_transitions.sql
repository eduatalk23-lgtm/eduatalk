-- 학기 전환 이력 테이블
-- 학년 승급/졸업 이력을 영속적으로 기록하여 배치 재실행 방지 및 감사 추적

BEGIN;

-- ============================================================
-- 1. student_grade_transitions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_grade_transitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  from_grade      SMALLINT NOT NULL,
  to_grade        SMALLINT NOT NULL,
  school_year     INTEGER NOT NULL,
  transition_type VARCHAR(20) NOT NULL
                    CHECK (transition_type IN ('promotion', 'graduation', 'manual')),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_grade_transitions IS '학기 전환 이력 (학년 승급/졸업) — 배치 재실행 방지 및 감사 추적';
COMMENT ON COLUMN public.student_grade_transitions.from_grade IS '전환 전 학년 (1~3, 졸업=3)';
COMMENT ON COLUMN public.student_grade_transitions.to_grade IS '전환 후 학년 (2~3 또는 0=졸업)';
COMMENT ON COLUMN public.student_grade_transitions.school_year IS '전환이 발생한 학년도 (예: 2026)';
COMMENT ON COLUMN public.student_grade_transitions.transition_type IS 'promotion=학년 승급, graduation=졸업, manual=수동 전환';
COMMENT ON COLUMN public.student_grade_transitions.metadata IS '추가 정보 (dry_run 여부, 배치 실행 ID 등)';

-- ============================================================
-- 2. 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sgt_student
  ON public.student_grade_transitions (student_id);

CREATE INDEX IF NOT EXISTS idx_sgt_year
  ON public.student_grade_transitions (school_year);

CREATE INDEX IF NOT EXISTS idx_sgt_tenant_year
  ON public.student_grade_transitions (tenant_id, school_year);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE public.student_grade_transitions ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 전체 접근 (tenant 범위)
CREATE POLICY "sgt_admin_all"
  ON public.student_grade_transitions FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생: 자신의 이력 조회만 허용
CREATE POLICY "sgt_student_select"
  ON public.student_grade_transitions FOR SELECT
  USING (public.rls_check_student_own(student_id));

COMMIT;
