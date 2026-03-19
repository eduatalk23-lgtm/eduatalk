-- ============================================
-- Phase 8.1: 대학 입시 참조 DB
-- 추천선택 26,309건 + 정시 미적분기하 지정 173건
-- tenant_id 없음 (시스템 공유 데이터)
-- ============================================

BEGIN;

-- ============================================
-- 1. university_admissions (수시 전형 + 3개년 입결)
-- ============================================

CREATE TABLE IF NOT EXISTS public.university_admissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year           integer NOT NULL,

  -- 대학 기본 정보
  region              varchar(20),
  university_name     varchar(100) NOT NULL,
  department_type     varchar(20),
  department_name     varchar(200) NOT NULL,

  -- 전형 정보
  admission_type      varchar(50),
  admission_name      varchar(100),
  eligibility         text,
  recruitment_count   text,
  year_change         text,
  change_details      text,
  min_score_criteria  text,
  selection_method    text,
  required_docs       text,
  dual_application    text,
  grade_weight        text,
  subjects_reflected  text,
  career_subjects     text,
  notes               text,
  exam_date           text,

  -- 3개년 경쟁률 { "2025": "3.5", "2024": "남:2.57 여:6.00" }
  competition_rates   jsonb NOT NULL DEFAULT '{}',
  competition_change  text,

  -- 3개년 입결 { "2025": { "basis": "최종등록자평균", "grade": "2.5", "score": "315.2" } }
  admission_results   jsonb NOT NULL DEFAULT '{}',

  -- 3개년 충원 { "2025": "5", "2024": "3" }
  replacements        jsonb NOT NULL DEFAULT '{}',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ua_univ ON public.university_admissions(university_name);
CREATE INDEX IF NOT EXISTS idx_ua_dept ON public.university_admissions(department_name);
CREATE INDEX IF NOT EXISTS idx_ua_type ON public.university_admissions(admission_type);
CREATE INDEX IF NOT EXISTS idx_ua_year ON public.university_admissions(data_year);
CREATE INDEX IF NOT EXISTS idx_ua_dept_type ON public.university_admissions(department_type);

-- 자연키 (멱등 import용) — admission_type 포함: 같은 학과에 교과+종합 전형 병존
CREATE UNIQUE INDEX IF NOT EXISTS ux_ua_natural_key
  ON public.university_admissions(data_year, university_name, department_name, COALESCE(admission_type, ''), COALESCE(admission_name, ''));

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_university_admissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_university_admissions_updated_at
  BEFORE UPDATE ON public.university_admissions
  FOR EACH ROW EXECUTE FUNCTION public.update_university_admissions_updated_at();

-- RLS (시스템 공유: 전체 SELECT, admin만 쓰기)
ALTER TABLE public.university_admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_admissions_select_all"
  ON public.university_admissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "university_admissions_admin_insert"
  ON public.university_admissions FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "university_admissions_admin_update"
  ON public.university_admissions FOR UPDATE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "university_admissions_admin_delete"
  ON public.university_admissions FOR DELETE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant());

COMMENT ON TABLE public.university_admissions IS '대학 입시 참조 데이터 (수시 전형 + 3개년 입결/경쟁률). 시스템 공유, tenant 독립.';

-- ============================================
-- 2. university_math_requirements (정시 미적분/기하 지정)
-- ============================================

CREATE TABLE IF NOT EXISTS public.university_math_requirements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year           integer NOT NULL,
  university_name     varchar(100) NOT NULL,
  admission_name      varchar(100),
  group_type          varchar(10),
  department_type     varchar(20),
  department_name     varchar(200) NOT NULL,
  recruitment_count   text,
  usage_method        text,
  reflected_areas     text,
  korean_req          text,
  math_req            text,
  science_req         text,
  special_notes       text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_umr_univ ON public.university_math_requirements(university_name);
CREATE INDEX IF NOT EXISTS idx_umr_year ON public.university_math_requirements(data_year);

CREATE UNIQUE INDEX IF NOT EXISTS ux_umr_natural_key
  ON public.university_math_requirements(data_year, university_name, department_name, COALESCE(group_type, ''));

CREATE OR REPLACE FUNCTION public.update_university_math_requirements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_university_math_requirements_updated_at
  BEFORE UPDATE ON public.university_math_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_university_math_requirements_updated_at();

ALTER TABLE public.university_math_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_math_requirements_select_all"
  ON public.university_math_requirements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "university_math_requirements_admin_insert"
  ON public.university_math_requirements FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "university_math_requirements_admin_update"
  ON public.university_math_requirements FOR UPDATE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "university_math_requirements_admin_delete"
  ON public.university_math_requirements FOR DELETE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant());

COMMENT ON TABLE public.university_math_requirements IS '정시 미적분/기하 필수 지정 과목 데이터. 시스템 공유.';

COMMIT;
