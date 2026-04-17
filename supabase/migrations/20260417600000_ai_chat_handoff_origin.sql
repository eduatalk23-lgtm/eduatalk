-- ============================================================
-- AI Chat Handoff Origin (Phase T-4)
-- ============================================================
-- 목적: 기존 GUI 환경에서 /ai-chat 으로 진입할 때 승계된 맥락을
--       대화 레코드에 영속화. 재진입 시 배너/사이드바 뱃지/감사
--       로그에 활용. 1회 진입 시점이 authoritative.
--
-- 스키마: origin JSONB = {
--   source: string,              -- HANDOFF_SOURCES 키 (예: "scores")
--   originPath: string,          -- 출발 페이지 경로 (예: "/scores")
--   params: {                    -- URL 쿼리 중 승계된 값만
--     studentId?: string,
--     grade?: number,
--     semester?: number,
--     subject?: string,
--     ...
--   },
--   enteredAt: string (iso)
-- }
-- ============================================================

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS origin jsonb;

-- 재진입·감사 조회 최적화
CREATE INDEX IF NOT EXISTS idx_ai_conversations_origin_source
  ON public.ai_conversations ((origin->>'source'))
  WHERE origin IS NOT NULL;

COMMENT ON COLUMN public.ai_conversations.origin IS
  'GUI→내러티브 진입 시 소스 정보. {source, originPath, params, enteredAt}. 재진입 시 읽기 전용. NULL 이면 직접 /ai-chat 진입.';
