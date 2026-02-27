-- 채팅방 나가기/재입장 메시지 가시성 제어
-- history_visible: 새 멤버에게 이전 대화 공개 여부
-- visible_from: 멤버별 메시지 가시 시작 시점

-- 1. chat_rooms에 history_visible 컬럼 추가
ALTER TABLE chat_rooms
  ADD COLUMN history_visible boolean NOT NULL DEFAULT false;

-- 2. chat_room_members에 visible_from 컬럼 추가
ALTER TABLE chat_room_members
  ADD COLUMN visible_from timestamptz;

-- 3. 기존 멤버 백필 (created_at으로 설정 → 기존 대화 유지)
UPDATE chat_room_members SET visible_from = created_at WHERE visible_from IS NULL;

-- 4. NOT NULL + 기본값 설정
ALTER TABLE chat_room_members
  ALTER COLUMN visible_from SET NOT NULL,
  ALTER COLUMN visible_from SET DEFAULT now();
