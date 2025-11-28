-- Migration: Migrate career data from students to student_career_goals
-- Description: 기존 students 테이블의 진로 정보를 student_career_goals로 마이그레이션하고 대학교 정보를 정규화
-- Date: 2025-02-10

-- ============================================
-- 1. 기존 진로 정보를 student_career_goals로 마이그레이션
-- ============================================

-- students 테이블에 진로 관련 필드가 있는 경우에만 마이그레이션
DO $$
DECLARE
  student_record RECORD;
  university_1_id uuid;
  university_2_id uuid;
  university_3_id uuid;
BEGIN
  -- students 테이블에 exam_year 또는 curriculum_revision 또는 desired_university 필드가 있는 경우
  FOR student_record IN 
    SELECT 
      id,
      tenant_id,
      exam_year,
      curriculum_revision,
      desired_university_1,
      desired_university_2,
      desired_university_3
    FROM students
    WHERE (exam_year IS NOT NULL 
           OR curriculum_revision IS NOT NULL 
           OR desired_university_1 IS NOT NULL 
           OR desired_university_2 IS NOT NULL 
           OR desired_university_3 IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM student_career_goals 
        WHERE student_id = students.id
      )
  LOOP
    -- desired_university_1을 schools.id로 변환
    IF student_record.desired_university_1 IS NOT NULL AND student_record.desired_university_1 != '' THEN
      SELECT id INTO university_1_id
      FROM schools
      WHERE name = student_record.desired_university_1
        AND type = '대학교'
      LIMIT 1;
    END IF;

    -- desired_university_2를 schools.id로 변환
    IF student_record.desired_university_2 IS NOT NULL AND student_record.desired_university_2 != '' THEN
      SELECT id INTO university_2_id
      FROM schools
      WHERE name = student_record.desired_university_2
        AND type = '대학교'
      LIMIT 1;
    END IF;

    -- desired_university_3을 schools.id로 변환
    IF student_record.desired_university_3 IS NOT NULL AND student_record.desired_university_3 != '' THEN
      SELECT id INTO university_3_id
      FROM schools
      WHERE name = student_record.desired_university_3
        AND type = '대학교'
      LIMIT 1;
    END IF;

    -- student_career_goals에 데이터 삽입
    INSERT INTO student_career_goals (
      student_id,
      tenant_id,
      exam_year,
      curriculum_revision,
      desired_university_1_id,
      desired_university_2_id,
      desired_university_3_id,
      created_at,
      updated_at
    )
    VALUES (
      student_record.id,
      student_record.tenant_id,
      student_record.exam_year,
      student_record.curriculum_revision,
      university_1_id,
      university_2_id,
      university_3_id,
      NOW(),
      NOW()
    )
    ON CONFLICT (student_id) DO NOTHING;

    -- 변수 초기화
    university_1_id := NULL;
    university_2_id := NULL;
    university_3_id := NULL;
  END LOOP;
END $$;

-- ============================================
-- 2. 마이그레이션 결과 확인 (로깅용)
-- ============================================

DO $$
DECLARE
  migrated_count integer;
  total_students integer;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM student_career_goals;
  SELECT COUNT(*) INTO total_students FROM students;
  
  RAISE NOTICE '마이그레이션 완료: % / % 학생의 진로 정보가 마이그레이션되었습니다.', migrated_count, total_students;
END $$;









