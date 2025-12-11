-- ============================================
-- Migration: students 및 parent_users 테이블 INSERT RLS 정책 추가
-- Date: 2025-12-13
-- Refs: docs/rls-policy-improvement-todo.md [Phase 2]
-- Purpose: 회원가입 시 students/parent_users 테이블에 레코드 생성 허용
-- ============================================

-- ============================================
-- Policy: students_insert_own
-- Purpose: 회원가입 시 학생이 자신의 레코드를 생성할 수 있도록 허용
-- Security: 최소 권한 원칙 - 자신의 ID(auth.uid() = id)로만 생성 가능
-- Related: docs/rls-policy-analysis.md, app/actions/auth.ts::createStudentRecord
-- ============================================
CREATE POLICY "students_insert_own"
ON students
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- Policy: parent_users_insert_own
-- Purpose: 회원가입 시 학부모가 자신의 레코드를 생성할 수 있도록 허용
-- Security: 최소 권한 원칙 - 자신의 ID(auth.uid() = id)로만 생성 가능
-- Related: docs/rls-policy-analysis.md, app/actions/auth.ts::createParentRecord
-- ============================================
CREATE POLICY "parent_users_insert_own"
ON parent_users
FOR INSERT
WITH CHECK (auth.uid() = id);

