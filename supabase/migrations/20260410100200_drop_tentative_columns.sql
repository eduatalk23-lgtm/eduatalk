-- ============================================
-- Phase 2 Wave 2.3: tentative_* 임시 컬럼 제거
--
-- Phase 1에서 추가한 5개 임시 컬럼을 제거.
-- Wave 2.2 (apply-topic-exploration-reclassification.ts) 가 모든 분류를
-- 실제 guide_type / activity_mappings 로 승격 완료한 뒤 실행.
--
-- 사전 조건 (스크립트가 보장):
--   - tentative_review_status='confirmed' 행 0건 (전부 'pending'으로 클리어됨)
--   - tentative_guide_type / tentative_activity_type / tentative_confidence /
--     tentative_reasoning 모두 NULL
-- ============================================

-- 부분 인덱스 제거 (컬럼 의존성)
DROP INDEX IF EXISTS idx_exploration_guides_tentative_review;

-- CHECK 제약 제거
ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_tentative_activity_type_check;

ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_tentative_review_status_check;

-- 컬럼 5개 제거
ALTER TABLE public.exploration_guides
  DROP COLUMN IF EXISTS tentative_guide_type,
  DROP COLUMN IF EXISTS tentative_activity_type,
  DROP COLUMN IF EXISTS tentative_confidence,
  DROP COLUMN IF EXISTS tentative_review_status,
  DROP COLUMN IF EXISTS tentative_reasoning;
