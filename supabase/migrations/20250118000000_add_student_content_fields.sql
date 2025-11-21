-- ============================================
-- 마이그레이션: 학생 교재/강의 테이블에 상세 필드 추가
-- revision, semester, subject_category, notes 컬럼 추가
-- ============================================

DO $$
BEGIN
  -- books 테이블에 필드 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'revision'
  ) THEN
    ALTER TABLE books 
    ADD COLUMN revision varchar(20);
    
    CREATE INDEX IF NOT EXISTS idx_books_revision ON books(revision) WHERE revision IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'semester'
  ) THEN
    ALTER TABLE books 
    ADD COLUMN semester varchar(20);
    
    CREATE INDEX IF NOT EXISTS idx_books_semester ON books(semester) WHERE semester IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'subject_category'
  ) THEN
    ALTER TABLE books 
    ADD COLUMN subject_category varchar(50);
    
    CREATE INDEX IF NOT EXISTS idx_books_subject_category ON books(subject_category) WHERE subject_category IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE books 
    ADD COLUMN notes text;
  END IF;

  -- lectures 테이블에 필드 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'revision'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN revision varchar(20);
    
    CREATE INDEX IF NOT EXISTS idx_lectures_revision ON lectures(revision) WHERE revision IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'semester'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN semester varchar(20);
    
    CREATE INDEX IF NOT EXISTS idx_lectures_semester ON lectures(semester) WHERE semester IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'subject_category'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN subject_category varchar(50);
    
    CREATE INDEX IF NOT EXISTS idx_lectures_subject_category ON lectures(subject_category) WHERE subject_category IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE lectures 
    ADD COLUMN notes text;
  END IF;
END $$;

