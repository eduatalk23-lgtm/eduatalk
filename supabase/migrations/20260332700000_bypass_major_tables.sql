-- CMS C1.5: 우회학과 시스템 (5개 테이블 + RLS 헬퍼)
-- Access DB(학과조회4.accdb) 이관 기반 스키마
--
-- 테이블 목록:
--   1. university_departments          (학과 마스터 — 3,658행)
--   2. department_curriculum           (학과별 교과목 — 43,341행)
--   3. department_classification       (표준분류체계 — ~200행)
--   4. bypass_major_pairs              (사전 매핑 우회학과 쌍)
--   5. bypass_major_candidates         (학생별 탐색 후보, runtime)
--
-- 롤백: down_20260332700000_bypass_major_tables.sql

BEGIN;

-- ============================================================
-- 0. RLS 헬퍼: rls_check_bypass_candidate_access
-- ============================================================
-- bypass_major_candidates 접근 체크:
--   admin/consultant for tenant OR 학생 본인.
-- initplan 최적화: (SELECT auth.uid()) 1회 평가.

CREATE OR REPLACE FUNCTION public.rls_check_bypass_candidate_access(
  p_tenant_id  uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    -- admin/consultant for the tenant
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE id = (SELECT auth.uid())
        AND tenant_id = p_tenant_id
        AND role IN ('admin', 'consultant')
    )
    -- OR student themselves
    OR p_student_id = (SELECT auth.uid());
$$;

COMMENT ON FUNCTION public.rls_check_bypass_candidate_access IS '우회학과 후보 접근 체크 — admin/consultant(테넌트) OR 학생 본인 (RLS 헬퍼)';

GRANT EXECUTE ON FUNCTION public.rls_check_bypass_candidate_access(uuid, uuid) TO authenticated;

-- ============================================================
-- 1. university_departments (학과 마스터 — 3,658행)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.university_departments (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id             integer      NOT NULL UNIQUE,
  university_name       text         NOT NULL,
  college_name          text,                            -- 단과대학
  department_name       text         NOT NULL,
  major_classification  text,                            -- 대분류명
  mid_classification    text,                            -- 중분류명
  sub_classification    text,                            -- 소분류명
  classification_code   text,                            -- 분류 코드
  campus                text,                            -- 본캠/분캠
  notes                 text,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.university_departments IS '대학 학과 마스터 (3,658건 Access DB Import)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ud_univ_dept
  ON public.university_departments(university_name, department_name);

CREATE INDEX IF NOT EXISTS idx_ud_major_class
  ON public.university_departments(major_classification)
  WHERE major_classification IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ud_univ_trgm
  ON public.university_departments USING gin(university_name public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ud_dept_trgm
  ON public.university_departments USING gin(department_name public.gin_trgm_ops);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_university_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_university_departments_updated_at
  BEFORE UPDATE ON public.university_departments
  FOR EACH ROW EXECUTE FUNCTION public.update_university_departments_updated_at();

-- ============================================================
-- 2. department_curriculum (학과별 교과목 — 43,341행)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.department_curriculum (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   uuid         NOT NULL REFERENCES public.university_departments(id) ON DELETE CASCADE,
  legacy_id       integer,                               -- Access DB ID
  course_name     text         NOT NULL,
  semester        text,                                  -- 학년학기
  course_type     text,                                  -- 필수/선택/교양
  notes           text,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.department_curriculum IS '학과별 교과목 (43,341건 Access DB Import)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_dc_department
  ON public.department_curriculum(department_id);

CREATE INDEX IF NOT EXISTS idx_dc_course_name
  ON public.department_curriculum(course_name);

CREATE INDEX IF NOT EXISTS idx_dc_course_trgm
  ON public.department_curriculum USING gin(course_name public.gin_trgm_ops);

-- ============================================================
-- 3. department_classification (표준분류체계 — ~200행)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.department_classification (
  id           serial       PRIMARY KEY,
  major_code   text         NOT NULL,
  major_name   text         NOT NULL,                    -- 대분류명
  mid_code     text,
  mid_name     text,                                     -- 중분류명
  sub_code     text,
  sub_name     text,                                     -- 소분류명
  created_at   timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.department_classification IS '학과 표준분류체계 (~200건, 대/중/소분류)';

-- UNIQUE: 모든 코드가 NOT NULL인 경우만 적용
CREATE UNIQUE INDEX IF NOT EXISTS ux_dcls_codes
  ON public.department_classification(major_code, mid_code, sub_code)
  WHERE mid_code IS NOT NULL AND sub_code IS NOT NULL;

-- ============================================================
-- 4. bypass_major_pairs (사전 매핑 우회학과 쌍)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bypass_major_pairs (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id           uuid         NOT NULL REFERENCES public.university_departments(id) ON DELETE CASCADE,
  bypass_department_name  text         NOT NULL,         -- 우회학과 이름
  bypass_department_id    uuid         REFERENCES public.university_departments(id) ON DELETE SET NULL,  -- resolved FK (nullable)
  legacy_management_id    integer,                       -- Access DB 우회학과관리ID
  created_at              timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bypass_major_pairs IS '사전 매핑 우회학과 쌍 (Access DB 우회학과관리 테이블)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bmp_department
  ON public.bypass_major_pairs(department_id);

CREATE INDEX IF NOT EXISTS idx_bmp_bypass_dept
  ON public.bypass_major_pairs(bypass_department_id)
  WHERE bypass_department_id IS NOT NULL;

-- ============================================================
-- 5. bypass_major_candidates (학생별 탐색 후보, runtime)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bypass_major_candidates (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id                  uuid          NOT NULL REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  target_department_id        uuid          NOT NULL REFERENCES public.university_departments(id) ON DELETE CASCADE,
  candidate_department_id     uuid          NOT NULL REFERENCES public.university_departments(id) ON DELETE CASCADE,

  source                      text          NOT NULL DEFAULT 'pre_mapped'
                                CHECK (source IN ('pre_mapped', 'similarity', 'manual')),
  curriculum_similarity_score numeric(5,2),              -- 커리큘럼 유사도 (0-100)
  placement_grade             text,                      -- 배치 등급 (안정/적정/소신 등)
  competency_fit_score        numeric(5,2),              -- 역량 매칭 점수 (0-100)
  composite_score             numeric(5,2),              -- 종합 점수
  rationale                   text,                      -- 추천 근거
  consultant_notes            text,                      -- 컨설턴트 메모
  status                      text          NOT NULL DEFAULT 'candidate'
                                CHECK (status IN ('candidate', 'shortlisted', 'rejected')),
  school_year                 integer       NOT NULL,

  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now(),

  UNIQUE(student_id, target_department_id, candidate_department_id, school_year)
);

COMMENT ON TABLE public.bypass_major_candidates IS '학생별 우회학과 탐색 후보 (pre_mapped/similarity/manual)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bmc_student_year
  ON public.bypass_major_candidates(student_id, school_year);

CREATE INDEX IF NOT EXISTS idx_bmc_target
  ON public.bypass_major_candidates(target_department_id);

CREATE INDEX IF NOT EXISTS idx_bmc_candidate
  ON public.bypass_major_candidates(candidate_department_id);

CREATE INDEX IF NOT EXISTS idx_bmc_active
  ON public.bypass_major_candidates(status)
  WHERE status != 'rejected';

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_bypass_major_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_bypass_major_candidates_updated_at
  BEFORE UPDATE ON public.bypass_major_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_bypass_major_candidates_updated_at();

-- ============================================================
-- 6. RLS 정책
-- ============================================================

-- 6.1 university_departments: 인증 사용자 읽기 + admin/consultant 수정
ALTER TABLE public.university_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ud_select"
  ON public.university_departments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ud_admin_insert"
  ON public.university_departments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "ud_admin_update"
  ON public.university_departments
  FOR UPDATE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "ud_admin_delete"
  ON public.university_departments
  FOR DELETE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant());

-- 6.2 department_curriculum: 인증 사용자 읽기 + admin/consultant 수정
ALTER TABLE public.department_curriculum ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_select"
  ON public.department_curriculum
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "dc_admin_insert"
  ON public.department_curriculum
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "dc_admin_update"
  ON public.department_curriculum
  FOR UPDATE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "dc_admin_delete"
  ON public.department_curriculum
  FOR DELETE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant());

-- 6.3 department_classification: 인증 사용자 읽기 + admin/consultant 수정
ALTER TABLE public.department_classification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dcls_select"
  ON public.department_classification
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "dcls_admin_insert"
  ON public.department_classification
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "dcls_admin_update"
  ON public.department_classification
  FOR UPDATE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "dcls_admin_delete"
  ON public.department_classification
  FOR DELETE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant());

-- 6.4 bypass_major_pairs: 인증 사용자 읽기 + admin/consultant 수정
ALTER TABLE public.bypass_major_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bmp_select"
  ON public.bypass_major_pairs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "bmp_admin_insert"
  ON public.bypass_major_pairs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "bmp_admin_update"
  ON public.bypass_major_pairs
  FOR UPDATE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "bmp_admin_delete"
  ON public.bypass_major_pairs
  FOR DELETE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant());

-- 6.5 bypass_major_candidates: 역할별 접근
ALTER TABLE public.bypass_major_candidates ENABLE ROW LEVEL SECURITY;

-- admin/consultant: full access (tenant-scoped)
CREATE POLICY "bmc_admin_all"
  ON public.bypass_major_candidates
  FOR ALL
  TO authenticated
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- student: read own records only
CREATE POLICY "bmc_student_select"
  ON public.bypass_major_candidates
  FOR SELECT
  TO authenticated
  USING (public.rls_check_student_own(student_id));

-- parent: read linked student records
CREATE POLICY "bmc_parent_select"
  ON public.bypass_major_candidates
  FOR SELECT
  TO authenticated
  USING (public.rls_check_parent_student(student_id));

COMMIT;
