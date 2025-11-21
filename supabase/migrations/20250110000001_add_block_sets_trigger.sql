-- Migration: Add updated_at trigger for student_block_sets
-- Description: student_block_sets 테이블의 updated_at 자동 업데이트 트리거 추가
-- Date: 2025-01-10

-- ============================================
-- updated_at 자동 업데이트 함수 생성
-- ============================================

CREATE OR REPLACE FUNCTION update_student_block_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_block_sets'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'student_block_sets'
    AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_block_sets_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_block_sets_updated_at
      BEFORE UPDATE ON student_block_sets
      FOR EACH ROW
      EXECUTE FUNCTION update_student_block_sets_updated_at();
  END IF;
END $$;

