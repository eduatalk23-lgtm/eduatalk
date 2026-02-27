-- 사용자별 첨부파일 숨기기 테이블
-- cleanup이 attachment를 삭제하면 ON DELETE CASCADE로 hidden 레코드도 자동 삭제

CREATE TABLE public.chat_attachment_hidden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attachment_id UUID NOT NULL REFERENCES public.chat_attachments(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_attachment_hidden UNIQUE (user_id, attachment_id)
);

CREATE INDEX idx_chat_attachment_hidden_user ON public.chat_attachment_hidden(user_id);
CREATE INDEX idx_chat_attachment_hidden_attachment ON public.chat_attachment_hidden(attachment_id);

ALTER TABLE public.chat_attachment_hidden ENABLE ROW LEVEL SECURITY;

-- 자신의 숨기기 레코드만 조회 가능
CREATE POLICY "Users can view own hidden attachments"
  ON public.chat_attachment_hidden FOR SELECT
  USING (user_id = auth.uid());

-- 자신의 숨기기 레코드만 삽입 가능
CREATE POLICY "Users can hide attachments for themselves"
  ON public.chat_attachment_hidden FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 자신의 숨기기 레코드만 삭제 가능
CREATE POLICY "Users can unhide own attachments"
  ON public.chat_attachment_hidden FOR DELETE
  USING (user_id = auth.uid());
