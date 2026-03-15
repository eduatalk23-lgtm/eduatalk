-- ============================================================
-- 잔여 RLS auth.uid() / auth.role() initplan 래핑 + parent_users 참조 제거
--
-- 헬퍼 함수 26개는 이미 래핑 완료 (DB 확인).
-- 남은 미래핑 정책 10개 + parent_users 참조 함수 2개 수정.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. parent_users 참조 함수 → user_profiles / parent_student_links로 전환
--    (parent_users 테이블은 20260325300000에서 삭제됨)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rls_check_plan_group_access(p_plan_group_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plan_groups pg
    WHERE pg.id = p_plan_group_id
      AND (
        pg.student_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.admin_users au
          WHERE au.id = (SELECT auth.uid()) AND au.tenant_id = pg.tenant_id
        )
        OR EXISTS (
          SELECT 1 FROM public.parent_student_links psl
          WHERE psl.student_id = pg.student_id AND psl.parent_id = (SELECT auth.uid())
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.rls_check_camp_template_member(p_template_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.camp_templates ct
    WHERE ct.id = p_template_id
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = (SELECT auth.uid())
          AND up.tenant_id = ct.tenant_id
          AND up.is_active = true
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.rls_check_block_set_member(p_block_set_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_block_sets tbs
    WHERE tbs.id = p_block_set_id
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = (SELECT auth.uid())
          AND up.tenant_id = tbs.tenant_id
          AND up.is_active = true
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. storage.objects 정책 래핑 (8개)
-- ─────────────────────────────────────────────────────────────

-- admin-avatars (3개)
DROP POLICY IF EXISTS "admin avatar upload" ON storage.objects;
CREATE POLICY "admin avatar upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'admin-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "admin avatar update" ON storage.objects;
CREATE POLICY "admin avatar update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'admin-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "admin avatar delete" ON storage.objects;
CREATE POLICY "admin avatar delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'admin-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- user-avatars (3개)
DROP POLICY IF EXISTS "user avatar upload" ON storage.objects;
CREATE POLICY "user avatar upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "user avatar update" ON storage.objects;
CREATE POLICY "user avatar update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "user avatar delete" ON storage.objects;
CREATE POLICY "user avatar delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- chat-attachments (2개)
DROP POLICY IF EXISTS "chat attachment upload" ON storage.objects;
CREATE POLICY "chat attachment upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "chat attachment delete" ON storage.objects;
CREATE POLICY "chat attachment delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text);

-- ─────────────────────────────────────────────────────────────
-- 3. user_presence 정책 래핑 (2개)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own presence" ON public.user_presence;
CREATE POLICY "Users can manage own presence"
  ON public.user_presence FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can read all presence" ON public.user_presence;
CREATE POLICY "Service role can read all presence"
  ON public.user_presence FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');
