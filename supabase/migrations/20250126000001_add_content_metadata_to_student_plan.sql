-- Migration: Add content metadata to student_plan for denormalization
-- Description: 플랜 캘린더에서 콘텐츠 정보를 한 번에 조회하기 위해 denormalized 필드 추가
-- Date: 2025-01-25

-- ============================================
-- 1. student_plan에 콘텐츠 메타데이터 필드 추가
-- ============================================

DO $$
BEGIN
  -- content_title: 콘텐츠 이름
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'content_title'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN content_title text;
    
    COMMENT ON COLUMN student_plan.content_title IS '콘텐츠 이름 (denormalized). 조회 성능 향상을 위해 저장';
  END IF;

  -- content_subject: 과목
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'content_subject'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN content_subject text;
    
    COMMENT ON COLUMN student_plan.content_subject IS '과목 (denormalized). 예: 화법과 작문';
  END IF;

  -- content_subject_category: 교과
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'content_subject_category'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN content_subject_category text;
    
    COMMENT ON COLUMN student_plan.content_subject_category IS '교과 (denormalized). 예: 국어';
  END IF;

  -- content_category: 유형
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'content_category'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN content_category text;
    
    COMMENT ON COLUMN student_plan.content_category IS '콘텐츠 유형 (denormalized). 예: 개념서, 문제집 등';
  END IF;
END $$;

-- ============================================
-- 2. 인덱스 추가 (조회 성능 최적화)
-- ============================================

-- 과목별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_student_plan_content_subject 
ON student_plan(content_subject) 
WHERE content_subject IS NOT NULL;

-- 교과별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_student_plan_content_subject_category 
ON student_plan(content_subject_category) 
WHERE content_subject_category IS NOT NULL;

-- 날짜 + 과목 조합 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_student_plan_date_subject 
ON student_plan(plan_date, content_subject) 
WHERE content_subject IS NOT NULL;

-- ============================================
-- 3. 기존 플랜의 denormalized 필드 백필
-- ============================================

-- books 테이블에서 정보 조회하여 업데이트
-- 주의: books 테이블에는 content_category 컬럼이 없으므로 NULL로 설정
UPDATE student_plan sp
SET 
  content_title = b.title,
  content_subject = b.subject,
  content_subject_category = b.subject_category,
  content_category = NULL  -- books 테이블에는 content_category 컬럼이 없음
FROM books b
WHERE sp.content_type = 'book'
  AND sp.content_id = b.id
  AND sp.student_id = b.student_id
  AND (sp.content_title IS NULL OR sp.content_subject IS NULL OR sp.content_subject_category IS NULL OR sp.content_category IS NULL);

-- lectures 테이블에서 정보 조회하여 업데이트
-- 주의: lectures 테이블에는 content_category 컬럼이 없으므로 NULL로 설정
UPDATE student_plan sp
SET 
  content_title = l.title,
  content_subject = l.subject,
  content_subject_category = l.subject_category,
  content_category = NULL  -- lectures 테이블에는 content_category 컬럼이 없음
FROM lectures l
WHERE sp.content_type = 'lecture'
  AND sp.content_id = l.id
  AND sp.student_id = l.student_id
  AND (sp.content_title IS NULL OR sp.content_subject IS NULL OR sp.content_subject_category IS NULL OR sp.content_category IS NULL);

-- student_custom_contents 테이블에서 정보 조회하여 업데이트
-- 주의: student_custom_contents 테이블에는 subject_category, content_category 컬럼이 없으므로 NULL로 설정
UPDATE student_plan sp
SET 
  content_title = c.title,
  content_subject = c.subject,
  content_subject_category = NULL,  -- student_custom_contents 테이블에는 subject_category 컬럼이 없음
  content_category = NULL  -- student_custom_contents 테이블에는 content_category 컬럼이 없음
FROM student_custom_contents c
WHERE sp.content_type = 'custom'
  AND sp.content_id = c.id
  AND sp.student_id = c.student_id
  AND (sp.content_title IS NULL OR sp.content_subject IS NULL OR sp.content_subject_category IS NULL OR sp.content_category IS NULL);

-- 마스터 콘텐츠에서 정보 조회 (학생 콘텐츠에 없는 경우)
-- 마스터 교재
UPDATE student_plan sp
SET 
  content_title = COALESCE(sp.content_title, mb.title),
  content_subject = COALESCE(sp.content_subject, mb.subject),
  content_subject_category = COALESCE(sp.content_subject_category, mb.subject_category),
  content_category = COALESCE(sp.content_category, mb.content_category)
FROM books b
JOIN master_books mb ON b.master_content_id = mb.id
WHERE sp.content_type = 'book'
  AND sp.content_id = b.id
  AND sp.student_id = b.student_id
  AND (sp.content_title IS NULL OR sp.content_subject IS NULL OR sp.content_subject_category IS NULL OR sp.content_category IS NULL);

-- 마스터 강의 (학생 강의가 마스터 강의를 참조하는 경우)
UPDATE student_plan sp
SET 
  content_title = COALESCE(sp.content_title, ml.title),
  content_subject = COALESCE(sp.content_subject, ml.subject),
  content_subject_category = COALESCE(sp.content_subject_category, ml.subject_category),
  content_category = COALESCE(sp.content_category, ml.content_category)
FROM lectures l
JOIN master_lectures ml ON l.master_content_id = ml.id
WHERE sp.content_type = 'lecture'
  AND sp.content_id = l.id
  AND sp.student_id = l.student_id
  AND (sp.content_title IS NULL OR sp.content_subject IS NULL OR sp.content_subject_category IS NULL OR sp.content_category IS NULL);

-- 마스터 교재 직접 참조 (student_plan의 content_id가 직접 master_books.id를 가리키는 경우)
UPDATE student_plan sp
SET 
  content_title = COALESCE(sp.content_title, mb.title),
  content_subject = COALESCE(sp.content_subject, mb.subject),
  content_subject_category = COALESCE(sp.content_subject_category, mb.subject_category),
  content_category = COALESCE(sp.content_category, mb.content_category)
FROM master_books mb
WHERE sp.content_type = 'book'
  AND sp.content_id = mb.id
  AND NOT EXISTS (
    SELECT 1 FROM books b 
    WHERE b.id = sp.content_id AND b.student_id = sp.student_id
  )
  AND (sp.content_title IS NULL OR sp.content_subject IS NULL OR sp.content_subject_category IS NULL OR sp.content_category IS NULL);

-- 마스터 강의 직접 참조 (student_plan의 content_id가 직접 master_lectures.id를 가리키는 경우)
UPDATE student_plan sp
SET 
  content_title = COALESCE(sp.content_title, ml.title),
  content_subject = COALESCE(sp.content_subject, ml.subject),
  content_subject_category = COALESCE(sp.content_subject_category, ml.subject_category),
  content_category = COALESCE(sp.content_category, ml.content_category)
FROM master_lectures ml
WHERE sp.content_type = 'lecture'
  AND sp.content_id = ml.id
  AND NOT EXISTS (
    SELECT 1 FROM lectures l 
    WHERE l.id = sp.content_id AND l.student_id = sp.student_id
  )
  AND (sp.content_title IS NULL OR sp.content_subject IS NULL OR sp.content_subject_category IS NULL OR sp.content_category IS NULL);

