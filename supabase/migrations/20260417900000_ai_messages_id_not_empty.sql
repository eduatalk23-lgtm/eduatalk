-- ============================================================
-- ai_messages.id 비어있지 않음 CHECK 제약
-- ============================================================
-- 버그: ai-sdk-ollama 일부 경로에서 assistant message id 가 빈 문자열로
--       저장되는 경우 발견. onConflict id 로 upsert 시 모든 id="" 메시지가
--       동일 row 를 덮어쓰며 대화 간 순서·내용 오염 유발.
-- 대응: CHECK 제약으로 이중 방어 (서버 fallback + DB 차단).
--
-- 운영 노트: 이 마이그레이션 적용 전 기존 id="" row 수동 삭제 필요.
--   DELETE FROM public.ai_messages WHERE id = '';
-- (Supabase 환경에서 이미 수행됨)
-- ============================================================

ALTER TABLE public.ai_messages
  ADD CONSTRAINT ai_messages_id_not_empty CHECK (char_length(id) > 0);
