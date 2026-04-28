-- B2 (2026-04-28): D6 가이드 본문 cross-student 캐시
-- 동일 (keyword + guideType + targetSubject + difficultyLevel + keyTopics + AI_PROMPT_VERSION)
-- 입력 hash 가 이미 approved 가이드로 존재하면 LLM 호출 생략 + 본문 복사.
--
-- 변경:
-- 1) exploration_guides.ai_input_hash text — djb2 8자리 hex (NULL 허용, AI 생성 가이드만 저장)
-- 2) approved 상태 가이드만 cache 소스로 사용하기 위한 부분 인덱스
--    UNIQUE 가 아닌 일반 인덱스: 같은 hash 의 approved 가이드가 복수일 수 있음(클론 등) — 1건만 사용.

ALTER TABLE public.exploration_guides
  ADD COLUMN IF NOT EXISTS ai_input_hash text;

CREATE INDEX IF NOT EXISTS idx_exploration_guides_ai_input_hash_approved
  ON public.exploration_guides (ai_input_hash)
  WHERE status = 'approved' AND ai_input_hash IS NOT NULL;

COMMENT ON COLUMN public.exploration_guides.ai_input_hash IS
  'B2 D6 cross-student cache: ai_generation_meta 핵심 필드 + AI_PROMPT_VERSION djb2 hex. status=approved 가이드만 캐시 소스로 사용.';
