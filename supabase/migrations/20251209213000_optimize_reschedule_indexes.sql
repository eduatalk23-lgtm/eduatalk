-- ============================================
-- Migration: 재조정 기능 인덱스 정교화
-- Date: 2025-12-09
-- Phase: 3 (재조정 기능 - 성능·운영 고도화)
-- Refs: docs/refactoring/reschedule_feature_todo.md [R3-1]
-- ============================================

-- 플랜 그룹 내 활성 플랜 조회 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_student_plan_group_active 
  ON student_plan (plan_group_id, is_active, status)
  WHERE is_active = true AND status IN ('pending', 'in_progress');

-- 학습 날짜 기준 조회 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_student_plan_due_date 
  ON student_plan (plan_date, plan_group_id, is_active)
  WHERE is_active = true;

-- 버전 그룹 조회 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_student_plan_version_active 
  ON student_plan (version_group_id, is_active) 
  WHERE is_active = true AND version_group_id IS NOT NULL;

-- 재조정 로그 조회 최적화 (플랜 그룹별)
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_reschedule_log_group_created 
  ON reschedule_log (plan_group_id, created_at DESC)
  WHERE status != 'rolled_back';

-- 재조정 로그 조회 최적화 (학생별)
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_reschedule_log_student_created 
  ON reschedule_log (student_id, created_at DESC);

-- 플랜 히스토리 조회 최적화 (재조정 로그별)
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_plan_history_log_plan 
  ON plan_history (reschedule_log_id, plan_id)
  WHERE reschedule_log_id IS NOT NULL;

-- 플랜 히스토리 조회 최적화 (플랜 그룹별)
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_plan_history_group_created 
  ON plan_history (plan_group_id, created_at DESC);

-- 주석
COMMENT ON INDEX idx_student_plan_group_active IS 
'플랜 그룹 내 활성 플랜 조회 최적화 (재조정 대상 조회용)';

COMMENT ON INDEX idx_student_plan_due_date IS 
'학습 날짜 기준 플랜 조회 최적화';

COMMENT ON INDEX idx_student_plan_version_active IS 
'버전 그룹별 활성 플랜 조회 최적화';

COMMENT ON INDEX idx_reschedule_log_group_created IS 
'플랜 그룹별 재조정 로그 조회 최적화 (최신순)';

COMMENT ON INDEX idx_reschedule_log_student_created IS 
'학생별 재조정 로그 조회 최적화 (최신순)';

COMMENT ON INDEX idx_plan_history_log_plan IS 
'재조정 로그별 플랜 히스토리 조회 최적화';

COMMENT ON INDEX idx_plan_history_group_created IS 
'플랜 그룹별 플랜 히스토리 조회 최적화 (최신순)';

