-- ============================================
-- Phase 5: 진단 DB — 역량 평가 + 활동 태그 + 종합 진단 + 보완전략
-- 4개 테이블, RLS 12개, 트리거 3개, 인덱스 8개
-- ============================================

-- ============================================
-- 1. student_record_competency_scores (역량 평가)
-- 3대 역량(학업/진로/공동체) × 10개 항목 등급
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_competency_scores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  scope            varchar(20) NOT NULL DEFAULT 'yearly'
                     CHECK (scope IN ('yearly', 'cumulative')),
  competency_area  varchar(30) NOT NULL
                     CHECK (competency_area IN ('academic', 'career', 'community')),
  competency_item  varchar(40) NOT NULL
                     CHECK (competency_item IN (
                       'academic_achievement', 'academic_attitude', 'academic_inquiry',
                       'career_course_effort', 'career_course_achievement', 'career_exploration',
                       'community_collaboration', 'community_caring',
                       'community_integrity', 'community_leadership'
                     )),
  grade_value       varchar(5) NOT NULL
                     CHECK (grade_value IN ('A+', 'A-', 'B+', 'B', 'B-', 'C')),
  notes            text,
  evaluated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year, scope, competency_item)
);

ALTER TABLE public.student_record_competency_scores ENABLE ROW LEVEL SECURITY;

-- Admin/Consultant: 자기 tenant 내 전체 CRUD
CREATE POLICY "srcs_admin_all"
  ON public.student_record_competency_scores FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- Student: 자기 데이터 읽기 전용
CREATE POLICY "srcs_student_select"
  ON public.student_record_competency_scores FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- Parent: 연결된 자녀 읽기 전용
CREATE POLICY "srcs_parent_select"
  ON public.student_record_competency_scores FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_srcs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_srcs_updated_at
  BEFORE UPDATE ON public.student_record_competency_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_srcs_updated_at();

-- ============================================
-- 2. student_record_activity_tags (활동별 역량 태그)
-- 세특/창체/행특 기록에 역량 태그 연결 (다형 junction)
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_activity_tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  record_type      varchar(30) NOT NULL
                     CHECK (record_type IN (
                       'setek', 'personal_setek', 'changche', 'haengteuk'
                     )),
  record_id        uuid NOT NULL,
  competency_item  varchar(40) NOT NULL
                     CHECK (competency_item IN (
                       'academic_achievement', 'academic_attitude', 'academic_inquiry',
                       'career_course_effort', 'career_course_achievement', 'career_exploration',
                       'community_collaboration', 'community_caring',
                       'community_integrity', 'community_leadership'
                     )),
  evaluation       varchar(20) NOT NULL DEFAULT 'positive'
                     CHECK (evaluation IN ('positive', 'negative', 'needs_review')),
  evidence_summary text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_record_activity_tags ENABLE ROW LEVEL SECURITY;

-- Admin/Consultant: 자기 tenant 내 전체 CRUD
CREATE POLICY "srat_admin_all"
  ON public.student_record_activity_tags FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- Student: 자기 데이터 읽기 전용
CREATE POLICY "srat_student_select"
  ON public.student_record_activity_tags FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- Parent: 연결된 자녀 읽기 전용
CREATE POLICY "srat_parent_select"
  ON public.student_record_activity_tags FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================
-- 3. student_record_diagnosis (종합 진단)
-- 학생별 학년도 단위 종합 진단 보고서
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_diagnosis (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year           integer NOT NULL,
  overall_grade         varchar(5) NOT NULL DEFAULT 'B'
                          CHECK (overall_grade IN ('A+', 'A-', 'B+', 'B', 'B-', 'C')),
  record_direction      varchar(50),
  direction_strength    varchar(20) DEFAULT 'moderate'
                          CHECK (direction_strength IN ('strong', 'moderate', 'weak')),
  strengths             text[] NOT NULL DEFAULT '{}',
  weaknesses            text[] NOT NULL DEFAULT '{}',
  recommended_majors    text[] NOT NULL DEFAULT '{}',
  strategy_notes        text,
  evaluated_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluated_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year)
);

ALTER TABLE public.student_record_diagnosis ENABLE ROW LEVEL SECURITY;

-- Admin/Consultant: 자기 tenant 내 전체 CRUD
CREATE POLICY "srd_admin_all"
  ON public.student_record_diagnosis FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- Student: 자기 데이터 읽기 전용
CREATE POLICY "srd_student_select"
  ON public.student_record_diagnosis FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- Parent: 연결된 자녀 읽기 전용
CREATE POLICY "srd_parent_select"
  ON public.student_record_diagnosis FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_srd_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_srd_updated_at
  BEFORE UPDATE ON public.student_record_diagnosis
  FOR EACH ROW EXECUTE FUNCTION public.update_srd_updated_at();

-- ============================================
-- 4. student_record_strategies (보완전략)
-- 학년별 영역별 보완전략 가이드
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_strategies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  target_area      varchar(30) NOT NULL
                     CHECK (target_area IN (
                       'autonomy', 'club', 'career',
                       'setek', 'personal_setek', 'reading',
                       'haengteuk', 'score', 'general'
                     )),
  target_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  strategy_content  text NOT NULL DEFAULT '',
  priority          varchar(20) DEFAULT 'medium'
                      CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status            varchar(20) NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned', 'in_progress', 'done')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_record_strategies ENABLE ROW LEVEL SECURITY;

-- Admin/Consultant: 자기 tenant 내 전체 CRUD
CREATE POLICY "srst_admin_all"
  ON public.student_record_strategies FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- Student: 자기 데이터 읽기 전용
CREATE POLICY "srst_student_select"
  ON public.student_record_strategies FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- Parent: 연결된 자녀 읽기 전용
CREATE POLICY "srst_parent_select"
  ON public.student_record_strategies FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_srst_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_srst_updated_at
  BEFORE UPDATE ON public.student_record_strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_srst_updated_at();

-- ============================================
-- 5. 인덱스
-- ============================================

-- competency_scores
CREATE INDEX IF NOT EXISTS idx_srcs_student_year ON public.student_record_competency_scores(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srcs_tenant ON public.student_record_competency_scores(tenant_id);

-- activity_tags
CREATE INDEX IF NOT EXISTS idx_srat_record ON public.student_record_activity_tags(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_srat_student ON public.student_record_activity_tags(student_id);
CREATE INDEX IF NOT EXISTS idx_srat_tenant ON public.student_record_activity_tags(tenant_id);

-- diagnosis
CREATE INDEX IF NOT EXISTS idx_srd_student_year ON public.student_record_diagnosis(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srd_tenant ON public.student_record_diagnosis(tenant_id);

-- strategies
CREATE INDEX IF NOT EXISTS idx_srst_student_year ON public.student_record_strategies(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srst_tenant ON public.student_record_strategies(tenant_id);
