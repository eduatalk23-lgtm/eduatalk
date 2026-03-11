-- Migration: chat_messages 중복 인덱스 정리
--
-- 사실상 동일한 인덱스 2쌍을 제거하여 INSERT 성능 개선 (11개 → 9개)
-- 현재 343행으로 체감 차이는 미미하나, 데이터 증가 시 불필요한 오버헤드 방지

-- 쌍1: 완전 동일 인덱스
-- idx_chat_messages_room_active_created  (room_id, is_deleted, created_at DESC)  ← 유지
-- idx_chat_messages_room_deleted_created (room_id, is_deleted, created_at DESC)  ← 삭제
DROP INDEX IF EXISTS idx_chat_messages_room_deleted_created;

-- 쌍2: 조건만 표현 다름 (NOT is_deleted = is_deleted = false), 실질 동일
-- idx_chat_messages_room_created      WHERE (NOT is_deleted)       ← 유지
-- idx_chat_messages_room_created_desc WHERE (is_deleted = false)   ← 삭제
DROP INDEX IF EXISTS idx_chat_messages_room_created_desc;
