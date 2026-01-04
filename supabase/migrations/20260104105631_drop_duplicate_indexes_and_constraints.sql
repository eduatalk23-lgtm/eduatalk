-- =====================================================
-- Drop Duplicate Indexes and Constraints Migration
--
-- 7개의 중복 인덱스/제약조건을 제거하여 스토리지 절약 및
-- INSERT/UPDATE 성능 향상
-- =====================================================

-- =====================================================
-- Part 1: Drop Duplicate UNIQUE Constraints (3개)
-- =====================================================

-- 1. excluded_dates: 동일한 (student_id, date) unique 제약
-- Keep: excluded_dates_student_id_date_key
ALTER TABLE excluded_dates
DROP CONSTRAINT IF EXISTS excluded_dates_student_date_unique;

-- 2. student_block_schedule: 동일한 unique 제약
-- Keep: student_block_schedule_student_id_day_of_week_start_time_key
ALTER TABLE student_block_schedule
DROP CONSTRAINT IF EXISTS student_block_schedule_unique;

-- 3. tenant_blocks: 동일한 unique 제약 (레거시 이름)
-- Keep: tenant_blocks_set_day_time_unique
ALTER TABLE tenant_blocks
DROP CONSTRAINT IF EXISTS template_blocks_template_block_set_id_day_of_week_start_tim_key;

-- =====================================================
-- Part 2: Drop Duplicate Indexes (4개)
-- =====================================================

-- 4. academy_schedules: 동일한 plan_group_id 인덱스
-- Keep: idx_academy_schedules_plan_group_id
DROP INDEX IF EXISTS idx_academy_schedules_group_id;

-- 5. plan_groups: 동일한 camp_invitation_id 인덱스
-- Keep: idx_plan_groups_camp_invitation_id
DROP INDEX IF EXISTS idx_plan_groups_camp_invitation;

-- 6. student_study_sessions: 동일한 active session 인덱스
-- Keep: idx_study_sessions_active
DROP INDEX IF EXISTS idx_student_study_sessions_student_ended;

-- 7. tenant_block_sets: 레거시 이름 인덱스
-- Keep: idx_tenant_block_sets_tenant_id
DROP INDEX IF EXISTS idx_template_block_sets_tenant_id;

-- =====================================================
-- Summary:
-- Dropped 3 duplicate UNIQUE constraints:
-- - excluded_dates_student_date_unique
-- - student_block_schedule_unique
-- - template_blocks_template_block_set_id_day_of_week_start_tim_key
--
-- Dropped 4 duplicate indexes:
-- - idx_academy_schedules_group_id
-- - idx_plan_groups_camp_invitation
-- - idx_student_study_sessions_student_ended
-- - idx_template_block_sets_tenant_id
-- =====================================================
