-- ============================================
-- 마이그레이션: lectures 테이블에 linked_book_id 필드 추가
-- ============================================

DO $$
BEGIN
  -- lectures 테이블에 linked_book_id 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'linked_book_id'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN linked_book_id uuid REFERENCES books(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_lectures_linked_book_id ON lectures(linked_book_id) WHERE linked_book_id IS NOT NULL;
    
    COMMENT ON COLUMN lectures.linked_book_id IS '연결된 교재 ID (선택사항)';
  END IF;
END $$;

