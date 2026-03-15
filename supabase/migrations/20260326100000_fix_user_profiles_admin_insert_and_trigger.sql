-- =============================================================================
-- Fix: user_profiles 관리자 INSERT 정책 추가 + ensure 트리거 개선
--
-- 문제 1: 관리자가 ghost parent 프로필을 user_profiles에 INSERT할 때
--          user_profiles_insert_own 정책(auth.uid() = id)에 의해 차단됨
-- 문제 2: ensure_user_profile_for_student 트리거가 name='' 으로만 생성
--          → 학생 이름이 검색에 반영되지 않음
--
-- 수정 1: 관리자용 INSERT 정책 추가
-- 수정 2: 트리거에서 name도 가져올 수 있도록 개선 (upsertStudent에서 전달)
-- =============================================================================

-- 1. user_profiles 관리자 INSERT 정책 추가
--    관리자가 같은 테넌트의 ghost parent/student 프로필을 생성할 수 있도록 허용
CREATE POLICY user_profiles_insert_admin ON public.user_profiles
  FOR INSERT WITH CHECK (
    public.rls_check_admin_tenant(tenant_id)
  );

-- 2. 고아 students 레코드 수정 (user_profiles 없는 기존 학생 — 백필)
INSERT INTO public.user_profiles (id, tenant_id, role, name)
SELECT s.id, s.tenant_id, 'student', ''
FROM public.students s
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = s.id)
ON CONFLICT (id) DO NOTHING;
