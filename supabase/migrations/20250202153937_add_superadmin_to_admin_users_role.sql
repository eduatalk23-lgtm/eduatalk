-- ============================================
-- admin_users 테이블의 role 컬럼에 superadmin 추가
-- ============================================

-- 기존 CHECK 제약조건 삭제
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- superadmin을 포함한 새로운 CHECK 제약조건 추가
ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('admin', 'consultant', 'superadmin'));

-- 컬럼 코멘트 업데이트
COMMENT ON COLUMN admin_users.role IS '관리자 역할: admin(기관 관리자), consultant(컨설턴트), superadmin(시스템 관리자)';

