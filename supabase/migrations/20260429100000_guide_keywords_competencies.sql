-- ============================================
-- exploration_guides 메타 정규화 — keywords + competency_focus
--
-- 2026-04-29: per-guide 메타 강화 (#3 Scope A).
-- shadow slot-aware score 의 focusFit (slot.focusKeywords ∩ guide.keywords) /
-- weaknessFix (slot.weakCompetencies ∩ guide.competencyFocus) 보너스 활성용.
--
-- TEXT[] 컬럼 — JSONB 보다 GIN 인덱스 타입 친화적.
-- 빈 배열 default 로 기존 guide 호환 (NOT NULL 보장).
--
-- 백필 정책:
--   keywords         : title + topic_cluster_name + unit_major + unit_minor 의 명사 토큰 추출 (rule-based 1차)
--   competency_focus : 8 표준 역량 코드 — LLM 분류 배치 (별도 스크립트)
--
-- 변경 시 동기화:
--   - lib/domains/guide/types.ts ExplorationGuide
--   - lib/domains/record-analysis/pipeline/slots/shadow-score-runner.ts (가이드 메타 채움)
-- ============================================

ALTER TABLE exploration_guides
  ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS competency_focus TEXT[] NOT NULL DEFAULT '{}';

-- GIN 인덱스 — 향후 keyword/competency 기반 필터 쿼리 대비.
-- 현 단계 (shadow score) 에서는 id IN (...) 후 row 단위 접근만 사용하므로 인덱스 미사용 — 그러나
-- 후속 검색 경로 (focus-driven 가이드 추천 등) 에서 GIN 활용 가능.
CREATE INDEX IF NOT EXISTS idx_exploration_guides_keywords_gin
  ON exploration_guides USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_exploration_guides_competency_focus_gin
  ON exploration_guides USING GIN (competency_focus);

COMMENT ON COLUMN exploration_guides.keywords IS
  '가이드 키워드 (focusFit 보너스 매칭). title/topic_cluster/unit 에서 추출. 빈 배열 = 미백필.';
COMMENT ON COLUMN exploration_guides.competency_focus IS
  '가이드가 다루는 8 표준 역량 코드 (academic_inquiry, academic_achievement, creative_problem_solving, collaborative_communication, career_passion, career_course_achievement, self_directed_learning, community_contribution). weaknessFix 보너스 매칭. LLM 분류 배치 산출.';
