-- ============================================================
-- CMS C2: guide-images Storage bucket
-- ============================================================

-- 1. 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guide-images',
  'guide-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS 정책: 모든 인증 사용자 읽기
CREATE POLICY "guide_images_public_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'guide-images');

-- 3. RLS 정책: admin/consultant만 업로드
CREATE POLICY "guide_images_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'guide-images'
    AND (SELECT auth.jwt() ->> 'user_role') IN ('admin', 'consultant')
  );

-- 4. RLS 정책: admin/consultant만 삭제
CREATE POLICY "guide_images_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'guide-images'
    AND (SELECT auth.jwt() ->> 'user_role') IN ('admin', 'consultant')
  );
