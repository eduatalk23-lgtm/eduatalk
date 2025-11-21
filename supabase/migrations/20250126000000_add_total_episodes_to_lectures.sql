-- ============================================
-- 마이그레이션: lectures 테이블에 total_episodes 필드 추가
-- ============================================

DO $$
BEGIN
  -- lectures 테이블에 total_episodes 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'total_episodes'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN total_episodes integer CHECK (total_episodes > 0);
    
    CREATE INDEX IF NOT EXISTS idx_lectures_total_episodes ON lectures(total_episodes) WHERE total_episodes IS NOT NULL;
    
    COMMENT ON COLUMN lectures.total_episodes IS '총 회차 수';
  END IF;
END $$;

