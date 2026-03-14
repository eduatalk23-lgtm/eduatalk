-- =============================================================================
-- Phase A: parent_users 테이블 제거 + Extension Table 패턴 확립
--
-- parent_users는 고유 컬럼이 0개 (모든 컬럼이 user_profiles와 중복)
-- user_profiles WHERE role='parent'로 완전 대체
--
-- 순서: FK 전환 → 트리거 제거 → 테이블 삭제
-- =============================================================================

-- 1. parent_student_links FK를 parent_users → user_profiles로 전환
ALTER TABLE public.parent_student_links
  DROP CONSTRAINT IF EXISTS parent_student_links_parent_id_fkey;

ALTER TABLE public.parent_student_links
  ADD CONSTRAINT parent_student_links_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- 2. students, admin_users에 user_profiles FK 추가 (Extension Table 관계 확립)
--    기존 FK 유지하면서 user_profiles 방향 FK도 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'students_user_profile_fkey' AND table_name = 'students'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_user_profile_fkey
        FOREIGN KEY (id) REFERENCES public.user_profiles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'admin_users_user_profile_fkey' AND table_name = 'admin_users'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_user_profile_fkey
        FOREIGN KEY (id) REFERENCES public.user_profiles(id);
  END IF;
END $$;

-- 3. parent_users 동기화 트리거 제거 (user_profiles가 정본이므로 불필요)
DROP TRIGGER IF EXISTS trg_sync_parent_users_to_user_profiles ON public.parent_users;
DROP FUNCTION IF EXISTS public.sync_parent_users_to_user_profiles();

-- 4. parent_users RLS 정책 제거
DROP POLICY IF EXISTS "parent_users_insert_own" ON public.parent_users;
DROP POLICY IF EXISTS "tenant_isolation_parent_users_delete" ON public.parent_users;
DROP POLICY IF EXISTS "tenant_isolation_parent_users_select" ON public.parent_users;
DROP POLICY IF EXISTS "tenant_isolation_parent_users_update" ON public.parent_users;

-- 5. parent_users 테이블 삭제
DROP TABLE IF EXISTS public.parent_users;

-- 6. user_profiles에 INSERT 정책 추가 (parent_users INSERT 대체)
--    신규 학부모 가입 시 user_profiles에 직접 INSERT
CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

-- 7. user_profiles에 DELETE 정책 추가 (관리자가 학부모 삭제 시)
CREATE POLICY user_profiles_delete_admin ON public.user_profiles
  FOR DELETE USING (
    public.is_super_admin() OR public.rls_check_admin_tenant(tenant_id)
  );
