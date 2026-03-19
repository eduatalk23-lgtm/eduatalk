-- =============================================================================
-- transfer_student_identity RPC v3
--
-- 개선사항:
-- 1. user_profiles에 new_id 존재 여부 검증 추가 (PK 충돌 방지, 명확한 에러 메시지)
-- 2. transfer 후 auth.users.email → user_profiles.email 자동 동기화
--    (acceptInvitation 후처리에만 의존하지 않고 RPC 자체에서 보장)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transfer_student_identity(old_id uuid, new_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF old_id = new_id THEN RETURN; END IF;

  -- 검증 1: 원본 학생 존재 확인
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = old_id) THEN
    RAISE EXCEPTION 'Student with id % not found', old_id;
  END IF;

  -- 검증 2: 대상 ID에 학생 레코드 중복 방지
  IF EXISTS (SELECT 1 FROM students WHERE id = new_id) THEN
    RAISE EXCEPTION 'Student with id % already exists', new_id;
  END IF;

  -- 검증 3: 대상 ID에 user_profiles 레코드 중복 방지 (PK 충돌 사전 차단)
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = new_id) THEN
    RAISE EXCEPTION 'user_profiles with id % already exists — cannot transfer', new_id;
  END IF;

  -- user_profiles.id 변경 → students.id ON UPDATE CASCADE → 자식 테이블 CASCADE
  UPDATE user_profiles SET id = new_id WHERE id = old_id;

  -- 비-FK 참조 (calendars, calendar_events)는 수동 업데이트
  UPDATE calendars SET owner_id = new_id WHERE owner_id = old_id;
  UPDATE calendars SET created_by = new_id WHERE created_by = old_id;
  UPDATE calendar_events SET student_id = new_id WHERE student_id = old_id;
  UPDATE calendar_events SET created_by = new_id WHERE created_by = old_id;

  -- auth.users.email → user_profiles.email 동기화
  UPDATE user_profiles
  SET email = (SELECT email FROM auth.users WHERE id = new_id)
  WHERE id = new_id;
END;
$$;
