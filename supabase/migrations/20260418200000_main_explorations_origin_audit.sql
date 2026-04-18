-- Phase 3 Auto-Bootstrap (2026-04-18): origin + edited_by_consultant_at 이중 가드
--
-- 배경: Phase 2 까지는 Bootstrap 이 main_exploration 을 생성/덮어쓰면서도 컨설턴트 수정본을
--   보호하는 가드가 없었다. source='consultant' 는 "생성 주체" 정보지만, "AI 초안을 컨설턴트가
--   다듬은 경우" 를 표현하지 못해 재부트스트랩 시 덮어쓰기 위험.
--
-- 정책:
--   - origin: AI 세부 경로 세분화 (Phase 4 v2 분리 준비)
--   - edited_by_consultant_at: AI 초안이 컨설턴트에 의해 수정된 시점. NOT NULL 이면 override.
--   - ensureMainExploration 가드:
--       origin='auto_bootstrap' AND edited_by_consultant_at IS NULL → 덮어쓰기 허용
--       그 외 모든 조합 → skip (컨설턴트 소유 또는 수정 이력 존재)

-- 1. origin 컬럼: AI 세부 경로
--    auto_bootstrap   : Phase 0~2 자동 셋업으로 생성
--    auto_bootstrap_v2: Phase 4 재부트스트랩 (Synthesis 학습 후)
--    consultant_direct: 컨설턴트가 처음부터 UI 로 작성
--    migrated         : Phase 3 도입 이전 존재하던 row (backfill 전용)
ALTER TABLE public.student_main_explorations
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'consultant_direct'
    CHECK (origin IN ('auto_bootstrap', 'auto_bootstrap_v2', 'consultant_direct', 'migrated'));

COMMENT ON COLUMN public.student_main_explorations.origin IS
  'AI 세부 경로. auto_bootstrap=Phase 0~2, auto_bootstrap_v2=Phase 4 재시드, consultant_direct=UI 수동, migrated=Phase 3 이전 row.';

-- 2. edited_by_consultant_at: AI 초안을 컨설턴트가 수정한 시점
--    auto_bootstrap* origin row 가 수정될 때만 유의미. consultant_direct 는 null 유지.
ALTER TABLE public.student_main_explorations
  ADD COLUMN IF NOT EXISTS edited_by_consultant_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_main_explorations.edited_by_consultant_at IS
  'auto_bootstrap* origin 의 row 가 컨설턴트에 의해 수정된 시점. NOT NULL 이면 재부트스트랩 덮어쓰기 차단.';

-- 3. Backfill: 기존 row 는 전부 migrated 로 표기 (안전 가정 — 이미 생성된 row 는 보호)
--    source 컬럼과 독립적으로 origin 을 set. source='ai' 라도 Phase 3 이전에 생성된 건
--    재부트스트랩 가드 대상에서 제외 (컨설턴트가 이미 검토했다고 가정).
UPDATE public.student_main_explorations
SET origin = 'migrated'
WHERE origin = 'consultant_direct' -- default 로 찍힌 기존 row
  AND created_at < NOW();

-- 4. 가드 쿼리 인덱스 — ensureMainExploration 진입 시 WHERE student_id + is_active + origin=auto_bootstrap
CREATE INDEX IF NOT EXISTS idx_main_explorations_bootstrap_guard
  ON public.student_main_explorations (student_id, is_active, origin)
  WHERE origin IN ('auto_bootstrap', 'auto_bootstrap_v2') AND edited_by_consultant_at IS NULL;
