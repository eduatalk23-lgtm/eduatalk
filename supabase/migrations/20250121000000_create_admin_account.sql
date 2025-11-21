-- ============================================
-- 마이그레이션: 관리자 계정 생성 스크립트
-- 사용법: 이 스크립트를 실행하기 전에 auth.users에 사용자를 먼저 생성해야 합니다.
-- ============================================

-- 관리자 계정 생성 함수
-- 사용법: SELECT create_admin_user('user_email@example.com', 'admin');
-- 또는 직접 INSERT: INSERT INTO admin_users (id, role) VALUES ('user-uuid', 'admin');

CREATE OR REPLACE FUNCTION create_admin_user(
  user_email text,
  user_role text DEFAULT 'admin'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- auth.users에서 사용자 ID 조회
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;

  IF user_id IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다: %', user_email;
  END IF;

  -- admin_users에 레코드가 이미 있는지 확인
  IF EXISTS (SELECT 1 FROM admin_users WHERE id = user_id) THEN
    RAISE EXCEPTION '이미 관리자로 등록된 사용자입니다: %', user_email;
  END IF;

  -- admin_users에 추가
  INSERT INTO admin_users (id, role)
  VALUES (user_id, user_role)
  ON CONFLICT (id) DO UPDATE SET role = user_role;

  RETURN user_id;
END;
$$;

-- 함수에 대한 코멘트 추가
COMMENT ON FUNCTION create_admin_user IS 'auth.users에 존재하는 사용자를 admin_users에 추가하는 함수. 사용 전에 auth.users에 사용자가 먼저 생성되어 있어야 합니다.';

-- ============================================
-- 관리자 계정 수동 생성 예시 (주석 처리)
-- ============================================
-- 
-- 1. 먼저 Supabase Dashboard에서 사용자를 생성하거나
-- 2. 다음 SQL을 실행하여 사용자 ID를 확인한 후:
--    SELECT id, email FROM auth.users WHERE email = 'admin@example.com';
-- 3. 확인된 ID로 admin_users에 추가:
--    INSERT INTO admin_users (id, role) 
--    VALUES ('user-uuid-here', 'admin')
--    ON CONFLICT (id) DO UPDATE SET role = 'admin';
--
-- 또는 함수 사용:
--    SELECT create_admin_user('admin@example.com', 'admin');

