-- ============================================
-- Migration: Remove student_plan UNIQUE constraint
-- Date: 2025-12-12
-- Purpose: Allow multiple plan groups to have plans on the same date and block_index
-- ============================================

-- Remove the UNIQUE constraint on (student_id, plan_date, block_index)
-- This constraint was preventing multiple plan groups from having plans
-- on the same date and block_index, which is unnecessary because:
-- 1. Duplicates within the same plan group are prevented by application logic (usedIndices)
-- 2. Conflicts between different plan groups are controlled by activation logic
-- 3. Plan group reuse and multiple plan group creation should be allowed

ALTER TABLE student_plan 
DROP CONSTRAINT IF EXISTS student_plan_student_id_plan_date_block_index_key;

COMMENT ON TABLE student_plan IS 
'학생별 일일 플랜 테이블. 여러 플랜 그룹이 같은 날짜와 블록에 플랜을 가질 수 있음 (활성화 로직으로 충돌 제어)';

