-- L-2: 기본 이벤트 시간 설정 (분 단위)
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS default_estimated_minutes integer DEFAULT NULL;
COMMENT ON COLUMN calendars.default_estimated_minutes IS '빠른 생성 시 기본 이벤트 지속시간 (분)';

-- L-6: 기본 알림 설정 (분 단위 배열)
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS default_reminder_minutes integer[] DEFAULT NULL;
COMMENT ON COLUMN calendars.default_reminder_minutes IS '새 이벤트 생성 시 기본 알림 (분 단위 배열)';
