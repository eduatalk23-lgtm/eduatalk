-- ============================================
-- academy_schedules 테이블 DROP
-- ============================================
--
-- 전제:
--   - 모든 코드가 calendar_events 기반으로 전환 완료
--   - create_plan_group_atomic RPC에서 academy_schedules INSERT 제거 완료
--   - delete_planner_cascade RPC에서 academy_schedules 참조는 이미 calendar_events 기반으로 변경됨
--

DROP TABLE IF EXISTS academy_schedules CASCADE;
