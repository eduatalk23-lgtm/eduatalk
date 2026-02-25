-- Migration: plan_exclusions → calendar_events (event_type='exclusion')
--
-- plan_exclusions 데이터를 calendar_events로 복사.
-- 플래너가 있는 학생만 마이그레이션 (플래너 없는 학생은 플래너 생성 시 importTimeManagement로 자연 마이그레이션).

-- 1. 기존 plan_exclusions 데이터를 calendar_events로 복사
INSERT INTO calendar_events (
  calendar_id, tenant_id, student_id, title, event_type, event_subtype,
  start_date, end_date, is_all_day, status, transparency, source, order_index, created_at
)
SELECT DISTINCT ON (c.id, pe.exclusion_date, pe.exclusion_type)
  c.id,
  pe.tenant_id,
  pe.student_id,
  COALESCE(pe.reason, '제외일'),
  'exclusion',
  pe.exclusion_type,
  pe.exclusion_date,
  pe.exclusion_date,
  true,
  'confirmed',
  'transparent',
  'migration',
  0,
  pe.created_at
FROM plan_exclusions pe
JOIN planners p ON p.student_id = pe.student_id AND p.deleted_at IS NULL
JOIN calendars c ON c.planner_id = p.id AND c.is_primary = true AND c.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_events ce
  WHERE ce.calendar_id = c.id
    AND ce.event_type = 'exclusion'
    AND ce.start_date = pe.exclusion_date
    AND ce.event_subtype = pe.exclusion_type
    AND ce.deleted_at IS NULL
);

-- 2. 중복 방지 partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_events_exclusion_date
  ON calendar_events (calendar_id, start_date, event_subtype)
  WHERE event_type = 'exclusion' AND deleted_at IS NULL;
