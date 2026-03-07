-- Migration: Realtime Authorization for private chat channels
--
-- chat-room-{roomId} 채널에 private: true를 사용하므로,
-- realtime.messages 테이블에 RLS 정책을 추가하여
-- chat_room_members 멤버십을 검증합니다.
--
-- 참고: Supabase Realtime은 realtime.messages에 데이터를 저장하지 않으며,
-- 채널 연결 시 RLS 정책만 평가합니다.

ALTER TABLE IF EXISTS "realtime"."messages" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_room_member_can_receive" ON "realtime"."messages";
DROP POLICY IF EXISTS "chat_room_member_can_send" ON "realtime"."messages";

-- SELECT: 채팅방 멤버만 broadcast 수신
CREATE POLICY "chat_room_member_can_receive"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  -- chat-room-* 채널이 아니면 허용 (다른 채널에 영향 없음)
  (select realtime.topic()) NOT LIKE 'chat-room-%'
  OR
  -- chat-room-{roomId} 채널: 활성 멤버만 허용
  EXISTS (
    SELECT 1
    FROM public.chat_room_members crm
    WHERE crm.room_id = substring((select realtime.topic()) FROM 11)::uuid
    AND crm.user_id = (select auth.uid())
    AND crm.left_at IS NULL
    AND crm.deleted_at IS NULL
  )
);

-- INSERT: 채팅방 멤버만 broadcast 전송
CREATE POLICY "chat_room_member_can_send"
ON "realtime"."messages"
FOR INSERT
TO authenticated
WITH CHECK (
  -- chat-room-* 채널이 아니면 허용
  (select realtime.topic()) NOT LIKE 'chat-room-%'
  OR
  -- chat-room-{roomId} 채널: 활성 멤버만 허용
  EXISTS (
    SELECT 1
    FROM public.chat_room_members crm
    WHERE crm.room_id = substring((select realtime.topic()) FROM 11)::uuid
    AND crm.user_id = (select auth.uid())
    AND crm.left_at IS NULL
    AND crm.deleted_at IS NULL
  )
);
