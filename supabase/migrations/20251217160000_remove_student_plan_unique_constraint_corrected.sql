-- ============================================
-- Migration: Remove student_plan_unique constraint (corrected)
-- Date: 2025-12-17
-- Purpose: Fix incorrect constraint name from previous migration
-- ============================================
-- 
-- Previous migration (20251212000002) tried to remove 
-- "student_plan_student_id_plan_date_block_index_key" but the actual
-- constraint name is "student_plan_unique"
--
-- This constraint prevents multiple plan groups from having plans
-- on the same (student_id, plan_date, block_index) combination,
-- which should be allowed because:
-- 1. Duplicates within the same plan group are prevented by application logic
-- 2. Conflicts between different plan groups are controlled by activation logic
-- 3. Plan group reuse and multiple plan group creation should be allowed

-- Remove the UNIQUE constraint with correct name
ALTER TABLE student_plan 
DROP CONSTRAINT IF EXISTS student_plan_unique;

-- Also try removing with old name in case it exists
ALTER TABLE student_plan 
DROP CONSTRAINT IF EXISTS student_plan_student_id_plan_date_block_index_key;

-- Verify constraint is removed (optional, for documentation)
-- Run this query to verify:
-- SELECT constraint_name 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'student_plan' 
--   AND constraint_type = 'UNIQUE' 
--   AND constraint_name LIKE '%student_plan%';

COMMENT ON TABLE student_plan IS 
'학생별 일일 플랜 테이블. 여러 플랜 그룹이 같은 날짜와 블록에 플랜을 가질 수 있음 (활성화 로직으로 충돌 제어)';

