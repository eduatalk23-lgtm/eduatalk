-- ============================================
-- 기존 planner_exclusions → student_non_study_time 마이그레이션
-- ============================================
-- 조건: student_non_study_time에 이미 레코드가 있는 플래너만 대상 (신규 스타일)
-- 안전장치: ON CONFLICT DO NOTHING으로 중복 방지

INSERT INTO student_non_study_time (
  planner_id,
  tenant_id,
  plan_date,
  type,
  start_time,
  end_time,
  label,
  sequence,
  is_template_based,
  is_all_day,
  exclusion_type,
  source
)
SELECT
  pe.planner_id,
  pe.tenant_id,
  pe.exclusion_date AS plan_date,
  '제외일' AS type,
  NULL AS start_time,
  NULL AS end_time,
  pe.reason AS label,
  0 AS sequence,
  false AS is_template_based,
  true AS is_all_day,
  pe.exclusion_type,
  'migration' AS source
FROM planner_exclusions pe
WHERE EXISTS (
  -- 해당 플래너에 이미 student_non_study_time 레코드가 있는 경우만
  SELECT 1
  FROM student_non_study_time snst
  WHERE snst.planner_id = pe.planner_id
  LIMIT 1
)
AND NOT EXISTS (
  -- 이미 동일 날짜에 제외일이 있으면 스킵
  SELECT 1
  FROM student_non_study_time snst2
  WHERE snst2.planner_id = pe.planner_id
    AND snst2.plan_date = pe.exclusion_date
    AND snst2.type = '제외일'
)
ON CONFLICT DO NOTHING;
