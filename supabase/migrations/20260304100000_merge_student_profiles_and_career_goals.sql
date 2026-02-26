-- ============================================================
-- Migration: student_profiles + student_career_goals → students 통합
--
-- 1:1 과도한 정규화 해소.
-- students 테이블에 이미 phone, gender 컬럼 존재하므로 나머지만 추가.
-- 데이터 보존 불필요 (사용자 확인 완료).
-- ============================================================

-- ========== Phase 1: student_profiles 컬럼 → students ==========

-- phone 은 이미 students에 존재 — 추가하지 않음

ALTER TABLE students ADD COLUMN IF NOT EXISTS gender varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_image_url varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_phone varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS father_phone varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address_detail varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS postal_code varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_phone varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS medical_info text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS interests jsonb;

-- ========== Phase 2: student_career_goals 컬럼 → students ==========

ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_year integer;
ALTER TABLE students ADD COLUMN IF NOT EXISTS curriculum_revision varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS desired_university_ids varchar[];
ALTER TABLE students ADD COLUMN IF NOT EXISTS desired_career_field varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS target_major varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS target_major_2 varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS target_score jsonb;
ALTER TABLE students ADD COLUMN IF NOT EXISTS target_university_type varchar;
ALTER TABLE students ADD COLUMN IF NOT EXISTS career_notes text;

-- ========== Phase 3: 트리거/제약 이동 ==========

-- desired_university_ids 배열 길이 제한 (기존 student_career_goals 트리거에서 이동)
CREATE OR REPLACE FUNCTION check_students_university_ids_length()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.desired_university_ids IS NOT NULL AND array_length(NEW.desired_university_ids, 1) > 6 THEN
    RAISE EXCEPTION 'desired_university_ids can have at most 6 elements';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_students_university_ids_length
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION check_students_university_ids_length();

-- ========== Phase 4: 레거시 테이블 DROP ==========

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_check_university_ids_length ON student_career_goals;
DROP FUNCTION IF EXISTS check_desired_university_ids_length() CASCADE;

-- 테이블 삭제 (CASCADE로 FK, RLS 정책도 함께 삭제)
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS student_career_goals CASCADE;

-- ========== Phase 5: 인덱스 추가 ==========

-- 검색/필터에 자주 사용되는 컬럼 인덱스
CREATE INDEX IF NOT EXISTS idx_students_gender ON students (gender) WHERE gender IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_mother_phone ON students (mother_phone) WHERE mother_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_father_phone ON students (father_phone) WHERE father_phone IS NOT NULL;
