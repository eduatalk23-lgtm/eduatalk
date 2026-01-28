-- plan_group_backups 테이블에 planner_id 컬럼 추가
-- 삭제된 플랜 그룹을 플래너 단위로 필터링하기 위함

ALTER TABLE plan_group_backups
  ADD COLUMN planner_id UUID NULL
  REFERENCES planners(id) ON DELETE SET NULL;

CREATE INDEX idx_plan_group_backups_planner_id
  ON plan_group_backups(planner_id);
