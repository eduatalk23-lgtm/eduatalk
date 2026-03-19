-- ============================================
-- Phase 8.2: 정시 환산 엔진 DB
-- 대학별 환산 config + SUBJECT3 룩업 + 결격사유
-- ============================================

BEGIN;

-- ============================================
-- 1. university_score_configs (대학별 환산 설정, 552행)
-- ============================================

CREATE TABLE IF NOT EXISTS public.university_score_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year           integer NOT NULL,
  university_name     varchar(100) NOT NULL,

  -- 필수/선택/가중택 패턴
  mandatory_pattern   varchar(100) NOT NULL,
  optional_pattern    varchar(100),
  weighted_pattern    varchar(100),

  -- 과목 설정
  inquiry_count       smallint NOT NULL DEFAULT 2,
  math_selection      varchar(10) NOT NULL DEFAULT '가나',
  inquiry_selection   varchar(10) NOT NULL DEFAULT '사과',
  history_substitute  varchar(20),
  foreign_substitute  varchar(20),

  -- 추가 설정
  bonus_rules         jsonb NOT NULL DEFAULT '{}',
  conversion_type     varchar(10) NOT NULL DEFAULT '표+변',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_usc_natural_key
  ON public.university_score_configs(data_year, university_name);

CREATE INDEX IF NOT EXISTS idx_usc_year ON public.university_score_configs(data_year);

CREATE OR REPLACE FUNCTION public.update_university_score_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_university_score_configs_updated_at
  BEFORE UPDATE ON public.university_score_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_university_score_configs_updated_at();

ALTER TABLE public.university_score_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usc_select_all" ON public.university_score_configs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "usc_admin_insert" ON public.university_score_configs
  FOR INSERT TO authenticated WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "usc_admin_update" ON public.university_score_configs
  FOR UPDATE TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "usc_admin_delete" ON public.university_score_configs
  FOR DELETE TO authenticated USING (public.rls_check_is_admin_or_consultant());

-- ============================================
-- 2. university_score_conversions (SUBJECT3 룩업, ~628K행)
-- ============================================

CREATE TABLE IF NOT EXISTS public.university_score_conversions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year           integer NOT NULL,
  university_name     varchar(100) NOT NULL,
  subject             varchar(30) NOT NULL,
  raw_score           smallint NOT NULL,
  converted_score     numeric(8,2) NOT NULL,

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 대학 1개의 전체 변환표 조회용 (핵심 인덱스)
CREATE INDEX IF NOT EXISTS idx_usconv_univ_year
  ON public.university_score_conversions(data_year, university_name);

-- 특정 과목+점수 조회용
CREATE INDEX IF NOT EXISTS idx_usconv_subject_score
  ON public.university_score_conversions(data_year, subject, raw_score);

-- 자연키 (멱등 import)
CREATE UNIQUE INDEX IF NOT EXISTS ux_usconv_natural_key
  ON public.university_score_conversions(data_year, university_name, subject, raw_score);

ALTER TABLE public.university_score_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usconv_select_all" ON public.university_score_conversions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "usconv_admin_insert" ON public.university_score_conversions
  FOR INSERT TO authenticated WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "usconv_admin_update" ON public.university_score_conversions
  FOR UPDATE TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "usconv_admin_delete" ON public.university_score_conversions
  FOR DELETE TO authenticated USING (public.rls_check_is_admin_or_consultant());

-- ============================================
-- 3. university_score_restrictions (결격사유, ~586행)
-- ============================================

CREATE TABLE IF NOT EXISTS public.university_score_restrictions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year           integer NOT NULL,
  university_name     varchar(100) NOT NULL,
  department_name     varchar(200),

  restriction_type    varchar(20) NOT NULL
    CHECK (restriction_type IN ('no_show', 'grade_sum', 'subject_req')),
  rule_config         jsonb NOT NULL DEFAULT '{}',
  description         text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usrestr_univ_year
  ON public.university_score_restrictions(data_year, university_name);

ALTER TABLE public.university_score_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usrestr_select_all" ON public.university_score_restrictions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "usrestr_admin_insert" ON public.university_score_restrictions
  FOR INSERT TO authenticated WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "usrestr_admin_update" ON public.university_score_restrictions
  FOR UPDATE TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "usrestr_admin_delete" ON public.university_score_restrictions
  FOR DELETE TO authenticated USING (public.rls_check_is_admin_or_consultant());

COMMENT ON TABLE public.university_score_configs IS '대학별 정시 환산 설정 (필수/선택/가중택 패턴 + 과목 요건)';
COMMENT ON TABLE public.university_score_conversions IS '과목+표준점수 → 대학별 환산점수 룩업 테이블 (SUBJECT3)';
COMMENT ON TABLE public.university_score_restrictions IS '정시 결격사유 규칙 (수학/탐구 미응시, 등급합, 지정과목)';

COMMIT;
