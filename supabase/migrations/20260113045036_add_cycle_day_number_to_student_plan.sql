-- =============================================
-- student_plan 테이블에 cycle_day_number 컬럼 추가
-- 1730 시간표 기반 주기 내 일차 번호
-- =============================================

ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS cycle_day_number SMALLINT;

COMMENT ON COLUMN student_plan.cycle_day_number IS '주기 내 일차 번호 (1730 시간표 기반, 예: 1~7)';
