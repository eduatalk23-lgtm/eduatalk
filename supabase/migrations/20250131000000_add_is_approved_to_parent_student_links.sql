-- ============================================
-- Migration: parent_student_links 테이블에 is_approved 컬럼 추가
-- Date: 2025-01-31
-- Refs: docs/student-parent-link-system-implementation-todo.md [Phase 2]
-- Purpose: 연결 요청 승인 상태를 관리하기 위한 컬럼 추가
-- ============================================

-- is_approved 컬럼 추가 (이미 존재하면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parent_student_links'
      AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE parent_student_links
    ADD COLUMN is_approved boolean DEFAULT false;
    
    -- 기존 레코드는 모두 승인된 것으로 간주 (기존 연결은 이미 승인된 상태)
    UPDATE parent_student_links
    SET is_approved = true
    WHERE is_approved IS NULL OR is_approved = false;
  END IF;
END $$;

-- approved_at 컬럼 추가 (선택사항, Phase 3에서 사용 예정)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parent_student_links'
      AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE parent_student_links
    ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

