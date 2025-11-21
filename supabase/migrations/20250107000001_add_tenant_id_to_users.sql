-- Migration: Add tenant_id to user tables
-- Description: 사용자 테이블(students, parent_users, admin_users)에 tenant_id 컬럼 추가
-- Date: 2025-01-07

-- ============================================
-- 1. students 테이블에 tenant_id 추가
-- ============================================

-- tenant_id 컬럼 추가 (nullable, 나중에 기본값 설정)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant_student ON students(tenant_id, id);

-- ============================================
-- 2. parent_users 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE parent_users 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_parent_users_tenant_id ON parent_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parent_users_tenant_parent ON parent_users(tenant_id, id);

-- ============================================
-- 3. admin_users 테이블에 tenant_id 추가
-- ============================================

-- Super Admin은 tenant_id가 NULL일 수 있음
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_id ON admin_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_role ON admin_users(tenant_id, role);

-- ============================================
-- 4. 코멘트 추가 (문서화)
-- ============================================

COMMENT ON COLUMN students.tenant_id IS '학생이 소속된 기관(tenant) ID';
COMMENT ON COLUMN parent_users.tenant_id IS '학부모가 소속된 기관(tenant) ID';
COMMENT ON COLUMN admin_users.tenant_id IS '관리자가 소속된 기관(tenant) ID. Super Admin은 NULL';

