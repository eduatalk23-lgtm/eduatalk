-- chat_messages.content trigram GIN 인덱스
-- ILIKE '%query%' 검색의 시퀀셜 스캔을 인덱스 스캔으로 전환
-- pg_trgm 확장은 이미 활성화됨 (20260325100000_create_user_profiles.sql 참조)
-- partial index: 활성 메시지에만 적용하여 인덱스 크기 최소화

CREATE INDEX IF NOT EXISTS idx_chat_messages_content_trgm
  ON public.chat_messages USING gin (content public.gin_trgm_ops)
  WHERE is_deleted = false;
