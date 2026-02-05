-- ============================================================================
-- 비정규화: students 테이블에 school_name 컬럼 추가
--
-- 목적: school_info 테이블과의 조인 없이 학교명 조회 가능
-- 동기화: 트리거를 통해 school_info 변경 시 자동 업데이트
--
-- 참고: students.school_id 형식은 "SCHOOL_XXXX" (예: "SCHOOL_4413")
--       school_info.id 형식은 정수 (예: 4413)
-- ============================================================================

-- 1. students 테이블에 school_name 컬럼 추가
ALTER TABLE students
ADD COLUMN IF NOT EXISTS school_name varchar(100);

COMMENT ON COLUMN students.school_name IS '학교명 (비정규화, school_info에서 복사)';

-- 2. 헬퍼 함수: school_id에서 숫자 ID 추출 ("SCHOOL_4413" -> 4413)
CREATE OR REPLACE FUNCTION extract_school_id_number(school_id_str text)
RETURNS integer AS $$
BEGIN
  IF school_id_str IS NULL OR school_id_str = '' THEN
    RETURN NULL;
  END IF;

  -- "SCHOOL_" 접두사 제거 후 숫자로 변환
  IF school_id_str LIKE 'SCHOOL_%' THEN
    RETURN NULLIF(SUBSTRING(school_id_str FROM 8), '')::integer;
  END IF;

  -- 숫자만 있는 경우 그대로 변환
  RETURN school_id_str::integer;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = public;

-- 3. 기존 데이터 백필: school_id가 있는 학생들의 school_name 채우기
UPDATE students s
SET school_name = si.school_name
FROM school_info si
WHERE s.school_id IS NOT NULL
  AND extract_school_id_number(s.school_id) = si.id
  AND s.school_name IS NULL;

-- 4. 트리거 함수: school_info 변경 시 students.school_name 동기화
CREATE OR REPLACE FUNCTION sync_student_school_name()
RETURNS TRIGGER AS $$
BEGIN
  -- school_name이 변경된 경우에만 업데이트
  IF OLD.school_name IS DISTINCT FROM NEW.school_name THEN
    UPDATE students
    SET school_name = NEW.school_name
    WHERE extract_school_id_number(school_id) = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 5. 트리거 생성: school_info UPDATE 시 발동
DROP TRIGGER IF EXISTS trigger_sync_school_name ON school_info;
CREATE TRIGGER trigger_sync_school_name
  AFTER UPDATE ON school_info
  FOR EACH ROW
  EXECUTE FUNCTION sync_student_school_name();

-- 6. 학생 등록/수정 시 school_name 자동 채우기 함수
CREATE OR REPLACE FUNCTION auto_fill_student_school_name()
RETURNS TRIGGER AS $$
DECLARE
  school_id_num integer;
BEGIN
  school_id_num := extract_school_id_number(NEW.school_id);

  -- school_id가 설정되고, school_name이 비어있으면 자동으로 채움
  IF school_id_num IS NOT NULL AND NEW.school_name IS NULL THEN
    SELECT school_name INTO NEW.school_name
    FROM school_info
    WHERE id = school_id_num;
  END IF;

  -- school_id가 변경되면 school_name도 업데이트
  IF TG_OP = 'UPDATE' AND OLD.school_id IS DISTINCT FROM NEW.school_id THEN
    IF school_id_num IS NOT NULL THEN
      SELECT school_name INTO NEW.school_name
      FROM school_info
      WHERE id = school_id_num;
    ELSE
      NEW.school_name := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 7. 트리거 생성: students INSERT/UPDATE 시 발동
DROP TRIGGER IF EXISTS trigger_auto_fill_school_name ON students;
CREATE TRIGGER trigger_auto_fill_school_name
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_student_school_name();

-- ============================================================================
-- 인덱스 (선택적)
-- ============================================================================

-- school_name으로 검색하는 경우가 있다면 인덱스 추가
-- CREATE INDEX IF NOT EXISTS idx_students_school_name ON students(school_name);
