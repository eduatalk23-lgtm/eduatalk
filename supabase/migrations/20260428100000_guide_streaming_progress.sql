-- B1 (2026-04-28): D6 가이드 본문 생성 Stream-to-DB
-- 5분 LLM 호출 중 부분 출력을 incremental하게 저장하여 타임아웃 시 회수 가능하게 함.
--
-- 변경:
-- 1) exploration_guides.status enum 에 'ai_partial' 추가
--    - ai_failed: 5분 한도 초과 + 부분 본문 없음 (기존)
--    - ai_partial: 5분 한도 초과 + streaming_progress 보존 (신규, 컨설턴트 회수 가능)
-- 2) streaming_progress jsonb / streaming_updated_at / streaming_chunk_count 컬럼 추가

ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_status_check;

ALTER TABLE public.exploration_guides
  ADD CONSTRAINT exploration_guides_status_check
    CHECK (status IN (
      'draft',
      'ai_generating',
      'ai_improving',
      'ai_failed',
      'ai_partial',
      'ai_reviewing',
      'review_failed',
      'awaiting_input',
      'pending_approval',
      'approved',
      'archived',
      'queued_generation'
    ));

ALTER TABLE public.exploration_guides
  ADD COLUMN IF NOT EXISTS streaming_progress jsonb,
  ADD COLUMN IF NOT EXISTS streaming_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS streaming_chunk_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.exploration_guides.streaming_progress IS
  'B1 Stream-to-DB: streamObject로 받은 마지막 partial 객체. 타임아웃 시 컨설턴트가 회수/이어쓰기 가능.';
COMMENT ON COLUMN public.exploration_guides.streaming_updated_at IS
  'streaming_progress 마지막 업데이트 시각. throttle 디버깅용.';
COMMENT ON COLUMN public.exploration_guides.streaming_chunk_count IS
  '누적 partial 청크 수 (실제 throttled UPDATE 횟수와 일치).';
