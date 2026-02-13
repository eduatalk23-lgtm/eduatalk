ALTER TABLE consultation_schedules
  ADD COLUMN IF NOT EXISTS notification_targets text[] NOT NULL DEFAULT '{mother}';

COMMENT ON COLUMN consultation_schedules.notification_targets
  IS '알림 대상: student, mother, father 조합';
