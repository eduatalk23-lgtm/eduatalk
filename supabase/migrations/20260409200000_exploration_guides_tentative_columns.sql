-- ============================================
-- Phase 1: topic_exploration 재분류용 임시 컬럼 추가
--
-- 151건의 topic_exploration 가이드를 세특/창체(자율/동아리/진로)로
-- 재분류하기 위한 임시 컬럼 4개. Phase 2에서 guide_type으로 승격 후 DROP 예정.
--
-- 컬럼 설명:
--   tentative_guide_type      — 제안되는 신규 guide_type (reflection_program 등)
--                               NULL이면 현재 guide_type 유지 (= setek용 세특 전용)
--   tentative_activity_type   — 창체 배정 시 activity_type (autonomy/club/career)
--                               NULL이면 세특 영역 (= setek 기본)
--   tentative_confidence      — LLM 분류기 신뢰도 (0.00~1.00)
--   tentative_review_status   — pending / auto_approved / needs_review / confirmed / rejected
-- ============================================

ALTER TABLE public.exploration_guides
  ADD COLUMN IF NOT EXISTS tentative_guide_type text,
  ADD COLUMN IF NOT EXISTS tentative_activity_type text,
  ADD COLUMN IF NOT EXISTS tentative_confidence numeric(3, 2),
  ADD COLUMN IF NOT EXISTS tentative_review_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tentative_reasoning text;

-- 값 제약
ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_tentative_activity_type_check;

ALTER TABLE public.exploration_guides
  ADD CONSTRAINT exploration_guides_tentative_activity_type_check
  CHECK (tentative_activity_type IS NULL
      OR tentative_activity_type IN ('autonomy', 'club', 'career'));

ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_tentative_review_status_check;

ALTER TABLE public.exploration_guides
  ADD CONSTRAINT exploration_guides_tentative_review_status_check
  CHECK (tentative_review_status IN ('pending', 'auto_approved', 'needs_review', 'confirmed', 'rejected'));

-- 리뷰 큐 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_exploration_guides_tentative_review
  ON public.exploration_guides (tentative_review_status)
  WHERE tentative_review_status IN ('pending', 'needs_review');

COMMENT ON COLUMN public.exploration_guides.tentative_guide_type
  IS 'Phase 1 재분류 제안값. NULL=현재 유지. Phase 2에서 guide_type으로 승격 후 컬럼 제거 예정.';
COMMENT ON COLUMN public.exploration_guides.tentative_activity_type
  IS 'Phase 1 재분류 제안값. autonomy/club/career 중 하나 또는 NULL(세특). Phase 2에서 별도 매핑 테이블로 이전 예정.';
COMMENT ON COLUMN public.exploration_guides.tentative_confidence
  IS 'LLM 분류기 신뢰도 0.00~1.00.';
COMMENT ON COLUMN public.exploration_guides.tentative_review_status
  IS '재분류 리뷰 상태. pending=미처리, auto_approved=신뢰도 0.9+ 자동 승인, needs_review=수동 검토 필요, confirmed=컨설턴트 확정, rejected=컨설턴트 거부.';
COMMENT ON COLUMN public.exploration_guides.tentative_reasoning
  IS 'LLM 분류기 판단 근거 (검토자 참고용).';
