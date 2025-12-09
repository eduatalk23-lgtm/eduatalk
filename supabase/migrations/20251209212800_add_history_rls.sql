-- ============================================
-- Migration: 히스토리/로그 테이블 RLS 정책 추가
-- Date: 2025-12-09
-- Phase: 2 (재조정 기능 - 데이터 모델 및 롤백 정교화)
-- Refs: docs/refactoring/reschedule_feature_todo.md [R2-10]
-- ============================================

-- plan_history RLS 활성화
ALTER TABLE plan_history ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "tenant_isolation_plan_history" ON plan_history;
DROP POLICY IF EXISTS "student_access_plan_history" ON plan_history;
DROP POLICY IF EXISTS "admin_access_plan_history" ON plan_history;

-- 학생 정책: 자신의 플랜 그룹에 속한 히스토리만 접근 가능
CREATE POLICY "student_access_plan_history" ON plan_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_groups pg
      WHERE pg.id = plan_history.plan_group_id
      AND pg.student_id = auth.uid()
    )
  );

-- 관리자/컨설턴트 정책: 같은 테넌트 내 모든 히스토리 접근 가능
CREATE POLICY "admin_access_plan_history" ON plan_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.tenant_id = plan_history.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.tenant_id = plan_history.tenant_id
    )
  );

-- reschedule_log RLS 활성화
ALTER TABLE reschedule_log ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "tenant_isolation_reschedule_log" ON reschedule_log;
DROP POLICY IF EXISTS "student_access_reschedule_log" ON reschedule_log;
DROP POLICY IF EXISTS "admin_access_reschedule_log" ON reschedule_log;

-- 학생 정책: 자신의 재조정 로그만 접근 가능
CREATE POLICY "student_access_reschedule_log" ON reschedule_log
  FOR SELECT
  USING (student_id = auth.uid());

-- 관리자/컨설턴트 정책: 같은 테넌트 내 모든 재조정 로그 접근 가능
CREATE POLICY "admin_access_reschedule_log" ON reschedule_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.tenant_id = reschedule_log.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.tenant_id = reschedule_log.tenant_id
    )
  );

-- 주석
COMMENT ON POLICY "student_access_plan_history" ON plan_history IS 
'Students can view their own plan history';

COMMENT ON POLICY "admin_access_plan_history" ON plan_history IS 
'Admins can manage all plan history within their tenant';

COMMENT ON POLICY "student_access_reschedule_log" ON reschedule_log IS 
'Students can view their own reschedule logs';

COMMENT ON POLICY "admin_access_reschedule_log" ON reschedule_log IS 
'Admins can manage all reschedule logs within their tenant';

