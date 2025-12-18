-- ============================================
-- Migration: student_connection_codes 테이블 INSERT 정책 개선
-- Date: 2025-12-19
-- Refs: .cursor/plans/-0e0a835e.plan.md [TODO #20]
-- Purpose: 관리자가 학생을 등록할 때 연결 코드를 생성할 수 있도록 정책 개선
-- ============================================

-- ============================================
-- Policy: student_connection_codes_insert_admin (개선)
-- Purpose: 관리자/컨설턴트가 자신의 테넌트 내 학생의 연결 코드를 생성할 수 있도록 허용
-- Security: 관리자/컨설턴트만 생성 가능, 자신의 테넌트 내에서만 생성 가능
-- Related: app/(admin)/actions/studentManagementActions.ts::createStudent
-- ============================================
-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "student_connection_codes_insert_admin" ON student_connection_codes;

CREATE POLICY "student_connection_codes_insert_admin"
ON student_connection_codes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.tenant_id = (
      SELECT tenant_id FROM students WHERE students.id = student_connection_codes.student_id
    )
    AND admin_users.role IN ('admin', 'consultant')
  )
  -- 추가 보안: 생성자는 현재 인증된 사용자여야 함
  AND created_by = auth.uid()
);

COMMENT ON POLICY "student_connection_codes_insert_admin" ON student_connection_codes IS 
'관리자/컨설턴트가 자신의 테넌트 내 학생의 연결 코드를 생성할 수 있도록 허용하는 정책. 신규 학생 등록 시 연결 코드 생성에 사용됩니다.';

