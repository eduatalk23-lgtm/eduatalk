-- ============================================
-- Migration: students 테이블 관리자 INSERT RLS 정책 추가
-- Date: 2025-12-19
-- Refs: .cursor/plans/-0e0a835e.plan.md [TODO #19]
-- Purpose: 관리자가 신규 학생을 등록할 때 사용하는 UUID로 학생 레코드를 생성할 수 있도록 허용
-- ============================================

-- ============================================
-- Policy: students_insert_admin
-- Purpose: 관리자/컨설턴트가 자신의 테넌트 내 학생 레코드를 생성할 수 있도록 허용
-- Security: 관리자/컨설턴트만 생성 가능, 자신의 테넌트 내에서만 생성 가능
-- Related: app/(admin)/actions/studentManagementActions.ts::createStudent
-- ============================================
-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "students_insert_admin" ON students;

CREATE POLICY "students_insert_admin"
ON students
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.tenant_id = students.tenant_id
    AND admin_users.role IN ('admin', 'consultant')
  )
);

COMMENT ON POLICY "students_insert_admin" ON students IS 
'관리자/컨설턴트가 자신의 테넌트 내 학생 레코드를 생성할 수 있도록 허용하는 정책. 신규 학생 등록 시 사용되는 UUID로 학생 레코드를 생성할 때 사용됩니다.';

