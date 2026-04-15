-- ============================================================
-- Phase β G10 — exploration_guide_assignments 격자 cap 컬럼 확장
--
-- 합의 모델 (session-handoff-2026-04-15-c, 2026-04-15-e):
--   2겹 활동 격자 중 2겹(학년 + 내신 cap) 을 배정 테이블에서 영속화.
--   기존 컬럼 school_year/grade 만으로는 난이도 cap·클러스터 깊이·학기·메인 탐구 연결을
--   추적할 수 없어 Phase β 의 autoRecommend 필터·부스팅 결과가 저장 단계에서 사라짐.
--
-- 추가 컬럼:
--   difficulty_level           — 배정 시점 가이드 난이도 (basic/intermediate/advanced)
--   topic_cluster_id           — 주제 클러스터 (1겹 깊이 체인의 앵커)
--   student_level_at_assign    — 배정 시점 학생 레벨 (1~5)
--   semester                   — G5 학기 1급화
--   main_exploration_id        — 활성 메인 탐구 (SSOT 는 main_exploration_links)
--   main_exploration_tier      — 메인 탐구 내 어느 tier 에 배정되었는지
--   assignment_source          — auto/consultant/ai_pipeline (출처 추적)
--   override_reason            — difficulty cap 초과 허용 사유 (CHECK 우회)
--
-- CHECK 제약:
--   difficulty_to_leveling_floor(difficulty_level) <= student_level_at_assign
--   단, override_reason 이 있으면 우회 허용 (컨설턴트 의도적 상향 배정).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 컬럼 추가
-- ============================================================

ALTER TABLE public.exploration_guide_assignments
  ADD COLUMN IF NOT EXISTS difficulty_level        VARCHAR(20)
    CHECK (difficulty_level IS NULL
           OR difficulty_level IN ('basic', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS topic_cluster_id        UUID
    REFERENCES public.exploration_guide_topic_clusters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS student_level_at_assign SMALLINT
    CHECK (student_level_at_assign IS NULL
           OR student_level_at_assign BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS semester                SMALLINT
    CHECK (semester IS NULL OR semester IN (1, 2)),
  ADD COLUMN IF NOT EXISTS main_exploration_id     UUID
    REFERENCES public.student_main_explorations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_exploration_tier   VARCHAR(20)
    CHECK (main_exploration_tier IS NULL
           OR main_exploration_tier IN ('foundational', 'development', 'advanced')),
  ADD COLUMN IF NOT EXISTS assignment_source       VARCHAR(20) NOT NULL DEFAULT 'consultant'
    CHECK (assignment_source IN ('auto', 'consultant', 'ai_pipeline', 'ai_recommended')),
  ADD COLUMN IF NOT EXISTS override_reason         TEXT;

COMMENT ON COLUMN public.exploration_guide_assignments.difficulty_level IS
  'Phase β G10 — 배정 시점 가이드 난이도 스냅샷(exploration_guides.difficulty_level 와 독립, 전학·변경 대비).';
COMMENT ON COLUMN public.exploration_guide_assignments.topic_cluster_id IS
  'Phase β G10 — 주제 클러스터. 1겹 깊이 체인 조회 및 sequel 추천 앵커.';
COMMENT ON COLUMN public.exploration_guide_assignments.student_level_at_assign IS
  'Phase β G10 — 배정 시점 학생 레벨(1~5). 후일 격자 cap 회고 분석용 스냅샷.';
COMMENT ON COLUMN public.exploration_guide_assignments.semester IS
  'G5 학기 1급화. 기존 school_year/grade 에 semester 추가.';
COMMENT ON COLUMN public.exploration_guide_assignments.main_exploration_id IS
  '배정 당시 활성 메인 탐구. SSOT 는 main_exploration_links — 이 컬럼은 핫패스 캐시.';
COMMENT ON COLUMN public.exploration_guide_assignments.assignment_source IS
  '배정 출처: auto(autoRecommend) / consultant(수동) / ai_pipeline(synthesis) / ai_recommended(사유 제시).';
COMMENT ON COLUMN public.exploration_guide_assignments.override_reason IS
  '난이도 cap 우회 사유. 비어있으면 CHECK 제약 적용.';

-- ============================================================
-- 2. CHECK 제약 — difficulty_level <= cap(student_level_at_assign)
--
-- 이미 존재할 수 있으므로 DROP IF EXISTS → ADD 패턴.
-- IMMUTABLE 함수(difficulty_to_leveling_floor)를 CHECK 에서 사용 가능.
-- override_reason 이 비어있지 않으면 우회 허용.
-- 둘 중 하나라도 NULL 이면 통과 (점진 마이그레이션 안전).
-- ============================================================

ALTER TABLE public.exploration_guide_assignments
  DROP CONSTRAINT IF EXISTS exploration_guide_assignments_difficulty_cap_check;

ALTER TABLE public.exploration_guide_assignments
  ADD CONSTRAINT exploration_guide_assignments_difficulty_cap_check
  CHECK (
    difficulty_level IS NULL
    OR student_level_at_assign IS NULL
    OR (override_reason IS NOT NULL AND length(trim(override_reason)) > 0)
    OR public.difficulty_to_leveling_floor(difficulty_level) <= student_level_at_assign
  );

-- ============================================================
-- 3. 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ega_main_exploration
  ON public.exploration_guide_assignments (main_exploration_id)
  WHERE main_exploration_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ega_topic_cluster
  ON public.exploration_guide_assignments (topic_cluster_id)
  WHERE topic_cluster_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ega_semester
  ON public.exploration_guide_assignments (student_id, school_year, semester)
  WHERE semester IS NOT NULL;

COMMIT;
