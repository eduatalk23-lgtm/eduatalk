-- ============================================================
-- Phase α (Main Exploration — 4차원 통합 캔버스 인프라)
-- 신규 entity 4종 + cleanup_polymorphic_refs 확장 + 링크 정리 함수
--
-- 합의 모델 (session-handoff-2026-04-15-c):
--   모델 C — 시점·방향 동적 위계
--     데이터: 4 entity 동등 1급 (storyline / roadmap / narrative / main_exploration)
--     의미:  main_exploration = semantic root (시점·방향에 따라 회전)
--
-- 이 파일 범위:
--   1. student_main_explorations         (G1 — 메인 탐구 entity)
--   2. student_exploration_levels        (G2 — 학생 레벨 영속화)
--   3. student_career_tracks             (G15 — 다축 진로 트랙)
--   4. main_exploration_links            (G4 — 4×4 통합 다형 참조)
--   5. cleanup_polymorphic_refs 확장 +
--      cleanup_main_exploration_links 신규 + 대상 테이블 트리거
-- ============================================================

BEGIN;

-- ============================================================
-- 1. student_main_explorations (G1)
--
-- 학기 단위 snapshot. scope × direction × version 으로 병렬 운영.
-- semantic_role 은 시점·방향에 따라 동적으로 회전 (모델 C).
-- tier_plan 은 foundational/development/advanced 3단 구조 강제 (G7 원칙).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_main_explorations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id   UUID REFERENCES public.student_record_analysis_pipelines(id)
                  ON DELETE SET NULL,

  -- 학기 스냅샷 (시간축)
  school_year   INTEGER  NOT NULL,
  grade         SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester      SMALLINT NOT NULL CHECK (semester IN (1, 2)),

  -- scope × track (다축 1차 시민)
  scope         VARCHAR(10) NOT NULL
                  CHECK (scope IN ('overall', 'track', 'grade')),
  track_label   VARCHAR(100),  -- scope='track' 일 때만 의미

  -- 양방향 (분석 ↔ 설계)
  direction     VARCHAR(10) NOT NULL
                  CHECK (direction IN ('analysis', 'design')),

  -- 시점·방향 동적 위계 (모델 C 핵심)
  semantic_role VARCHAR(30) NOT NULL
                  CHECK (semantic_role IN (
                    'hypothesis_root',      -- 1학년 prospective (top-down 가설)
                    'aggregation_target',   -- 1·2학년 분석 (bottom-up 응축)
                    'hybrid_recursion',     -- 2·3학년 prospective (재정렬)
                    'consultant_pin'        -- 컨설턴트 수동 강제
                  )),

  -- 출처
  source                VARCHAR(20) NOT NULL
                          CHECK (source IN ('ai', 'consultant', 'hybrid')),
  pinned_by_consultant  BOOLEAN NOT NULL DEFAULT FALSE,

  -- 버전 체인 (갱신 시 parent 링크, 활성 1건 원칙)
  version           INTEGER NOT NULL DEFAULT 1,
  parent_version_id UUID REFERENCES public.student_main_explorations(id)
                      ON DELETE SET NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  -- 내용
  theme_label     TEXT NOT NULL,
  theme_keywords  TEXT[] NOT NULL DEFAULT '{}',
  career_field    VARCHAR(20),  -- KEDI 코드 (HUM/SOC/EDU/ENG/NAT/MED/ART) or 자유

  -- 3단 위계 plan (structured 강제 — G7 원칙)
  -- {
  --   "foundational": {
  --     "theme": "...",
  --     "key_questions": ["..."],
  --     "suggested_activities": ["..."],
  --     "linked_storyline_ids": [uuid],
  --     "linked_roadmap_item_ids": [uuid],
  --     "linked_guide_ids": [uuid]
  --   },
  --   "development": {...},
  --   "advanced": {...}
  -- }
  tier_plan       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 평가
  identity_alignment_score NUMERIC(4, 3) CHECK (identity_alignment_score BETWEEN 0 AND 1),
  exemplar_reference_ids   UUID[] NOT NULL DEFAULT '{}',

  -- 모델 (drift 추적)
  model_name    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 동일 scope × track × direction × version 중복 방지
  UNIQUE (student_id, scope, track_label, direction, version)
);

COMMENT ON TABLE public.student_main_explorations IS
  'Phase α G1 — 메인 탐구 entity. 4 직교 차원 중 정체성·진로 축. semantic_role 이 시점·방향에 따라 동적으로 회전(모델 C).';
COMMENT ON COLUMN public.student_main_explorations.scope IS
  'overall = 학생 단위 통합 / track = 진로 트랙별(multi-track) / grade = 학년 단위';
COMMENT ON COLUMN public.student_main_explorations.direction IS
  'analysis = 기존 세특 응축(bottom-up) / design = 미래 설계(top-down)';
COMMENT ON COLUMN public.student_main_explorations.semantic_role IS
  '모델 C 동적 위계. 1학년 prospective=hypothesis_root, 분석 단계=aggregation_target, 2·3학년 prospective=hybrid_recursion, 컨설턴트 핀=consultant_pin';
COMMENT ON COLUMN public.student_main_explorations.tier_plan IS
  '3단 위계 JSONB. foundational/development/advanced × {theme, key_questions, suggested_activities, linked_*_ids}. 자유 문장 금지 — structured 강제.';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sme_student_active
  ON public.student_main_explorations (student_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_sme_student_semester
  ON public.student_main_explorations (student_id, school_year, semester);

CREATE INDEX IF NOT EXISTS idx_sme_tenant_student
  ON public.student_main_explorations (tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_sme_pipeline
  ON public.student_main_explorations (pipeline_id)
  WHERE pipeline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sme_parent_version
  ON public.student_main_explorations (parent_version_id)
  WHERE parent_version_id IS NOT NULL;

-- updated_at 트리거
CREATE OR REPLACE TRIGGER set_updated_at_student_main_explorations
  BEFORE UPDATE ON public.student_main_explorations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. student_exploration_levels (G2)
--
-- 학기 단위 snapshot. adequate(적정) / expected(현재) 두 레벨.
-- source='consultant_override' 시 override_reason 강제.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_exploration_levels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,

  school_year   INTEGER  NOT NULL,
  grade         SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester      SMALLINT NOT NULL CHECK (semester IN (1, 2)),

  -- 5단계 레벨 (1=입문, 5=최상위)
  adequate_level      SMALLINT NOT NULL CHECK (adequate_level BETWEEN 1 AND 5),
  expected_level      SMALLINT NOT NULL CHECK (expected_level BETWEEN 1 AND 5),
  adequate_from_gpa   SMALLINT CHECK (adequate_from_gpa BETWEEN 1 AND 5),

  -- 근거 스냅샷
  gpa_average   NUMERIC(4, 2),
  school_tier   VARCHAR(20),

  -- 출처
  source            VARCHAR(20) NOT NULL DEFAULT 'auto'
                      CHECK (source IN ('auto', 'consultant_override')),
  override_reason   TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (student_id, school_year, semester),

  -- consultant_override 시 override_reason 필수
  CHECK (source = 'auto' OR override_reason IS NOT NULL)
);

COMMENT ON TABLE public.student_exploration_levels IS
  'Phase α G2 — 학생 탐구 레벨 영속화. 기존 leveling 모듈의 계산 결과를 학기 단위 스냅샷으로 저장. 활동 격자 cap(Phase β) 의 기반.';

CREATE INDEX IF NOT EXISTS idx_sel_student_semester
  ON public.student_exploration_levels (student_id, school_year, semester);

CREATE INDEX IF NOT EXISTS idx_sel_tenant_student
  ON public.student_exploration_levels (tenant_id, student_id);

CREATE OR REPLACE TRIGGER set_updated_at_student_exploration_levels
  BEFORE UPDATE ON public.student_exploration_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. student_career_tracks (G15)
--
-- 다축 진로. 기존 students.desired_career_field(단일 VARCHAR) 대체가 아닌 확장.
-- priority 1=최우선, is_active=FALSE 로 과거 트랙 보존 가능.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_career_tracks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,

  track_label   VARCHAR(100) NOT NULL,
  career_field  VARCHAR(20),  -- KEDI 코드 권장
  priority      SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 9),
  is_active     BOOLEAN  NOT NULL DEFAULT TRUE,

  source        VARCHAR(20) NOT NULL
                  CHECK (source IN ('student_input', 'consultant', 'ai_inferred')),

  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (student_id, track_label)
);

COMMENT ON TABLE public.student_career_tracks IS
  'Phase α G15 — 다축 진로 트랙. 기존 students.desired_career_field(단일) 확장. student_main_explorations.scope=track 의 대응 엔티티.';

CREATE INDEX IF NOT EXISTS idx_sct_student_active
  ON public.student_career_tracks (student_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_sct_tenant_student
  ON public.student_career_tracks (tenant_id, student_id);

CREATE OR REPLACE TRIGGER set_updated_at_student_career_tracks
  BEFORE UPDATE ON public.student_career_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. main_exploration_links (G4 — 4×4 통합 다형 참조)
--
-- storyline/roadmap_item/narrative_arc/hyperedge/setek_guide/changche_guide/
-- haengteuk_guide/topic_trajectory 와 메인 탐구를 잇는 다형 link.
-- 다형 참조이므로 FK 없음 → cleanup_main_exploration_links() 트리거로 정리.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.main_exploration_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  main_exploration_id   UUID NOT NULL REFERENCES public.student_main_explorations(id)
                          ON DELETE CASCADE,

  linked_type           VARCHAR(30) NOT NULL
                          CHECK (linked_type IN (
                            'storyline',
                            'roadmap_item',
                            'narrative_arc',
                            'hyperedge',
                            'setek_guide',
                            'changche_guide',
                            'haengteuk_guide',
                            'topic_trajectory'
                          )),
  linked_id             UUID NOT NULL,

  -- 어느 tier 에 속하는 연결인가 (tier_plan 의 linked_*_ids 과 정합)
  linked_tier           VARCHAR(20)
                          CHECK (linked_tier IN ('foundational', 'development', 'advanced')),

  -- 연결 강도 / 방향
  strength              NUMERIC(4, 3) CHECK (strength BETWEEN 0 AND 1),
  direction             VARCHAR(20) NOT NULL DEFAULT 'main_to_child'
                          CHECK (direction IN ('main_to_child', 'child_to_main')),

  -- 출처 (AI 자동 링크 vs 컨설턴트 수동)
  source                VARCHAR(20) NOT NULL DEFAULT 'ai'
                          CHECK (source IN ('ai', 'consultant', 'hybrid')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (main_exploration_id, linked_type, linked_id, direction)
);

COMMENT ON TABLE public.main_exploration_links IS
  'Phase α G4 — 4×4 통합 다형 link. 메인 탐구 ↔ 나머지 3 차원(+가이드+trajectory) 연결. 다형 참조 정리는 cleanup_main_exploration_links 트리거 경유.';

CREATE INDEX IF NOT EXISTS idx_mel_main_exploration
  ON public.main_exploration_links (main_exploration_id);

CREATE INDEX IF NOT EXISTS idx_mel_linked
  ON public.main_exploration_links (linked_type, linked_id);

CREATE INDEX IF NOT EXISTS idx_mel_tenant
  ON public.main_exploration_links (tenant_id);

-- ============================================================
-- 5. cleanup_main_exploration_links 신규 함수 + 대상 테이블 트리거
--
-- 다형 참조(main_exploration_links.linked_type)는 FK 가 걸리지 않으므로,
-- 링크 대상 테이블 DELETE 시 관련 link 를 정리하는 트리거 필요.
-- TG_ARGV[0] 로 linked_type 문자열 전달 (cleanup_polymorphic_refs 패턴 동일).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_main_exploration_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'main_exploration_links'
  ) THEN
    DELETE FROM public.main_exploration_links
      WHERE linked_type = TG_ARGV[0] AND linked_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

-- 각 링크 대상 테이블에 AFTER DELETE 트리거 등록
-- (테이블 존재 여부 가드 — IF EXISTS 는 CREATE TRIGGER 에 직접 못 씀)
DO $$
BEGIN
  -- storylines
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_storylines'
  ) THEN
    DROP TRIGGER IF EXISTS tr_storylines_cleanup_main_expl_links
      ON public.student_record_storylines;
    CREATE TRIGGER tr_storylines_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_storylines
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('storyline');
  END IF;

  -- roadmap_items
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_roadmap_items'
  ) THEN
    DROP TRIGGER IF EXISTS tr_roadmap_items_cleanup_main_expl_links
      ON public.student_record_roadmap_items;
    CREATE TRIGGER tr_roadmap_items_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_roadmap_items
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('roadmap_item');
  END IF;

  -- narrative_arc
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_narrative_arc'
  ) THEN
    DROP TRIGGER IF EXISTS tr_narrative_arc_cleanup_main_expl_links
      ON public.student_record_narrative_arc;
    CREATE TRIGGER tr_narrative_arc_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_narrative_arc
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('narrative_arc');
  END IF;

  -- hyperedges
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_hyperedges'
  ) THEN
    DROP TRIGGER IF EXISTS tr_hyperedges_cleanup_main_expl_links
      ON public.student_record_hyperedges;
    CREATE TRIGGER tr_hyperedges_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_hyperedges
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('hyperedge');
  END IF;

  -- setek_guides
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_setek_guides'
  ) THEN
    DROP TRIGGER IF EXISTS tr_setek_guides_cleanup_main_expl_links
      ON public.student_record_setek_guides;
    CREATE TRIGGER tr_setek_guides_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_setek_guides
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('setek_guide');
  END IF;

  -- changche_guides
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_changche_guides'
  ) THEN
    DROP TRIGGER IF EXISTS tr_changche_guides_cleanup_main_expl_links
      ON public.student_record_changche_guides;
    CREATE TRIGGER tr_changche_guides_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_changche_guides
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('changche_guide');
  END IF;

  -- haengteuk_guides
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_haengteuk_guides'
  ) THEN
    DROP TRIGGER IF EXISTS tr_haengteuk_guides_cleanup_main_expl_links
      ON public.student_record_haengteuk_guides;
    CREATE TRIGGER tr_haengteuk_guides_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_haengteuk_guides
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('haengteuk_guide');
  END IF;

  -- topic_trajectories
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_topic_trajectories'
  ) THEN
    DROP TRIGGER IF EXISTS tr_topic_trajectories_cleanup_main_expl_links
      ON public.student_record_topic_trajectories;
    CREATE TRIGGER tr_topic_trajectories_cleanup_main_expl_links
      AFTER DELETE ON public.student_record_topic_trajectories
      FOR EACH ROW EXECUTE FUNCTION public.cleanup_main_exploration_links('topic_trajectory');
  END IF;
END $$;

-- ============================================================
-- 6. RLS — 모든 신규 테이블
--   패턴: admin_tenant (관리자/컨설턴트 ALL)
--        + student_own (SELECT)
--        + parent_student (SELECT)
--   initplan 최적화: 헬퍼 함수는 내부에서 (SELECT auth.uid()) 사용 (기존 준수)
-- ============================================================

-- 6-1. student_main_explorations
ALTER TABLE public.student_main_explorations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sme_admin_all"
  ON public.student_main_explorations FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "sme_student_select"
  ON public.student_main_explorations FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "sme_parent_select"
  ON public.student_main_explorations FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- 6-2. student_exploration_levels
ALTER TABLE public.student_exploration_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel_admin_all"
  ON public.student_exploration_levels FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "sel_student_select"
  ON public.student_exploration_levels FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "sel_parent_select"
  ON public.student_exploration_levels FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- 6-3. student_career_tracks
ALTER TABLE public.student_career_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sct_admin_all"
  ON public.student_career_tracks FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "sct_student_select"
  ON public.student_career_tracks FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "sct_parent_select"
  ON public.student_career_tracks FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- 6-4. main_exploration_links
--   student_id 비정규화 대신 main_exploration_id 를 경유한 subquery 사용.
--   (tenant_id 자체는 admin 확인용으로만 충분)
ALTER TABLE public.main_exploration_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mel_admin_all"
  ON public.main_exploration_links FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "mel_student_select"
  ON public.main_exploration_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.student_main_explorations sme
    WHERE sme.id = main_exploration_id
      AND public.rls_check_student_own(sme.student_id)
  ));

CREATE POLICY "mel_parent_select"
  ON public.main_exploration_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.student_main_explorations sme
    WHERE sme.id = main_exploration_id
      AND public.rls_check_parent_student(sme.student_id)
  ));

COMMIT;
