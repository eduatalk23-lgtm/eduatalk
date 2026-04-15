-- ============================================================
-- Phase γ (External Validation Infrastructure — G8 + G9 + G16)
--
-- 합의 모델 (session-handoff-2026-04-15-c):
--   외부 검증 3 격차
--     G8  exemplar 메인 탐구 패턴 (records ALTER + narrative_arcs 신규)
--     G9  admission 정합성 가중치 (university_profile_main_inquiry_weights 신규 + seed)
--     G16 exemplar 매칭 RPC (search_exemplar_main_inquiries)
--
-- 전제:
--   - exemplar_records 는 기존 존재 (20260340100000)
--   - student_record_narrative_arc 스키마 동형 (20260414200000)
--   - university_profiles 테이블은 DB에 없음 — UniversityProfile 은 in-code SSOT 유지
--     이 마이그레이션은 **메인 탐구 정합성 축 전용** 가중치 테이블을 신설
--     (책임 분리: 역량 가중치 in-code / 탐구 정합성 가중치 DB)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. G8-A — exemplar_records 에 메인 탐구 패턴 컬럼 추가
-- ============================================================

ALTER TABLE public.exemplar_records
  ADD COLUMN IF NOT EXISTS main_exploration_pattern JSONB,
  ADD COLUMN IF NOT EXISTS main_exploration_extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extractor_version TEXT;

COMMENT ON COLUMN public.exemplar_records.main_exploration_pattern IS
  'exemplar 로부터 추출된 메인 탐구 구조 (student_main_explorations.tier_plan 과 동일 shape). { theme_label, theme_keywords[], career_field, tier_plan: { foundational, development, advanced } }';
COMMENT ON COLUMN public.exemplar_records.main_exploration_extracted_at IS
  'LLM 추출 완료 시각. NULL = 미추출 (레거시 row 또는 파이프라인 미실행)';
COMMENT ON COLUMN public.exemplar_records.extractor_version IS
  '추출기 버전 태그 (예: "v1-gemini-2.5-pro"). 재추출 판단/drift 추적';

-- 추출 pending 조회용 (extractor 스케줄러)
CREATE INDEX IF NOT EXISTS idx_exemplar_records_extraction_pending
  ON public.exemplar_records (main_exploration_extracted_at)
  WHERE main_exploration_pattern IS NULL;

-- career_field 매칭용 (G16 RPC hard filter — pattern->>'career_field')
CREATE INDEX IF NOT EXISTS idx_exemplar_records_career_field
  ON public.exemplar_records ((main_exploration_pattern->>'career_field'))
  WHERE main_exploration_pattern IS NOT NULL;

-- ============================================================
-- 2. G8-B — exemplar_narrative_arcs (exemplar 측 8단계 태깅)
--    student_record_narrative_arc 와 동형. exemplar_records(id) 참조.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exemplar_narrative_arcs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  exemplar_id   UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,

  -- 다형 참조 (exemplar_seteks / exemplar_creative_activities / exemplar_haengteuk)
  record_type   VARCHAR(30) NOT NULL
                  CHECK (record_type IN (
                    'exemplar_setek',
                    'exemplar_creative_activity',
                    'exemplar_haengteuk'
                  )),
  record_id     UUID NOT NULL,

  -- 8단계 존재 플래그 (student_record_narrative_arc 와 동형)
  curiosity_present            BOOLEAN NOT NULL DEFAULT FALSE,
  topic_selection_present      BOOLEAN NOT NULL DEFAULT FALSE,
  inquiry_content_present      BOOLEAN NOT NULL DEFAULT FALSE,
  references_present           BOOLEAN NOT NULL DEFAULT FALSE,
  conclusion_present           BOOLEAN NOT NULL DEFAULT FALSE,
  teacher_observation_present  BOOLEAN NOT NULL DEFAULT FALSE,
  growth_narrative_present     BOOLEAN NOT NULL DEFAULT FALSE,
  reinquiry_present            BOOLEAN NOT NULL DEFAULT FALSE,

  stages_present_count SMALLINT GENERATED ALWAYS AS (
    curiosity_present::int +
    topic_selection_present::int +
    inquiry_content_present::int +
    references_present::int +
    conclusion_present::int +
    teacher_observation_present::int +
    growth_narrative_present::int +
    reinquiry_present::int
  ) STORED,

  -- 단계별 confidence + evidence
  stage_details JSONB NOT NULL DEFAULT '{}'::jsonb,

  source        VARCHAR(10) NOT NULL DEFAULT 'ai'
                  CHECK (source IN ('ai', 'manual')),
  model_name    TEXT,
  extractor_version TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (exemplar_id, record_type, record_id, source)
);

COMMENT ON TABLE public.exemplar_narrative_arcs IS
  'exemplar 측 Layer 3 서사 8단계 태깅. student_record_narrative_arc 동형 (exemplar_records 루트 참조). G16 메인 탐구 매칭의 tier_focus 필터에 활용';

CREATE INDEX IF NOT EXISTS idx_exemplar_narrative_arcs_exemplar
  ON public.exemplar_narrative_arcs (exemplar_id);

CREATE INDEX IF NOT EXISTS idx_exemplar_narrative_arcs_record
  ON public.exemplar_narrative_arcs (record_type, record_id);

CREATE INDEX IF NOT EXISTS idx_exemplar_narrative_arcs_stages
  ON public.exemplar_narrative_arcs (exemplar_id, stages_present_count);

CREATE OR REPLACE TRIGGER set_updated_at_exemplar_narrative_arcs
  BEFORE UPDATE ON public.exemplar_narrative_arcs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.exemplar_narrative_arcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_narrative_arcs_admin_all"
  ON public.exemplar_narrative_arcs FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "exemplar_narrative_arcs_tenant_read"
  ON public.exemplar_narrative_arcs FOR SELECT
  USING (public.rls_check_tenant_member(tenant_id));

-- ============================================================
-- 3. G9 — university_profile_main_inquiry_weights
--    8 track × 10 메인 탐구 카테고리 = 80 행
--
--    역량 가중치(UniversityProfile.competencyWeights)는 in-code 유지.
--    이 테이블은 **메인 탐구 정합성 가중치**만 담당 (5번째 축 전용).
--
--    tenant 독립 global 테이블: 운영팀이 관리하며 전체 tenant 가 공유.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.university_profile_main_inquiry_weights (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track     VARCHAR(30) NOT NULL
              CHECK (track IN (
                'medical', 'law', 'engineering', 'business',
                'humanities', 'education', 'arts', 'social'
              )),
  inquiry_category VARCHAR(30) NOT NULL
              CHECK (inquiry_category IN (
                'natural_science', 'life_medical', 'engineering', 'it_software',
                'social_science', 'humanities', 'law_policy', 'business_economy',
                'education', 'arts_sports'
              )),
  weight    NUMERIC(3,2) NOT NULL
              CHECK (weight >= 0 AND weight <= 1),
  notes     TEXT,
  updated_by UUID,  -- profiles.id (FK 없음 — profiles 테이블이 없을 수도 있는 환경 대응)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (track, inquiry_category)
);

COMMENT ON TABLE public.university_profile_main_inquiry_weights IS
  'G9 — 대학 계열 track × 메인 탐구 카테고리 정합성 가중치 (0.0~1.0). 역량 가중치(in-code UniversityProfile.competencyWeights)와 책임 분리: 이 테이블은 탐구 방향성 축 전용. 운영팀 관리 global 데이터';

CREATE INDEX IF NOT EXISTS idx_upmiw_track
  ON public.university_profile_main_inquiry_weights (track);

CREATE OR REPLACE TRIGGER set_updated_at_upmiw
  BEFORE UPDATE ON public.university_profile_main_inquiry_weights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: 읽기는 인증된 모든 사용자(운영 데이터), 수정은 admin 전역
ALTER TABLE public.university_profile_main_inquiry_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upmiw_authenticated_read"
  ON public.university_profile_main_inquiry_weights FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "upmiw_admin_write"
  ON public.university_profile_main_inquiry_weights FOR ALL
  USING (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
  )
  WITH CHECK (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
  );

-- ─── seed — 8 × 10 = 80 rows ─────────────────────────────────
-- 가중치 설계 원칙:
--   1.0 = 가장 핵심 (해당 track 의 주 탐구 방향)
--   0.7~0.8 = 강한 정합 (보조 탐구 방향)
--   0.4~0.6 = 중간 정합 (융합 가능성)
--   0.1~0.3 = 약한 정합 (주변 주제)
--   0.0 = 정합 없음
-- 운영팀이 대학별 세부 조정 가능.

INSERT INTO public.university_profile_main_inquiry_weights (track, inquiry_category, weight, notes) VALUES
  -- medical (의학/치의학/한의학): 생명·의학 핵심, 자연과학 강함
  ('medical', 'natural_science',  0.60, '화학/물리 기반 이해'),
  ('medical', 'life_medical',     1.00, '핵심 주 방향'),
  ('medical', 'engineering',      0.20, NULL),
  ('medical', 'it_software',      0.30, '의료 AI/진단 기술'),
  ('medical', 'social_science',   0.20, '의료 윤리/보건'),
  ('medical', 'humanities',       0.10, NULL),
  ('medical', 'law_policy',       0.20, '의료법'),
  ('medical', 'business_economy', 0.10, NULL),
  ('medical', 'education',        0.20, '의료 교육'),
  ('medical', 'arts_sports',      0.00, NULL),
  -- law (법학/정치외교)
  ('law',      'natural_science',  0.10, NULL),
  ('law',      'life_medical',     0.10, NULL),
  ('law',      'engineering',      0.10, NULL),
  ('law',      'it_software',      0.20, '디지털법/AI윤리'),
  ('law',      'social_science',   0.80, '핵심 인접'),
  ('law',      'humanities',       0.60, '철학/사학 기반'),
  ('law',      'law_policy',       1.00, '핵심 주 방향'),
  ('law',      'business_economy', 0.60, '상법/경제법'),
  ('law',      'education',        0.30, NULL),
  ('law',      'arts_sports',      0.10, NULL),
  -- engineering (공학/이공계)
  ('engineering', 'natural_science',  0.80, '물리/화학 기반'),
  ('engineering', 'life_medical',     0.30, '바이오공학'),
  ('engineering', 'engineering',      1.00, '핵심 주 방향'),
  ('engineering', 'it_software',      0.90, '강한 인접'),
  ('engineering', 'social_science',   0.20, NULL),
  ('engineering', 'humanities',       0.10, NULL),
  ('engineering', 'law_policy',       0.10, NULL),
  ('engineering', 'business_economy', 0.30, '산업공학/경영'),
  ('engineering', 'education',        0.10, NULL),
  ('engineering', 'arts_sports',      0.10, NULL),
  -- business (경영/경제)
  ('business', 'natural_science',  0.20, NULL),
  ('business', 'life_medical',     0.10, NULL),
  ('business', 'engineering',      0.20, NULL),
  ('business', 'it_software',      0.50, 'MIS/데이터 경영'),
  ('business', 'social_science',   0.70, '심리/사회 연계'),
  ('business', 'humanities',       0.30, NULL),
  ('business', 'law_policy',       0.50, '상법/정책'),
  ('business', 'business_economy', 1.00, '핵심 주 방향'),
  ('business', 'education',        0.20, NULL),
  ('business', 'arts_sports',      0.20, NULL),
  -- humanities (인문/어문/사학/철학)
  ('humanities', 'natural_science',  0.10, NULL),
  ('humanities', 'life_medical',     0.10, NULL),
  ('humanities', 'engineering',      0.10, NULL),
  ('humanities', 'it_software',      0.20, '디지털 인문학'),
  ('humanities', 'social_science',   0.60, '문화/인류학 연계'),
  ('humanities', 'humanities',       1.00, '핵심 주 방향'),
  ('humanities', 'law_policy',       0.50, '법철학'),
  ('humanities', 'business_economy', 0.30, NULL),
  ('humanities', 'education',        0.50, '국문/영문 교육'),
  ('humanities', 'arts_sports',      0.40, '미학/예술사'),
  -- education (사범/교육)
  ('education', 'natural_science',  0.30, '과학교육'),
  ('education', 'life_medical',     0.20, NULL),
  ('education', 'engineering',      0.20, NULL),
  ('education', 'it_software',      0.30, '교육공학'),
  ('education', 'social_science',   0.60, '심리/발달'),
  ('education', 'humanities',       0.70, '국어/영어 교육'),
  ('education', 'law_policy',       0.30, NULL),
  ('education', 'business_economy', 0.30, NULL),
  ('education', 'education',        1.00, '핵심 주 방향'),
  ('education', 'arts_sports',      0.50, '체육/예술 교육'),
  -- arts (예체능)
  ('arts', 'natural_science',  0.10, NULL),
  ('arts', 'life_medical',     0.10, NULL),
  ('arts', 'engineering',      0.20, NULL),
  ('arts', 'it_software',      0.40, '디자인/미디어'),
  ('arts', 'social_science',   0.30, NULL),
  ('arts', 'humanities',       0.40, '예술사/미학'),
  ('arts', 'law_policy',       0.10, NULL),
  ('arts', 'business_economy', 0.20, '문화산업'),
  ('arts', 'education',        0.20, NULL),
  ('arts', 'arts_sports',      1.00, '핵심 주 방향'),
  -- social (사회복지/국제)
  ('social', 'natural_science',  0.20, NULL),
  ('social', 'life_medical',     0.20, '보건·복지'),
  ('social', 'engineering',      0.20, NULL),
  ('social', 'it_software',      0.30, NULL),
  ('social', 'social_science',   1.00, '핵심 주 방향'),
  ('social', 'humanities',       0.60, '국제/지역학'),
  ('social', 'law_policy',       0.80, '사회복지법/정책'),
  ('social', 'business_economy', 0.50, '복지경제'),
  ('social', 'education',        0.30, NULL),
  ('social', 'arts_sports',      0.20, NULL)
ON CONFLICT (track, inquiry_category) DO NOTHING;

-- ============================================================
-- 4. G16 — search_exemplar_main_inquiries RPC
--
--   career hard filter + theme_keywords jaccard ranking.
--   tier_focus 필터는 옵션(해당 tier 에 최소 1 단계 완성된 exemplar).
--   벡터는 Phase δ 확장 대비 placeholder 만.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_exemplar_main_inquiries(
  p_career_field    TEXT DEFAULT NULL,
  p_theme_keywords  TEXT[] DEFAULT NULL,
  p_tier_focus      TEXT DEFAULT NULL,
  p_match_count     INT DEFAULT 20,
  p_min_jaccard     NUMERIC DEFAULT 0.0
)
RETURNS TABLE (
  exemplar_id              UUID,
  anonymous_id             TEXT,
  school_name              TEXT,
  main_exploration_pattern JSONB,
  career_match             BOOLEAN,
  jaccard_similarity       NUMERIC,
  intersection_size        INT,
  union_size               INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      er.id,
      er.anonymous_id,
      er.school_name,
      er.main_exploration_pattern AS pattern,
      er.main_exploration_pattern->>'career_field' AS ex_career,
      COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(er.main_exploration_pattern->'theme_keywords'))),
        ARRAY[]::TEXT[]
      ) AS ex_keywords
    FROM public.exemplar_records er
    WHERE er.main_exploration_pattern IS NOT NULL
      AND (
        p_career_field IS NULL
        OR er.main_exploration_pattern->>'career_field' = p_career_field
      )
      AND (
        p_tier_focus IS NULL
        OR er.main_exploration_pattern->'tier_plan' ? p_tier_focus
      )
  ),
  scored AS (
    SELECT
      c.id,
      c.anonymous_id,
      c.school_name,
      c.pattern,
      (p_career_field IS NOT NULL AND c.ex_career = p_career_field) AS career_matched,
      c.ex_keywords,
      CASE
        WHEN p_theme_keywords IS NULL OR array_length(p_theme_keywords, 1) IS NULL
             OR array_length(c.ex_keywords, 1) IS NULL
          THEN 0
        ELSE cardinality(
          ARRAY(SELECT unnest(c.ex_keywords) INTERSECT SELECT unnest(p_theme_keywords))
        )
      END AS isect,
      CASE
        WHEN p_theme_keywords IS NULL OR array_length(p_theme_keywords, 1) IS NULL
          THEN GREATEST(COALESCE(array_length(c.ex_keywords, 1), 0), 1)
        WHEN array_length(c.ex_keywords, 1) IS NULL
          THEN array_length(p_theme_keywords, 1)
        ELSE cardinality(
          ARRAY(SELECT unnest(c.ex_keywords) UNION SELECT unnest(p_theme_keywords))
        )
      END AS usize
    FROM candidates c
  )
  SELECT
    s.id,
    s.anonymous_id::TEXT,
    s.school_name::TEXT,
    s.pattern,
    s.career_matched,
    CASE WHEN s.usize = 0 THEN 0::NUMERIC
         ELSE ROUND(s.isect::NUMERIC / s.usize::NUMERIC, 4)
    END AS jaccard,
    s.isect,
    s.usize
  FROM scored s
  WHERE
    (p_theme_keywords IS NULL) OR (s.usize > 0 AND s.isect::NUMERIC / s.usize::NUMERIC >= p_min_jaccard)
  ORDER BY
    s.career_matched DESC,
    CASE WHEN s.usize = 0 THEN 0 ELSE s.isect::NUMERIC / s.usize::NUMERIC END DESC,
    s.id
  LIMIT GREATEST(p_match_count, 1);
END;
$$;

COMMENT ON FUNCTION public.search_exemplar_main_inquiries IS
  'G16 — exemplar 메인 탐구 패턴 매칭. career_field hard filter + theme_keywords jaccard similarity. tier_focus 옵션으로 특정 tier 완성된 exemplar 필터. 벡터 유사도는 Phase δ 임베딩 파이프라인 완성 후 확장';

COMMIT;
