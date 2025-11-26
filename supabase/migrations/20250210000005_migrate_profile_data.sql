-- Migration: Migrate profile data from students to student_profiles
-- Description: 기존 students 테이블의 프로필 정보를 student_profiles로 마이그레이션
-- Date: 2025-02-10

-- ============================================
-- 1. 기존 프로필 정보를 student_profiles로 마이그레이션
-- ============================================

-- students 테이블에 프로필 관련 필드가 있는 경우에만 마이그레이션
INSERT INTO student_profiles (
  id,
  tenant_id,
  gender,
  phone,
  mother_phone,
  father_phone,
  created_at,
  updated_at
)
SELECT 
  id,
  tenant_id,
  gender,
  phone,
  mother_phone,
  father_phone,
  created_at,
  updated_at
FROM students
WHERE (gender IS NOT NULL 
       OR phone IS NOT NULL 
       OR mother_phone IS NOT NULL 
       OR father_phone IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM student_profiles 
    WHERE id = students.id
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. 마이그레이션 결과 확인 (로깅용)
-- ============================================

DO $$
DECLARE
  migrated_count integer;
  total_students integer;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM student_profiles;
  SELECT COUNT(*) INTO total_students FROM students;
  
  RAISE NOTICE '마이그레이션 완료: % / % 학생의 프로필 정보가 마이그레이션되었습니다.', migrated_count, total_students;
END $$;









