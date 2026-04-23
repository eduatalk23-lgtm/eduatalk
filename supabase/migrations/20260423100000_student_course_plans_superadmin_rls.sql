-- Phase E-1 S-2.1 후속: student_course_plans 에 superadmin cross-tenant 정책 추가.
--
-- G-6 Option A (memory/superadmin-option-a-decision.md) 에 따라 superadmin 은
-- 에듀엣톡 운영사 내부 관리자로서 tenant_id=null + 모든 tenant 데이터 접근 가능.
--
-- 기존 정책은 admin/consultant 만 허용하는 `rls_check_admin_tenant` 를 사용해,
-- superadmin 이 Chat Shell 의 createPlan HITL 로 신규 수강 계획을 INSERT 하면
-- "new row violates row-level security policy" 로 거부되었다. 이 마이그레이션은
-- 기존 admin/consultant 정책을 유지한 채 superadmin 전용 ALL 정책을 추가한다.

CREATE POLICY "student_course_plans_superadmin_all"
  ON public.student_course_plans
  FOR ALL
  USING (public.rls_check_is_superadmin())
  WITH CHECK (public.rls_check_is_superadmin());
