-- M7(D6): AI 가이드 자동 생성 — queued_generation 상태 + 설계 메타
-- 1단계(탐구 설계)에서 셸만 생성, 2단계(API Route)에서 전문 생성

-- 1. status CHECK에 queued_generation 추가
ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_status_check;

ALTER TABLE public.exploration_guides
  ADD CONSTRAINT exploration_guides_status_check
    CHECK (status IN (
      'draft','ai_generating','ai_improving','ai_failed',
      'ai_reviewing','review_failed','awaiting_input',
      'pending_approval','approved','archived',
      'queued_generation'
    ));

-- 2. ai_generation_meta: 탐구 설계 AI가 생성한 메타 설계도
--    1단계에서 저장, 2단계에서 읽어서 가이드 전문 생성 시 프롬프트에 주입
--    구조: { title, guideType, difficultyLevel, subjectConnect, storylineConnect,
--            directionGuideRef, keyTopics[], rationale, designedAt }
ALTER TABLE public.exploration_guides
  ADD COLUMN IF NOT EXISTS ai_generation_meta jsonb;

COMMENT ON COLUMN public.exploration_guides.ai_generation_meta IS
  'D6: 탐구 설계 AI 출력 메타. status=queued_generation일 때 유효. 2단계 전문 생성 시 프롬프트 컨텍스트로 사용.';

-- 3. source_type에 ai_pipeline_design 추가 (파이프라인 자동 설계 경유)
ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_source_type_check;

-- source_type은 CHECK 제약이 없을 수 있으므로 조건부 처리
DO $$
BEGIN
  -- 기존 제약이 있으면 재생성
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'exploration_guides_source_type_check'
  ) THEN
    ALTER TABLE public.exploration_guides
      DROP CONSTRAINT exploration_guides_source_type_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
