-- ============================================
-- 채팅방 카테고리, 주제, 상태 관리 확장
--
-- 목적: 동일 참여자 간 다중 채팅방 구분 (생기부 컨설팅 등)
--       채팅방 아카이브/삭제(소프트) 지원
-- ============================================

-- 1) category: 채팅방 분류 (일반 vs 컨설팅 등)
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.chat_rooms
  ADD CONSTRAINT chat_rooms_category_check
  CHECK (category IN ('general', 'consulting'));

-- 2) topic: 채팅방 주제/제목 (direct 포함 모든 방에 설정 가능)
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS topic TEXT;

-- 3) status: 채팅방 상태 관리
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.chat_rooms
  ADD CONSTRAINT chat_rooms_status_check
  CHECK (status IN ('active', 'archived', 'closed'));

-- 4) archived_at: 아카이브 시점
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 5) deleted_at: 소프트 삭제 시점 (멤버별)
--    chat_room_members에 추가 → 각 멤버가 개별적으로 방을 삭제 가능
ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 6) 인덱스: category + status 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_chat_rooms_category
  ON public.chat_rooms (category);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_status
  ON public.chat_rooms (status)
  WHERE status != 'active';

CREATE INDEX IF NOT EXISTS idx_chat_room_members_deleted_at
  ON public.chat_room_members (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 7) findDirectRoomIncludingLeft에서 category별 구분을 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type_category_active
  ON public.chat_rooms (type, category, is_active);
