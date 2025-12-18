-- 학생 구분 필드 추가
-- 고등부, 중등부, 기타 구분을 위한 division 필드 추가

-- division 필드 추가 (text, nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'division'
  ) THEN
    ALTER TABLE students 
    ADD COLUMN division text 
    CHECK (division IS NULL OR division IN ('고등부', '중등부', '기타'));
    
    COMMENT ON COLUMN students.division IS '학생 구분: 고등부, 중등부, 기타';
  END IF;
END $$;

-- 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_students_division 
ON public.students USING btree (division);

-- 기존 데이터 마이그레이션 (선택적)
-- school_type 기반으로 자동 설정
-- HIGH -> 고등부, MIDDLE -> 중등부, 나머지 -> NULL (수동 설정 필요)
UPDATE students
SET division = CASE
  WHEN school_type = 'HIGH' THEN '고등부'
  WHEN school_type = 'MIDDLE' THEN '중등부'
  ELSE NULL
END
WHERE division IS NULL AND school_type IS NOT NULL;

