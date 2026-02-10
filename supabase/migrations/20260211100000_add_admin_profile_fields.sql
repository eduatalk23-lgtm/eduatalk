-- admin_users에 프로필 필드 추가
ALTER TABLE admin_users
  ADD COLUMN profile_image_url text,
  ADD COLUMN job_title text,
  ADD COLUMN department text,
  ADD COLUMN phone text;
