-- master_custom_contents에 content_url 필드 추가
ALTER TABLE master_custom_contents 
ADD COLUMN IF NOT EXISTS content_url text;

COMMENT ON COLUMN master_custom_contents.content_url IS '콘텐츠 URL (PDF, 동영상, 문제집 등의 링크)';

-- master_lectures에 cover_image_url 필드 추가 (일관성)
ALTER TABLE master_lectures 
ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN master_lectures.cover_image_url IS '표지 이미지 URL';

