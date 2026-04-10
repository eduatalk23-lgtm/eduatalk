-- exploration_guides: ask-input 상태 머신 지원
-- awaiting_input 상태 + agent_question JSONB 컬럼

-- 1. status CHECK에 awaiting_input 추가
ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_status_check;

ALTER TABLE public.exploration_guides
  ADD CONSTRAINT exploration_guides_status_check
    CHECK (status IN ('draft','ai_generating','ai_improving','ai_failed','ai_reviewing','review_failed','awaiting_input','pending_approval','approved','archived'));

-- 2. agent_question JSONB: 에이전트가 사용자에게 묻는 질문 + 선택지 + 응답
--    구조: { question: string, choices?: string[], context?: string, userAnswer?: string, answeredAt?: string }
ALTER TABLE public.exploration_guides
  ADD COLUMN IF NOT EXISTS agent_question jsonb;

COMMENT ON COLUMN public.exploration_guides.agent_question IS
  'ask-input: 에이전트가 사용자에게 묻는 질문/선택지/응답. status=awaiting_input일 때 유효.';
