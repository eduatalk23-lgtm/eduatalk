-- =============================================
-- student_plan 테이블에 date_type 컬럼 추가
-- 날짜 유형 구분 (study, review 등)
-- =============================================

ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS date_type VARCHAR(20);

COMMENT ON COLUMN student_plan.date_type IS '날짜 유형 (study: 학습일, review: 복습일 등)';
