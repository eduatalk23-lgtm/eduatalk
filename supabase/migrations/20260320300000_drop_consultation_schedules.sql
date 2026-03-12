-- Phase 5: consultation_schedules 테이블 제거
-- 모든 CRUD는 calendar_events + consultation_event_data로 전환 완료
-- sms_logs.consultation_schedule_id / student_consulting_notes.consultation_schedule_id는
-- 이미 calendar_events.id 값을 저장하므로 FK만 해제하고 컬럼은 유지

-- 1. sms_logs FK 해제 (consultation_schedules → calendar_events.id soft reference)
ALTER TABLE sms_logs
  DROP CONSTRAINT IF EXISTS sms_logs_consultation_schedule_id_fkey;

-- 2. student_consulting_notes FK 해제
ALTER TABLE student_consulting_notes
  DROP CONSTRAINT IF EXISTS student_consulting_notes_consultation_schedule_id_fkey;

-- 3. consultation_schedules 테이블 DROP
DROP TABLE IF EXISTS consultation_schedules CASCADE;

-- 4. 컬럼 주석 업데이트 (consultation_schedule_id가 실제로는 calendar_events.id를 참조함을 기록)
COMMENT ON COLUMN sms_logs.consultation_schedule_id IS 'References calendar_events.id (legacy column name from consultation_schedules era)';
COMMENT ON COLUMN student_consulting_notes.consultation_schedule_id IS 'References calendar_events.id (legacy column name from consultation_schedules era)';
