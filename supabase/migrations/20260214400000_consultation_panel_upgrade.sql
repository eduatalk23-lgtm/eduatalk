-- ============================================================
-- 상담 패널 개선: session_type CHECK 해제, program_name 추가, 노트-일정 연결
-- ============================================================

-- 1. session_type CHECK 제약조건 해제 (커스텀 입력 허용)
ALTER TABLE consultation_schedules
  DROP CONSTRAINT IF EXISTS consultation_schedules_session_type_check;

-- 2. program_name 컬럼 추가 (직접 입력값 저장용)
ALTER TABLE consultation_schedules
  ADD COLUMN IF NOT EXISTS program_name TEXT;

COMMENT ON COLUMN consultation_schedules.program_name
  IS '프로그램명 (직접 입력 또는 enrollment JOIN에서 복사). 알림톡 상담유형으로 사용.';

-- 3. student_consulting_notes에 consultation_schedule_id FK 추가 (노트-일정 연결)
ALTER TABLE student_consulting_notes
  ADD COLUMN IF NOT EXISTS consultation_schedule_id UUID
  REFERENCES consultation_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consulting_notes_schedule_id
  ON student_consulting_notes(consultation_schedule_id)
  WHERE consultation_schedule_id IS NOT NULL;

COMMENT ON COLUMN student_consulting_notes.consultation_schedule_id
  IS '연결된 상담 일정 ID (선택). 일정에서 노트 작성 시 자동 연결.';
