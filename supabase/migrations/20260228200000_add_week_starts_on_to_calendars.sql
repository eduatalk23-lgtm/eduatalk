-- L-1: 주 시작 요일 설정 (0=일, 1=월, ..., 6=토)
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS week_starts_on smallint NOT NULL DEFAULT 0;
COMMENT ON COLUMN calendars.week_starts_on IS '주 시작 요일 (0=일, 1=월, ..., 6=토)';
