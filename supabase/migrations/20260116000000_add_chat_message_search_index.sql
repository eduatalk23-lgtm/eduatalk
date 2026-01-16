-- 채팅 메시지 검색을 위한 pg_trgm 인덱스 추가
-- trigram 기반 검색으로 ILIKE 쿼리 성능 향상

-- pg_trgm 확장 활성화 (이미 있으면 무시)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 메시지 content 검색을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_trgm
ON chat_messages USING gin(content gin_trgm_ops);

-- 검색 시 room_id + is_deleted 필터를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_search
ON chat_messages(room_id, is_deleted)
WHERE is_deleted = false;

COMMENT ON INDEX idx_chat_messages_content_trgm IS '채팅 메시지 내용 검색을 위한 trigram 인덱스';
COMMENT ON INDEX idx_chat_messages_room_search IS '채팅방별 메시지 검색 필터 최적화';
