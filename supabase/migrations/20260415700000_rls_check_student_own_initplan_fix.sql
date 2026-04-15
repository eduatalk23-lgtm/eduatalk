-- ============================================================
-- rls_check_student_own 함수 initplan 최적화
--
-- 기존 본문: SELECT p_student_id = auth.uid();
-- 문제: bare auth.uid() — CLAUDE.md RLS initplan 규칙 위반.
--   SQL STABLE 함수라 실질 성능 영향은 제한적이지만 프로젝트 규칙과 불일치.
-- 수정: (SELECT auth.uid()) 로 감쌈. 다른 헬퍼(rls_check_admin_tenant,
--   rls_check_parent_student)와 패턴 일치.
--
-- Phase α 적용 중 발견 (session-handoff-2026-04-15-d 참고).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.rls_check_student_own(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT p_student_id = (SELECT auth.uid());
$$;

COMMENT ON FUNCTION public.rls_check_student_own(uuid) IS
  '학생 본인 확인 RLS 헬퍼. initplan 최적화 — (SELECT auth.uid()) 로 감쌈.';

COMMIT;
