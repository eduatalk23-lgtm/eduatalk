-- Phase B-3 이월: #tags 지원
-- ai_conversations 에 text[] tags 컬럼 추가. 기본 빈 배열.
-- RLS 는 기존 owner_user_id 규칙 그대로 적용 (별도 정책 불필요).
--
-- 인덱스: GIN 으로 tag 포함 여부 빠른 필터 (사이드바 다중 태그 필터 대응).

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tags_gin
  ON public.ai_conversations
  USING GIN (tags);

COMMENT ON COLUMN public.ai_conversations.tags IS
  'Phase B-3 이월: 사용자가 입력한 #태그 목록 (소문자 정규화, 중복 제거). 사이드바 필터 및 향후 검색 확장용.';
