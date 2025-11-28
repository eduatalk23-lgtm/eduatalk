-- Migration: Refactor students table
-- Description: students 테이블 정리 - 프로필/진로 필드 제거, school text → school_id FK 변경, 미사용 필드 정리
-- Date: 2025-02-10

-- ============================================
-- 1. school text 필드를 school_id FK로 변환
-- ============================================

-- students 테이블에 school_id 컬럼이 없는 경우 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE students ADD COLUMN school_id uuid;
  END IF;
END $$;

-- school_id FK 제약조건 추가 (없는 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'students_school_id_fkey'
  ) THEN
    ALTER TABLE students
    ADD CONSTRAINT students_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 기존 school text 값을 school_id로 변환
UPDATE students s
SET school_id = sc.id
FROM schools sc
WHERE s.school IS NOT NULL 
  AND s.school != ''
  AND s.school_id IS NULL
  AND sc.name = s.school
  AND sc.type IN ('중학교', '고등학교');

-- ============================================
-- 2. 프로필 필드 제거 (student_profiles로 이동 완료)
-- ============================================

-- gender 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'gender'
  ) THEN
    ALTER TABLE students DROP COLUMN gender;
  END IF;
END $$;

-- phone 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'phone'
  ) THEN
    ALTER TABLE students DROP COLUMN phone;
  END IF;
END $$;

-- mother_phone 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'mother_phone'
  ) THEN
    ALTER TABLE students DROP COLUMN mother_phone;
  END IF;
END $$;

-- father_phone 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'father_phone'
  ) THEN
    ALTER TABLE students DROP COLUMN father_phone;
  END IF;
END $$;

-- ============================================
-- 3. 진로 필드 제거 (student_career_goals로 이동 완료)
-- ============================================

-- exam_year 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'exam_year'
  ) THEN
    ALTER TABLE students DROP COLUMN exam_year;
  END IF;
END $$;

-- curriculum_revision 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'curriculum_revision'
  ) THEN
    ALTER TABLE students DROP COLUMN curriculum_revision;
  END IF;
END $$;

-- desired_university_1 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'desired_university_1'
  ) THEN
    ALTER TABLE students DROP COLUMN desired_university_1;
  END IF;
END $$;

-- desired_university_2 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'desired_university_2'
  ) THEN
    ALTER TABLE students DROP COLUMN desired_university_2;
  END IF;
END $$;

-- desired_university_3 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'desired_university_3'
  ) THEN
    ALTER TABLE students DROP COLUMN desired_university_3;
  END IF;
END $$;

-- desired_career_field 필드 제거 (student_career_field_preferences로 이동 완료)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'desired_career_field'
  ) THEN
    ALTER TABLE students DROP COLUMN desired_career_field;
  END IF;
END $$;

-- ============================================
-- 4. school text 필드 제거 (school_id로 대체)
-- ============================================

-- school 필드 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'school'
  ) THEN
    ALTER TABLE students DROP COLUMN school;
  END IF;
END $$;

-- ============================================
-- 5. 필드명 통일: class_number → class (코드 기준)
-- ============================================

-- class_number가 있고 class가 없는 경우, class_number를 class로 변경
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'class_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'class'
  ) THEN
    ALTER TABLE students RENAME COLUMN class_number TO class;
  END IF;
END $$;

-- class_number가 있고 class도 있는 경우, class_number 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'class_number'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'class'
  ) THEN
    ALTER TABLE students DROP COLUMN class_number;
  END IF;
END $$;

-- ============================================
-- 6. student_number, enrolled_at 필드 활성화 (ERD 필드 활용)
-- ============================================

-- student_number 필드가 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'student_number'
  ) THEN
    ALTER TABLE students ADD COLUMN student_number text;
  END IF;
END $$;

-- enrolled_at 필드가 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'enrolled_at'
  ) THEN
    ALTER TABLE students ADD COLUMN enrolled_at date;
  END IF;
END $$;

-- ============================================
-- 7. status 필드 추가
-- ============================================

-- status 필드 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'status'
  ) THEN
    ALTER TABLE students ADD COLUMN status text DEFAULT 'enrolled' 
      CHECK (status IN ('enrolled', 'on_leave', 'graduated', 'transferred'));
  END IF;
END $$;

-- ============================================
-- 8. 인덱스 추가
-- ============================================

CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);

-- ============================================
-- 9. 코멘트 추가
-- ============================================

COMMENT ON COLUMN students.school_id IS '학교 ID (FK → schools.id)';
COMMENT ON COLUMN students.status IS '학생 상태: enrolled(재학), on_leave(휴학), graduated(졸업), transferred(전학)';
COMMENT ON COLUMN students.student_number IS '학번';
COMMENT ON COLUMN students.enrolled_at IS '입학일';









