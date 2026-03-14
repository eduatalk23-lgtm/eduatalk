-- =============================================================================
-- user_profiles를 auth.users로부터 독립시키기
--
-- 목적: 계정 없는 학생/학부모도 user_profiles 레코드 생성 가능
--       초대 플로우 (관리자→학생 등록→나중에 계정 연결) 지원
--       students_user_profile_fkey 유지 → PostgREST 조인 유지
--
-- 변경: user_profiles.id FK(auth.users) 제거
--       auth.users 삭제 시 user_profiles 정리 트리거 추가
--       students INSERT 시 user_profiles 자동 생성 트리거 추가
-- =============================================================================

-- 1. auth.users FK 제거 (ON DELETE CASCADE도 함께 제거됨)
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- 2. auth.users 삭제 시 user_profiles 정리 트리거
--    (기존 CASCADE 대체 — deleteStudent에서 이미 수동 정리하지만 안전장치)
CREATE OR REPLACE FUNCTION public.cleanup_user_profile_on_auth_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.user_profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_user_profile_on_auth_delete
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_user_profile_on_auth_delete();

-- 3. students INSERT 시 user_profiles 자동 생성 (없으면)
--    초대 플로우: createStudent → students INSERT → 이 트리거가 user_profiles 생성
CREATE OR REPLACE FUNCTION public.ensure_user_profile_for_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, tenant_id, role, name)
  VALUES (NEW.id, NEW.tenant_id, 'student', '')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_user_profile_for_student
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_profile_for_student();

-- 4. 고아 students 레코드 수정 (user_profiles 없는 기존 학생)
INSERT INTO public.user_profiles (id, tenant_id, role, name)
SELECT s.id, s.tenant_id, 'student', ''
FROM public.students s
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = s.id)
ON CONFLICT (id) DO NOTHING;
