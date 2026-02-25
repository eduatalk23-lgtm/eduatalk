-- ============================================
-- Drop availability_schedules & availability_windows tables
-- ============================================
-- 이 테이블들은 Cal.com 스타일 주간 가용성 패턴을 저장했으나,
-- calendar_events + rrule 반복이벤트 + non_study_time_blocks JSONB로 완전 대체됨.
-- 코드에서 모든 참조가 제거된 상태.

-- availability_windows는 availability_schedules.id FK
DROP TABLE IF EXISTS availability_windows CASCADE;
DROP TABLE IF EXISTS availability_schedules CASCADE;
