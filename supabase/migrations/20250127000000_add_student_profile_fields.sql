-- Migration: Add student profile fields for my page
-- Description: 학생 마이페이지에 필요한 필드 추가 (학교, 성별, 연락처, 입시년도, 개정교육과정, 진학희망대학교, 진로계열)
-- Date: 2025-01-27

-- ============================================
-- 1. 기본 정보 필드 추가
-- ============================================

DO $$
BEGIN
  -- 학교
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'school'
  ) THEN
    ALTER TABLE students ADD COLUMN school text;
  END IF;

  -- 성별
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'gender'
  ) THEN
    ALTER TABLE students ADD COLUMN gender text CHECK (gender IN ('남', '여', '기타'));
  END IF;

  -- 연락처 (본인)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE students ADD COLUMN phone text;
  END IF;

  -- 모 연락처
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'mother_phone'
  ) THEN
    ALTER TABLE students ADD COLUMN mother_phone text;
  END IF;

  -- 부 연락처
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'father_phone'
  ) THEN
    ALTER TABLE students ADD COLUMN father_phone text;
  END IF;
END $$;

-- ============================================
-- 2. 입시 정보 필드 추가
-- ============================================

DO $$
BEGIN
  -- 입시년도
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'exam_year'
  ) THEN
    ALTER TABLE students ADD COLUMN exam_year integer;
  END IF;

  -- 개정교육과정
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'curriculum_revision'
  ) THEN
    ALTER TABLE students ADD COLUMN curriculum_revision text CHECK (curriculum_revision IN ('2009 개정', '2015 개정', '2022 개정'));
  END IF;
END $$;

-- ============================================
-- 3. 진로 정보 필드 추가
-- ============================================

DO $$
BEGIN
  -- 진학 희망 대학교 1순위
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'desired_university_1'
  ) THEN
    ALTER TABLE students ADD COLUMN desired_university_1 text;
  END IF;

  -- 진학 희망 대학교 2순위
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'desired_university_2'
  ) THEN
    ALTER TABLE students ADD COLUMN desired_university_2 text;
  END IF;

  -- 진학 희망 대학교 3순위
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'desired_university_3'
  ) THEN
    ALTER TABLE students ADD COLUMN desired_university_3 text;
  END IF;

  -- 희망 진로 계열
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'desired_career_field'
  ) THEN
    ALTER TABLE students ADD COLUMN desired_career_field text CHECK (
      desired_career_field IN (
        '인문계열', '사회계열', '자연계열', '공학계열', 
        '의약계열', '예체능계열', '교육계열', '농업계열', 
        '해양계열', '기타'
      )
    );
  END IF;
END $$;

-- ============================================
-- 4. 코멘트 추가
-- ============================================

COMMENT ON COLUMN students.school IS '학교명';
COMMENT ON COLUMN students.gender IS '성별 (남, 여, 기타)';
COMMENT ON COLUMN students.phone IS '학생 본인 연락처';
COMMENT ON COLUMN students.mother_phone IS '어머니 연락처';
COMMENT ON COLUMN students.father_phone IS '아버지 연락처';
COMMENT ON COLUMN students.exam_year IS '입시년도 (학년 기준 자동 계산 가능)';
COMMENT ON COLUMN students.curriculum_revision IS '개정교육과정 (2009 개정, 2015 개정, 2022 개정)';
COMMENT ON COLUMN students.desired_university_1 IS '진학 희망 대학교 1순위';
COMMENT ON COLUMN students.desired_university_2 IS '진학 희망 대학교 2순위';
COMMENT ON COLUMN students.desired_university_3 IS '진학 희망 대학교 3순위';
COMMENT ON COLUMN students.desired_career_field IS '희망 진로 계열';

