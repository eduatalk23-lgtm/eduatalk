-- 채팅 파일 전송 및 링크 프리뷰 기능을 위한 마이그레이션
-- chat_attachments: 파일/이미지 첨부 메타데이터
-- chat_link_previews: OG 태그 기반 링크 프리뷰 캐시
-- chat-attachments: Supabase Storage 버킷

-- ============================================================
-- 1. chat_attachments 테이블
-- ============================================================
CREATE TABLE public.chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,

  -- 파일 메타데이터
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,

  -- 이미지 전용 (이미지가 아닌 경우 NULL)
  width INTEGER,
  height INTEGER,
  thumbnail_url TEXT,

  -- 분류
  attachment_type TEXT NOT NULL DEFAULT 'file'
    CHECK (attachment_type IN ('image', 'video', 'audio', 'file')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 브로드캐스트 트리거에서 room_id JOIN 회피용 비정규화
  sender_id UUID NOT NULL,

  CONSTRAINT file_size_max CHECK (file_size > 0 AND file_size <= 10485760),
  CONSTRAINT storage_path_unique UNIQUE (storage_path)
);

CREATE INDEX idx_chat_attachments_message ON public.chat_attachments(message_id);
CREATE INDEX idx_chat_attachments_room ON public.chat_attachments(room_id);

-- ============================================================
-- 2. chat_link_previews 테이블
-- ============================================================
CREATE TABLE public.chat_link_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_message_url UNIQUE (message_id, url)
);

CREATE INDEX idx_chat_link_previews_message ON public.chat_link_previews(message_id);

-- ============================================================
-- 3. chat-attachments Storage 버킷
--    public: 누구나 읽기 가능 (이미지 표시를 위해)
--    file_size_limit: 10MB
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('chat-attachments', 'chat-attachments', true, 10485760);

-- 인증된 사용자만 자신의 폴더에 업로드 가능
-- 경로 규칙: {room_id}/{sender_id}/{timestamp}_{filename}
CREATE POLICY "chat attachment upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 자신의 파일만 삭제 가능
CREATE POLICY "chat attachment delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- public bucket이므로 누구나 읽기 가능
CREATE POLICY "chat attachment read" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');

-- ============================================================
-- 4. 첨부파일 브로드캐스트 트리거
--    기존 chat_broadcast_triggers.sql 패턴과 동일
--    이벤트: ATTACHMENT_INSERT
--    토픽: chat-room-{room_id}
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_chat_attachment_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'chat-room-' || NEW.room_id::text,
    'ATTACHMENT_INSERT',
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_chat_attachments
  AFTER INSERT ON public.chat_attachments
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_attachment_changes();

-- ============================================================
-- 5. 링크 프리뷰 브로드캐스트 트리거
--    메시지에 링크 프리뷰가 추가되면 해당 방에 알림
--    이벤트: LINK_PREVIEW_INSERT
--    토픽: chat-room-{room_id} (message_id → room_id JOIN 필요)
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_chat_link_preview_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_id uuid;
BEGIN
  SELECT room_id INTO v_room_id
  FROM public.chat_messages
  WHERE id = NEW.message_id;

  IF v_room_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM realtime.broadcast_changes(
    'chat-room-' || v_room_id::text,
    'LINK_PREVIEW_INSERT',
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_chat_link_previews
  AFTER INSERT ON public.chat_link_previews
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_link_preview_changes();
