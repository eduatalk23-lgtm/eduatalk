-- chat-attachments 버킷을 Private으로 전환
-- 기존: public (누구나 URL로 접근 가능)
-- 변경: private (signed URL 또는 인증된 사용자만 접근)
--
-- 보안 개선: 채팅 파일 URL이 외부에 유출되어도 인증 없이 접근 불가

-- 1. 버킷을 private으로 변경
UPDATE storage.buckets
  SET public = false
  WHERE id = 'chat-attachments';

-- 2. 기존 public 읽기 정책 삭제
DROP POLICY IF EXISTS "chat attachment read" ON storage.objects;

-- 3. 인증된 사용자만 읽기 가능 (signed URL 사용)
--    signed URL은 서버에서 생성하며 채팅방 멤버십 검증 후 발급
CREATE POLICY "chat attachment read" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments');

-- 4. 썸네일 storage path 컬럼 추가
--    signed URL 생성을 위해 URL이 아닌 storage path 저장 필요
ALTER TABLE public.chat_attachments
  ADD COLUMN IF NOT EXISTS thumbnail_storage_path text;
