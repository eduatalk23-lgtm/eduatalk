-- 플래너별 플랜그룹 수를 집계하는 RPC 함수
-- 여러 플래너의 그룹 수를 한 번의 쿼리로 효율적으로 조회

CREATE OR REPLACE FUNCTION get_plan_group_counts(p_planner_ids uuid[])
RETURNS TABLE(planner_id uuid, group_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    pg.planner_id,
    COUNT(*)::bigint AS group_count
  FROM plan_groups pg
  WHERE pg.planner_id = ANY(p_planner_ids)
    AND pg.deleted_at IS NULL
  GROUP BY pg.planner_id;
$$;

-- 함수에 대한 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_plan_group_counts(uuid[]) TO authenticated;

COMMENT ON FUNCTION get_plan_group_counts(uuid[]) IS
'플래너 ID 배열을 받아 각 플래너의 플랜그룹 수를 반환합니다.
deleted_at IS NULL인 그룹만 집계합니다.';
