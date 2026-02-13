-- 성적 산출 엔진 산출 컬럼 추가
-- 추정 백분위, 추정 표준편차, 9등급 변환값, 조정등급

ALTER TABLE student_internal_scores
  ADD COLUMN IF NOT EXISTS estimated_percentile numeric NULL,
  ADD COLUMN IF NOT EXISTS estimated_std_dev numeric NULL,
  ADD COLUMN IF NOT EXISTS converted_grade_9 numeric NULL,
  ADD COLUMN IF NOT EXISTS adjusted_grade numeric NULL;

COMMENT ON COLUMN student_internal_scores.estimated_percentile IS '추정 백분위 (석차 활용 시 석차 기반)';
COMMENT ON COLUMN student_internal_scores.estimated_std_dev IS '추정 표준편차';
COMMENT ON COLUMN student_internal_scores.converted_grade_9 IS '9등급 변환값';
COMMENT ON COLUMN student_internal_scores.adjusted_grade IS '조정등급';
