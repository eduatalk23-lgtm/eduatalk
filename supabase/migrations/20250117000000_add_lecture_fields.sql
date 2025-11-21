-- ============================================
-- 마이그레이션: lectures 테이블에 platform, difficulty_level 컬럼 추가
-- ============================================

DO $$
BEGIN
  -- platform 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'platform'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN platform text;
    
    -- 인덱스 추가 (선택사항, 검색 성능 향상)
    CREATE INDEX IF NOT EXISTS idx_lectures_platform ON lectures(platform) WHERE platform IS NOT NULL;
  END IF;

  -- difficulty_level 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'difficulty_level'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN difficulty_level text;
    
    -- 인덱스 추가 (선택사항, 검색 성능 향상)
    CREATE INDEX IF NOT EXISTS idx_lectures_difficulty ON lectures(difficulty_level) WHERE difficulty_level IS NOT NULL;
  END IF;
END $$;

