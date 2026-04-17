-- ============================================================
-- AI Messages 순서 보장 (sequence_num BIGSERIAL)
-- ============================================================
-- 증상: saveChatTurn 에서 여러 메시지를 한번에 upsert 시 동일한 created_at
--       타임스탬프로 순서가 뒤섞이는 문제.
-- 해결: BIGSERIAL 컬럼 추가. INSERT 시 자동 증가, UPDATE(onConflict id) 시
--       기존 값 유지 → idempotent upsert 에 안전. loadConversationMessages 는
--       sequence_num ASC 로 정렬.
-- ============================================================

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS sequence_num BIGSERIAL;

-- 기존 데이터 백필 (sequence_num NULL 인 행이 있는 경우에만)
DO $$
DECLARE
  msg record;
  seq bigint := 1;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ai_messages WHERE sequence_num IS NULL LIMIT 1) THEN
    FOR msg IN
      SELECT id FROM public.ai_messages
      WHERE sequence_num IS NULL
      ORDER BY created_at ASC, id ASC
    LOOP
      UPDATE public.ai_messages SET sequence_num = seq WHERE id = msg.id;
      seq := seq + 1;
    END LOOP;
  END IF;
END $$;

-- 정렬 최적화 인덱스 (기존 created_at 인덱스 대체)
DROP INDEX IF EXISTS public.idx_ai_messages_conversation_created;
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_sequence
  ON public.ai_messages (conversation_id, sequence_num ASC);

COMMENT ON COLUMN public.ai_messages.sequence_num IS
  '메시지 저장 순서. BIGSERIAL 로 INSERT 시만 자동 증가, UPDATE 시 유지. loadConversationMessages 는 이 값으로 정렬.';
