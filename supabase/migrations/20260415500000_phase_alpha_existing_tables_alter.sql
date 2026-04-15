-- ============================================================
-- Phase α — 기존 테이블 확장 (학기 1급화 G5 + main_exploration 역방향 캐시 + G14)
--
-- 1. 학기 1급화(G5): storylines / narrative_arc / hyperedges / guide 3종 에
--    semester 컬럼 추가 (roadmap_items 는 이미 있음).
-- 2. main_exploration_id + main_exploration_tier 핫패스 조회 캐시:
--    SSOT 는 main_exploration_links. 단일 탐구 컨텍스트 join 생략용.
-- 3. G14: student_record_topic_trajectories ↔ main_exploration 연결.
--
-- 모두 nullable. 기존 데이터는 그대로 유지되며 신규 레코드부터 채워짐.
-- ============================================================

BEGIN;

-- ============================================================
-- 공통 CHECK 매크로 (tier 문자열 제약)
--   foundational < development < advanced — 2겹 격자 1겹(깊이) 과 동일 분류
-- ============================================================

-- ============================================================
-- 1. student_record_storylines
--   storyline 은 3학년 span 엔티티이므로 단일 학기 값 부여 부적합.
--   기존 grade_1_theme/grade_2_theme/grade_3_theme 학년축 유지 + semester_themes JSONB 로
--   6학기 테마 확장. 실제 키 포맷: { "<school_year>-<semester>": "테마" } (예: "2025-1").
-- ============================================================

ALTER TABLE public.student_record_storylines
  ADD COLUMN IF NOT EXISTS semester_themes       JSONB  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

COMMENT ON COLUMN public.student_record_storylines.semester_themes IS
  'G5 학기 1급화. 형식 { "<school_year>-<semester>": "테마" }. 기존 grade_N_theme 는 학년축 유지 (mutex 아님).';
COMMENT ON COLUMN public.student_record_storylines.main_exploration_id IS
  '메인 탐구 핫패스 캐시. SSOT 는 main_exploration_links. NULL 허용 = 미연결 상태.';

CREATE INDEX IF NOT EXISTS idx_storylines_main_exploration
  ON public.student_record_storylines (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

-- ============================================================
-- 2. student_record_narrative_arc
-- ============================================================

ALTER TABLE public.student_record_narrative_arc
  ADD COLUMN IF NOT EXISTS semester              SMALLINT
    CHECK (semester IS NULL OR semester IN (1, 2)),
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_srna_main_exploration
  ON public.student_record_narrative_arc (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_srna_student_semester
  ON public.student_record_narrative_arc (student_id, school_year, semester)
  WHERE semester IS NOT NULL;

-- ============================================================
-- 3. student_record_hyperedges
-- ============================================================

ALTER TABLE public.student_record_hyperedges
  ADD COLUMN IF NOT EXISTS semester              SMALLINT
    CHECK (semester IS NULL OR semester IN (1, 2)),
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

COMMENT ON COLUMN public.student_record_hyperedges.semester IS
  'G5 — members 가 여러 학기를 span 하는 경우 가장 최근 또는 대표 학기. 세부는 members JSONB 각 원소에.';

CREATE INDEX IF NOT EXISTS idx_hyperedges_main_exploration
  ON public.student_record_hyperedges (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

-- ============================================================
-- 4. student_record_roadmap_items
--   semester 는 이미 있음 (20260331200000:133). main_exploration_* 만 추가.
-- ============================================================

ALTER TABLE public.student_record_roadmap_items
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_roadmap_items_main_exploration
  ON public.student_record_roadmap_items (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

-- ============================================================
-- 5. student_record_setek_guides
-- ============================================================

ALTER TABLE public.student_record_setek_guides
  ADD COLUMN IF NOT EXISTS semester              SMALLINT
    CHECK (semester IS NULL OR semester IN (1, 2)),
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_setek_guides_main_exploration
  ON public.student_record_setek_guides (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

-- ============================================================
-- 6. student_record_changche_guides
-- ============================================================

ALTER TABLE public.student_record_changche_guides
  ADD COLUMN IF NOT EXISTS semester              SMALLINT
    CHECK (semester IS NULL OR semester IN (1, 2)),
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_changche_guides_main_exploration
  ON public.student_record_changche_guides (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

-- ============================================================
-- 7. student_record_haengteuk_guides
-- ============================================================

ALTER TABLE public.student_record_haengteuk_guides
  ADD COLUMN IF NOT EXISTS semester              SMALLINT
    CHECK (semester IS NULL OR semester IN (1, 2)),
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_haengteuk_guides_main_exploration
  ON public.student_record_haengteuk_guides (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

-- ============================================================
-- 8. student_record_topic_trajectories (G14)
--   핵심 플로우: upsertTopicTrajectory 시 활성 main_exploration 자동 연결.
-- ============================================================

ALTER TABLE public.student_record_topic_trajectories
  ADD COLUMN IF NOT EXISTS main_exploration_id   UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_topic_trajectories_main_exploration
  ON public.student_record_topic_trajectories (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

COMMENT ON COLUMN public.student_record_topic_trajectories.main_exploration_id IS
  'G14 — 주제 궤적이 메인 탐구에 속하는지. upsertTopicTrajectory 시 활성 메인 탐구 자동 연결. 컨설턴트 promoteTrajectoryToMainExploration 으로 역방향 승격 가능.';

COMMIT;
