-- ============================================================
-- 우회학과 고도화: course_type 정규화 (notes → course_type 매핑)
-- notes 컬럼에 저장된 과목 유형을 course_type으로 정규화
-- ============================================================

UPDATE public.department_curriculum
SET course_type = CASE
  WHEN notes IN ('전공필수','전필') THEN '전공필수'
  WHEN notes IN ('전공핵심','전공심화') THEN '전공핵심'
  WHEN notes IN ('전공기초','전공기초(필수)','전기') THEN '전공기초'
  WHEN notes IN ('전공선택','전선','전공인정','전공','전공필수선택') THEN '전공선택'
  WHEN notes IN ('교양필수','교양','대교','교기') THEN '교양필수'
  WHEN notes = '교직' THEN '교직'
  ELSE NULL
END
WHERE notes IS NOT NULL AND course_type IS NULL;

-- 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_dc_course_type
  ON public.department_curriculum(course_type) WHERE course_type IS NOT NULL;
