-- 중복 RLS 정책 정리: chat_room_members_only (기존) 제거, 새 정책만 유지
DROP POLICY IF EXISTS "chat_room_members_only" ON "realtime"."messages";
