-- 통합 프로필 이미지 버킷 생성 (admin, student, parent 공용)
-- 기존 admin-avatars 버킷은 하위호환을 위해 유지
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 인증된 사용자만 자신의 폴더에 업로드 가능
CREATE POLICY "user avatar upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 자신의 이미지만 수정 가능
CREATE POLICY "user avatar update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 자신의 이미지만 삭제 가능
CREATE POLICY "user avatar delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- public bucket이므로 누구나 읽기 가능
CREATE POLICY "user avatar read" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'user-avatars');
