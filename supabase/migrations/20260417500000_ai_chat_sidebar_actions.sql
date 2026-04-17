-- ============================================================
-- AI Chat Sidebar Actions (Phase A-3)
-- ============================================================
-- 목적: 대화 pin/archive 컬럼 추가. rename/delete 는 기존 컬럼·RLS
--       로 충분.
--
-- - pinned_at: NULL = 기본, timestamptz = 고정됨. 정렬 키로 사용.
-- - archived_at: NULL = 활성, timestamptz = 아카이브됨. 기본 조회에서 제외.
-- ============================================================

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 목록 조회 최적화: pinned 먼저, 그다음 last_activity.
-- archived_at IS NULL (활성 대화만) 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_pinned_activity
  ON public.ai_conversations (owner_user_id, pinned_at DESC NULLS LAST, last_activity_at DESC)
  WHERE archived_at IS NULL;

-- 아카이브 목록 (드물게 조회)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_archived
  ON public.ai_conversations (owner_user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.ai_conversations.pinned_at IS
  '대화 고정 시각. NULL 기본, NOT NULL 이면 사이드바 상단 고정.';

COMMENT ON COLUMN public.ai_conversations.archived_at IS
  '아카이브 시각. NULL 기본. 활성 목록에서 제외되고 아카이브 탭에서만 노출.';
