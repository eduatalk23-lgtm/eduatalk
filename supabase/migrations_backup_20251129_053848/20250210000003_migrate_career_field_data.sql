-- Migration: Migrate career field data from students to student_career_field_preferences
-- Description: 기존 students 테이블의 desired_career_field 단일 값을 student_career_field_preferences로 마이그레이션
-- Date: 2025-02-10

-- ============================================
-- 1. 기존 desired_career_field를 student_career_field_preferences로 마이그레이션
-- ============================================

-- students 테이블에 desired_career_field가 있는 경우에만 마이그레이션
INSERT INTO student_career_field_preferences (
  student_id,
  career_field,
  priority,
  created_at,
  updated_at
)
SELECT 
  id,
  desired_career_field,
  1, -- 첫 번째 계열은 priority=1
  created_at,
  updated_at
FROM students
WHERE desired_career_field IS NOT NULL 
  AND desired_career_field != ''
  AND desired_career_field IN (
    '인문계열', '사회계열', '자연계열', '공학계열', '의약계열',
    '예체능계열', '교육계열', '농업계열', '해양계열', '기타'
  )
  AND NOT EXISTS (
    SELECT 1 FROM student_career_field_preferences 
    WHERE student_id = students.id 
      AND career_field = students.desired_career_field
  )
ON CONFLICT (student_id, career_field) DO NOTHING;

-- ============================================
-- 2. 마이그레이션 결과 확인 (로깅용)
-- ============================================

DO $$
DECLARE
  migrated_count integer;
  total_students_with_field integer;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM student_career_field_preferences;
  SELECT COUNT(*) INTO total_students_with_field 
  FROM students 
  WHERE desired_career_field IS NOT NULL AND desired_career_field != '';
  
  RAISE NOTICE '마이그레이션 완료: % / % 학생의 진로 계열 정보가 마이그레이션되었습니다.', migrated_count, total_students_with_field;
END $$;









