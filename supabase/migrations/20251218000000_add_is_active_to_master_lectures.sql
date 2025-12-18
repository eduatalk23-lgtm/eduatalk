-- ============================================
-- Add is_active column to master_lectures table
-- 마스터 강의 테이블에 is_active 컬럼 추가
-- ============================================
-- Date: 2025-12-18
-- Description: master_lectures 테이블에 is_active 컬럼을 추가하여
--              master_books와 동일한 구조로 맞춤
-- ============================================

DO $$
BEGIN
  -- is_active 컬럼이 존재하지 않는 경우에만 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_lectures'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.master_lectures
      ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

    -- 코멘트 추가
    COMMENT ON COLUMN public.master_lectures.is_active IS '활성화 상태 (true: 활성, false: 비활성)';

    -- 인덱스 추가 (is_active로 필터링하는 쿼리 성능 향상)
    CREATE INDEX IF NOT EXISTS idx_master_lectures_is_active
      ON public.master_lectures(is_active)
      WHERE is_active = true;

    RAISE NOTICE 'master_lectures.is_active column added successfully';
  ELSE
    RAISE NOTICE 'master_lectures.is_active column already exists';
  END IF;
END $$;

-- ============================================
-- 기존 데이터의 is_active 값을 true로 설정
-- ============================================

UPDATE public.master_lectures
SET is_active = true
WHERE is_active IS NULL;
