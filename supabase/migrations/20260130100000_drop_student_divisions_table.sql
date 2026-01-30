-- Migration: Drop student_divisions table
-- Description: student_divisions 테이블을 삭제하고 Constants로 대체
-- 이 테이블의 데이터는 더 이상 동적으로 관리되지 않고
-- lib/constants/students.ts의 STUDENT_DIVISIONS 상수로 대체됨

-- Drop the student_divisions table
DROP TABLE IF EXISTS student_divisions;
