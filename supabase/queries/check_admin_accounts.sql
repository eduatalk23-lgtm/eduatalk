-- ============================================
-- 관리자 계정 확인 쿼리 모음
-- ============================================

-- 1. 모든 관리자 계정 조회 (이메일 포함)
SELECT 
  au.id,
  au.role,
  au.created_at,
  u.email
FROM admin_users au
LEFT JOIN auth.users u ON au.id = u.id
ORDER BY au.created_at DESC;

-- 2. 관리자 계정 개수 확인
SELECT COUNT(*) as admin_count FROM admin_users;

-- 3. 역할별 관리자 개수 확인
SELECT 
  role, 
  COUNT(*) as count 
FROM admin_users 
GROUP BY role;

-- 4. 특정 이메일이 관리자인지 확인
-- (이메일을 변경해서 사용)
SELECT 
  au.id,
  au.role,
  au.created_at,
  u.email,
  CASE 
    WHEN au.id IS NOT NULL THEN '관리자입니다'
    ELSE '관리자가 아닙니다'
  END as status
FROM auth.users u
LEFT JOIN admin_users au ON u.id = au.id
WHERE u.email = 'your-email@example.com';

-- 5. 관리자 계정이 있는지 간단히 확인
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '관리자 계정이 있습니다 (' || COUNT(*) || '개)'
    ELSE '관리자 계정이 없습니다'
  END as status,
  COUNT(*) as admin_count
FROM admin_users;

