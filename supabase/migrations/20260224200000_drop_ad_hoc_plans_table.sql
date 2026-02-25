-- ============================================
-- Drop ad_hoc_plans table
-- ============================================
--
-- 전제:
--   - 모든 코드가 student_plan(is_adhoc=true) + calendar_events 기반으로 전환 완료
--   - ad_hoc_plans 테이블 데이터는 calendar_events로 마이그레이션 완료 (20260223200000)
--   - 참조 FK 컬럼(adhoc_source_id, ad_hoc_plan_id, migrated_from_adhoc_id)은
--     마이그레이션 추적용이므로 컬럼 자체는 유지하되 FK 제약만 제거
--

-- 1. FK 제약 조건 제거 (참조하는 테이블들)
ALTER TABLE IF EXISTS student_plan
  DROP CONSTRAINT IF EXISTS fk_student_plan_adhoc_source;

ALTER TABLE IF EXISTS plan_events
  DROP CONSTRAINT IF EXISTS plan_events_ad_hoc_plan_id_fkey;

ALTER TABLE IF EXISTS plan_groups
  DROP CONSTRAINT IF EXISTS plan_groups_migrated_from_adhoc_id_fkey;

-- 2. ad_hoc_plans 테이블 드롭
DROP TABLE IF EXISTS ad_hoc_plans CASCADE;
