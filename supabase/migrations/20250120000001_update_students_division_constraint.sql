-- students.division 필드 제약조건 변경
-- 기존 CHECK 제약조건 제거하고 애플리케이션 레벨에서만 검증
-- (옵션 3: CHECK 제약조건 제거하고 애플리케이션 레벨에서만 검증)

-- 기존 CHECK 제약조건 찾기 및 제거
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- students 테이블의 division 관련 CHECK 제약조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'students'::regclass
    AND contype = 'c'
    AND conname LIKE '%division%';
  
  -- 제약조건이 있으면 제거
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE students DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE '제거된 제약조건: %', constraint_name;
  ELSE
    RAISE NOTICE '제거할 division 관련 CHECK 제약조건이 없습니다.';
  END IF;
END $$;

-- 코멘트 업데이트
COMMENT ON COLUMN students.division IS '학생 구분: student_divisions 테이블의 name 값을 참조 (애플리케이션 레벨에서 검증)';

