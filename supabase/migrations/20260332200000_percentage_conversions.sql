-- ============================================
-- Phase 8.2b: 가중택 경로 — PERCENTAGE 변환 + configs 확장
-- ============================================

BEGIN;

-- ============================================
-- 1. university_percentage_conversions (PERCENTAGE 시트, ~883K행)
-- ============================================

CREATE TABLE IF NOT EXISTS public.university_percentage_conversions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year           integer NOT NULL,
  university_name     varchar(100) NOT NULL,
  track               varchar(10) NOT NULL,
  percentile          smallint NOT NULL,
  converted_score     numeric(8,2) NOT NULL,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_upct_natural_key
  ON public.university_percentage_conversions(data_year, university_name, track, percentile);

CREATE INDEX IF NOT EXISTS idx_upct_univ_year
  ON public.university_percentage_conversions(data_year, university_name);

ALTER TABLE public.university_percentage_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upct_select_all" ON public.university_percentage_conversions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "upct_admin_insert" ON public.university_percentage_conversions
  FOR INSERT TO authenticated WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "upct_admin_update" ON public.university_percentage_conversions
  FOR UPDATE TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());
CREATE POLICY "upct_admin_delete" ON public.university_percentage_conversions
  FOR DELETE TO authenticated USING (public.rls_check_is_admin_or_consultant());

COMMENT ON TABLE public.university_percentage_conversions IS '누적백분위 → 대학별 환산총점 (가중택 경로, PERCENTAGE 시트)';

-- ============================================
-- 2. university_score_configs 확장
-- ============================================

-- mandatory_pattern NOT NULL → nullable (가중택-only 대학용)
ALTER TABLE public.university_score_configs
  ALTER COLUMN mandatory_pattern DROP NOT NULL;

-- scoring_path: 'subject' (경로A) 또는 'percentage' (경로B)
ALTER TABLE public.university_score_configs
  ADD COLUMN IF NOT EXISTS scoring_path varchar(10) NOT NULL DEFAULT 'subject';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'usc_scoring_path_check'
  ) THEN
    ALTER TABLE public.university_score_configs
      ADD CONSTRAINT usc_scoring_path_check
      CHECK (scoring_path IN ('subject', 'percentage'));
  END IF;
END $$;

COMMIT;
