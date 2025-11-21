-- ============================================
-- 마이그레이션: books와 lectures 테이블의 master_content_id 외래 키 수정
-- ============================================
-- 
-- 문제: books와 lectures 테이블의 master_content_id가 content_masters를 참조하고 있음
-- 해결: master_books와 master_lectures를 참조하도록 변경
-- ============================================

-- ============================================
-- 1. books 테이블의 외래 키 제약조건 수정
-- ============================================

DO $$
BEGIN
  -- 기존 외래 키 제약조건 삭제 (content_masters 참조)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND constraint_name = 'books_master_content_id_fkey'
  ) THEN
    ALTER TABLE books 
    DROP CONSTRAINT books_master_content_id_fkey;
    
    RAISE NOTICE '✅ books_master_content_id_fkey 제약조건 삭제 완료';
  END IF;

  -- 새로운 외래 키 제약조건 생성 (master_books 참조)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'master_books'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'master_content_id'
  ) THEN
    ALTER TABLE books 
    ADD CONSTRAINT books_master_content_id_fkey 
    FOREIGN KEY (master_content_id) REFERENCES master_books(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ books_master_content_id_fkey 제약조건 생성 완료 (master_books 참조)';
  END IF;
END $$;

-- ============================================
-- 2. lectures 테이블의 외래 키 제약조건 수정
-- ============================================

DO $$
BEGIN
  -- 기존 외래 키 제약조건 삭제 (content_masters 참조)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND constraint_name = 'lectures_master_content_id_fkey'
  ) THEN
    ALTER TABLE lectures 
    DROP CONSTRAINT lectures_master_content_id_fkey;
    
    RAISE NOTICE '✅ lectures_master_content_id_fkey 제약조건 삭제 완료';
  END IF;

  -- 새로운 외래 키 제약조건 생성 (master_lectures 참조)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'master_lectures'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'master_content_id'
  ) THEN
    ALTER TABLE lectures 
    ADD CONSTRAINT lectures_master_content_id_fkey 
    FOREIGN KEY (master_content_id) REFERENCES master_lectures(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ lectures_master_content_id_fkey 제약조건 생성 완료 (master_lectures 참조)';
  END IF;
END $$;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🎉 master_content_id 외래 키 제약조건 수정 완료!';
  RAISE NOTICE '   - books.master_content_id → master_books.id';
  RAISE NOTICE '   - lectures.master_content_id → master_lectures.id';
END $$;

