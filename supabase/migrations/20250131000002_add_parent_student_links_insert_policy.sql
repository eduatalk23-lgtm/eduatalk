-- ============================================
-- Migration: parent_student_links 테이블 INSERT RLS 정책 추가
-- Date: 2025-01-31
-- Refs: docs/student-parent-link-system-implementation-todo.md [Phase 2]
-- Purpose: 학부모가 연결 요청을 생성할 수 있도록 허용
-- Note: is_approved 컬럼이 없는 경우를 대비하여 컬럼 존재 여부 확인
-- ============================================

-- is_approved 컬럼 존재 여부 확인 함수
DO $$
BEGIN
  -- is_approved 컬럼이 없으면 기본값으로 처리 (모든 레코드를 승인된 것으로 간주)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parent_student_links'
      AND column_name = 'is_approved'
  ) THEN
    RAISE NOTICE 'is_approved 컬럼이 없습니다. 컬럼 추가 마이그레이션을 먼저 실행하세요.';
  END IF;
END $$;

-- ============================================
-- Policy: parent_student_links_insert_own
-- Purpose: 학부모가 자신의 연결 요청을 생성할 수 있도록 허용
-- Security: 최소 권한 원칙 - 자신의 ID(auth.uid() = parent_id)로만 생성 가능
-- Related: app/(parent)/actions/parentStudentLinkRequestActions.ts::createLinkRequest
-- ============================================
-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "parent_student_links_insert_own" ON parent_student_links;

CREATE POLICY "parent_student_links_insert_own"
ON parent_student_links
FOR INSERT
WITH CHECK (
  -- 학부모만 자신의 연결 요청 생성 가능
  auth.uid() = parent_id
  AND EXISTS (
    SELECT 1 FROM parent_users
    WHERE parent_users.id = auth.uid()
  )
);

-- ============================================
-- Policy: parent_student_links_select_own
-- Purpose: 학부모가 자신의 연결 요청을 조회할 수 있도록 허용
-- Security: 최소 권한 원칙 - 자신의 ID(auth.uid() = parent_id)로만 조회 가능
-- Related: app/(parent)/actions/parentStudentLinkRequestActions.ts::getLinkRequests
-- ============================================
-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "parent_student_links_select_own" ON parent_student_links;

CREATE POLICY "parent_student_links_select_own"
ON parent_student_links
FOR SELECT
USING (
  -- 학부모는 자신의 연결 요청 조회 가능
  auth.uid() = parent_id
  AND EXISTS (
    SELECT 1 FROM parent_users
    WHERE parent_users.id = auth.uid()
  )
);

-- ============================================
-- Policy: parent_student_links_delete_own
-- Purpose: 학부모가 자신의 대기 중인 연결 요청을 취소할 수 있도록 허용
-- Security: 최소 권한 원칙 - 자신의 ID(auth.uid() = parent_id)이고 대기 중인 요청만 삭제 가능
-- Related: app/(parent)/actions/parentStudentLinkRequestActions.ts::cancelLinkRequest
-- ============================================
-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "parent_student_links_delete_own" ON parent_student_links;

-- is_approved 컬럼이 있는 경우에만 조건 추가
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parent_student_links'
      AND column_name = 'is_approved'
  ) THEN
    -- is_approved 컬럼이 있는 경우: 대기 중인 요청만 삭제 가능
    DROP POLICY IF EXISTS "parent_student_links_delete_own" ON parent_student_links;
    
    CREATE POLICY "parent_student_links_delete_own"
    ON parent_student_links
    FOR DELETE
    USING (
      -- 학부모는 자신의 대기 중인 연결 요청만 삭제 가능
      auth.uid() = parent_id
      AND (is_approved IS NULL OR is_approved = false)
      AND EXISTS (
        SELECT 1 FROM parent_users
        WHERE parent_users.id = auth.uid()
      )
    );
  ELSE
    -- is_approved 컬럼이 없는 경우: 모든 요청 삭제 가능 (하위 호환성)
    DROP POLICY IF EXISTS "parent_student_links_delete_own" ON parent_student_links;
    
    CREATE POLICY "parent_student_links_delete_own"
    ON parent_student_links
    FOR DELETE
    USING (
      -- 학부모는 자신의 연결 요청 삭제 가능
      auth.uid() = parent_id
      AND EXISTS (
        SELECT 1 FROM parent_users
        WHERE parent_users.id = auth.uid()
      )
    );
  END IF;
END $$;

