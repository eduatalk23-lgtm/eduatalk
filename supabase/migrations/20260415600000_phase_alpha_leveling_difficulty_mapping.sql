-- ============================================================
-- Phase α G6 — 3단 난이도 ↔ 5단 레벨 매핑 함수
--
-- 2겹 활동 격자에서 두 분류 체계를 잇는 SQL 함수.
--   1겹 주제 클러스터 깊이: basic / intermediate / advanced (3단)
--   2겹 학생 레벨 cap:      1 ~ 5 (5단)
--
-- 매핑 규칙 (session-handoff-2026-04-15-c 확정):
--   1~2 → basic
--   3   → intermediate
--   4~5 → advanced
-- ============================================================

BEGIN;

-- ============================================================
-- 1. leveling_to_difficulty(level) — 학생 레벨 → 도달 가능 최대 난이도
-- ============================================================

CREATE OR REPLACE FUNCTION public.leveling_to_difficulty(p_level SMALLINT)
RETURNS VARCHAR
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_level IS NULL THEN NULL
    WHEN p_level <= 2 THEN 'basic'
    WHEN p_level = 3  THEN 'intermediate'
    WHEN p_level >= 4 THEN 'advanced'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.leveling_to_difficulty(SMALLINT) IS
  'Phase α G6 — 5단 학생 레벨 → 3단 난이도 cap 매핑. Phase β 가이드 배정 CHECK 제약·필터링에 사용.';

-- ============================================================
-- 2. difficulty_to_leveling_floor(difficulty) — 난이도 → 최소 요구 레벨
-- ============================================================

CREATE OR REPLACE FUNCTION public.difficulty_to_leveling_floor(p_difficulty VARCHAR)
RETURNS SMALLINT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_difficulty
    WHEN 'basic'        THEN 1::SMALLINT
    WHEN 'intermediate' THEN 3::SMALLINT
    WHEN 'advanced'     THEN 4::SMALLINT
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.difficulty_to_leveling_floor(VARCHAR) IS
  'Phase α G6 — 3단 난이도 → 5단 레벨 최소 요구 매핑. 역방향(가이드 → 학생 자격 체크)에 사용.';

-- ============================================================
-- 3. 왕복 일치성 검증 코멘트 (문서화 목적)
--   leveling_to_difficulty(1) = basic, difficulty_to_leveling_floor(basic) = 1 ✓
--   leveling_to_difficulty(3) = intermediate, difficulty_to_leveling_floor(intermediate) = 3 ✓
--   leveling_to_difficulty(4) = advanced, difficulty_to_leveling_floor(advanced) = 4 ✓
--   단, 2 → basic(floor 1), 5 → advanced(floor 4) 는 비손실 왕복이 아님 (cap 성격).
-- ============================================================

COMMIT;
