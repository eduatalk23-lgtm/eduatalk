-- 학원 일정 중복 방지를 위한 유니크 제약 추가
-- 동일 학생의 같은 요일, 시작/종료 시간에 중복 일정 방지

-- 시간관리 영역 (plan_group_id IS NULL)에 대한 유니크 인덱스
-- 특정 플랜 그룹에 속하지 않은 일정의 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_schedules_unique_time_management
ON academy_schedules (student_id, day_of_week, start_time, end_time)
WHERE plan_group_id IS NULL;

-- 각 플랜 그룹 내에서의 유니크 제약
-- 동일 플랜 그룹 내 같은 시간대 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_schedules_unique_per_group
ON academy_schedules (student_id, plan_group_id, day_of_week, start_time, end_time)
WHERE plan_group_id IS NOT NULL;

COMMENT ON INDEX idx_academy_schedules_unique_time_management IS '시간관리 영역 학원 일정 중복 방지';
COMMENT ON INDEX idx_academy_schedules_unique_per_group IS '플랜 그룹별 학원 일정 중복 방지';
