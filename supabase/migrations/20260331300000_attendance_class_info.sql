-- 학반정보 필드 추가: 담임성명, 반, 번호를 학년별로 저장
-- student_record_attendance에 추가 (이미 학년×학생 unique)

ALTER TABLE public.student_record_attendance
  ADD COLUMN IF NOT EXISTS homeroom_teacher TEXT,
  ADD COLUMN IF NOT EXISTS class_name       TEXT,
  ADD COLUMN IF NOT EXISTS student_number   TEXT;

COMMENT ON COLUMN public.student_record_attendance.homeroom_teacher IS '담임 성명';
COMMENT ON COLUMN public.student_record_attendance.class_name IS '반 (학급명)';
COMMENT ON COLUMN public.student_record_attendance.student_number IS '번호';
