-- parent_users 테이블에 프로필 이미지 URL 컬럼 추가
ALTER TABLE parent_users ADD COLUMN IF NOT EXISTS profile_image_url varchar;
