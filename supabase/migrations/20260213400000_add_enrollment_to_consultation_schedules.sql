-- consultation_schedules에 수강(프로그램) 연결 컬럼 추가
ALTER TABLE consultation_schedules
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consultation_schedules_enrollment
  ON consultation_schedules(enrollment_id);
