-- =============================================================================
-- transfer_student_identity RPC 완성 + FK CASCADE 보강
--
-- 수정 사항:
-- 1. user_profiles.id 업데이트 추가 (Extension Table FK 유지)
-- 2. 누락된 ON UPDATE CASCADE 추가 (3개 테이블)
-- 3. user_profiles FK도 ON UPDATE CASCADE로 변경
-- 4. RPC를 마이그레이션에 정식 등록
--
-- transfer 흐름:
--   UPDATE user_profiles SET id = new_id
--     → students.id CASCADE (students_user_profile_fkey)
--       → 48개 자식 테이블 CASCADE
--     → parent_student_links.parent_id CASCADE
-- =============================================================================

-- 1. students.id 참조 FK 중 NO ACTION인 것들을 CASCADE로 변경
ALTER TABLE public.consultation_event_data
  DROP CONSTRAINT IF EXISTS consultation_event_data_student_id_fkey,
  ADD CONSTRAINT consultation_event_data_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.payment_links
  DROP CONSTRAINT IF EXISTS payment_links_student_id_fkey,
  ADD CONSTRAINT payment_links_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.daily_check_ins
  DROP CONSTRAINT IF EXISTS daily_check_ins_student_id_fkey,
  ADD CONSTRAINT daily_check_ins_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. user_profiles.id 참조 FK를 ON UPDATE CASCADE로 변경
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_user_profile_fkey,
  ADD CONSTRAINT students_user_profile_fkey
    FOREIGN KEY (id) REFERENCES public.user_profiles(id)
    ON UPDATE CASCADE;

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_user_profile_fkey,
  ADD CONSTRAINT admin_users_user_profile_fkey
    FOREIGN KEY (id) REFERENCES public.user_profiles(id)
    ON UPDATE CASCADE;

ALTER TABLE public.parent_student_links
  DROP CONSTRAINT IF EXISTS parent_student_links_parent_id_fkey,
  ADD CONSTRAINT parent_student_links_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.user_profiles(id)
    ON UPDATE CASCADE;

-- 3. transfer_student_identity RPC v2: user_profiles.id 변경으로 전체 CASCADE 전파
CREATE OR REPLACE FUNCTION public.transfer_student_identity(old_id uuid, new_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF old_id = new_id THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM students WHERE id = old_id) THEN
    RAISE EXCEPTION 'Student with id % not found', old_id;
  END IF;

  IF EXISTS (SELECT 1 FROM students WHERE id = new_id) THEN
    RAISE EXCEPTION 'Student with id % already exists', new_id;
  END IF;

  -- user_profiles.id 변경 → students.id ON UPDATE CASCADE → 48개 자식 테이블 CASCADE
  UPDATE user_profiles SET id = new_id WHERE id = old_id;

  -- 비-FK 참조 (calendars, calendar_events)는 수동 업데이트
  UPDATE calendars SET owner_id = new_id WHERE owner_id = old_id;
  UPDATE calendars SET created_by = new_id WHERE created_by = old_id;
  UPDATE calendar_events SET student_id = new_id WHERE student_id = old_id;
  UPDATE calendar_events SET created_by = new_id WHERE created_by = old_id;
END;
$$;
