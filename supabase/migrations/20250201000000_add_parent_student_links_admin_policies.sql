-- ============================================
-- Migration: parent_student_links 테이블 관리자 승인/거부 RLS 정책 추가
-- Date: 2025-02-01
-- Refs: docs/student-parent-link-system-implementation-todo.md [Phase 3]
-- Purpose: 관리자가 승인 대기 중인 연결 요청을 조회하고 승인/거부할 수 있도록 허용
-- ============================================

-- ============================================
-- Policy: parent_student_links_select_pending_for_admin
-- Purpose: 관리자가 승인 대기 중인 연결 요청을 조회할 수 있도록 허용
-- Security: 관리자/컨설턴트만 조회 가능, 승인 대기 중인 요청만 조회
-- Related: app/(admin)/actions/parentStudentLinkActions.ts::getPendingLinkRequests
-- ============================================
DROP POLICY IF EXISTS "parent_student_links_select_pending_for_admin" ON parent_student_links;

CREATE POLICY "parent_student_links_select_pending_for_admin"
ON parent_student_links
FOR SELECT
TO authenticated
USING (
  -- 승인 대기 중인 요청만 조회 가능
  (is_approved IS NULL OR is_approved = false)
  AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- ============================================
-- Policy: parent_student_links_update_for_admin
-- Purpose: 관리자가 연결 요청을 승인할 수 있도록 허용
-- Security: 관리자/컨설턴트만 업데이트 가능
-- Related: app/(admin)/actions/parentStudentLinkActions.ts::approveLinkRequest
-- ============================================
DROP POLICY IF EXISTS "parent_student_links_update_for_admin" ON parent_student_links;

CREATE POLICY "parent_student_links_update_for_admin"
ON parent_student_links
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- ============================================
-- Policy: parent_student_links_delete_for_admin
-- Purpose: 관리자가 연결 요청을 거부(삭제)할 수 있도록 허용
-- Security: 관리자/컨설턴트만 삭제 가능
-- Related: app/(admin)/actions/parentStudentLinkActions.ts::rejectLinkRequest
-- ============================================
DROP POLICY IF EXISTS "parent_student_links_delete_for_admin" ON parent_student_links;

CREATE POLICY "parent_student_links_delete_for_admin"
ON parent_student_links
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

