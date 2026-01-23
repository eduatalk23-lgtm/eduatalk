-- admin_users 테이블에 name 컬럼 추가
-- 테넌트 관리자/컨설턴트 프로필 정보 저장용

ALTER TABLE admin_users
ADD COLUMN name text;

-- 기존 데이터에 대해 기본값 설정 (auth.users의 email에서 @ 앞부분 사용)
UPDATE admin_users
SET name = COALESCE(
  (SELECT raw_user_meta_data->>'display_name' FROM auth.users WHERE auth.users.id = admin_users.id),
  (SELECT split_part(email, '@', 1) FROM auth.users WHERE auth.users.id = admin_users.id),
  '사용자'
)
WHERE name IS NULL;

-- 향후 생성되는 레코드를 위해 NOT NULL 제약조건 추가
ALTER TABLE admin_users
ALTER COLUMN name SET NOT NULL;

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_admin_users_name ON admin_users(name);

COMMENT ON COLUMN admin_users.name IS '관리자/컨설턴트 표시 이름';
