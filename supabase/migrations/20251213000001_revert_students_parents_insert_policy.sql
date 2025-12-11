-- ============================================
-- Migration: students 및 parent_users 테이블 INSERT RLS 정책 삭제 (롤백)
-- Date: 2025-12-13
-- Refs: docs/rls-policy-improvement-todo.md [Phase 2.2]
-- Purpose: Phase 2.1에서 추가한 INSERT 정책 롤백
-- ============================================

-- students 테이블 INSERT 정책 삭제
DROP POLICY IF EXISTS "students_insert_own" ON students;

-- parent_users 테이블 INSERT 정책 삭제
DROP POLICY IF EXISTS "parent_users_insert_own" ON parent_users;

