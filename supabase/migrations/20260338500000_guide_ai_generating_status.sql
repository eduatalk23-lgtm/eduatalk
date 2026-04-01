-- exploration_guides.status에 ai_generating, ai_improving, ai_failed 추가
-- fire-and-forget 비동기 가이드 생성/개선 패턴 지원

ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_status_check;

ALTER TABLE public.exploration_guides
  ADD CONSTRAINT exploration_guides_status_check
    CHECK (status IN ('draft','ai_generating','ai_improving','ai_failed','ai_reviewing','review_failed','pending_approval','approved','archived'));
