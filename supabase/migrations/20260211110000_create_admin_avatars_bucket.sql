-- 프로필 이미지 저장용 Storage bucket 생성
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-avatars', 'admin-avatars', true);

-- 인증된 사용자만 자신의 폴더에 업로드 가능
CREATE POLICY "admin avatar upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'admin-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 자신의 이미지만 수정/삭제 가능
CREATE POLICY "admin avatar update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'admin-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admin avatar delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'admin-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- public bucket이므로 누구나 읽기 가능
CREATE POLICY "admin avatar read" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'admin-avatars');
