-- ============================================
-- Migration: 히스토리/로그 테이블에 tenant_id 추가
-- Date: 2025-12-09
-- Phase: 2 (재조정 기능 - 데이터 모델 및 롤백 정교화)
-- Refs: docs/refactoring/reschedule_feature_todo.md [R2-9]
-- ============================================

-- plan_history에 tenant_id 추가
ALTER TABLE plan_history
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;

-- reschedule_log에 tenant_id 추가
ALTER TABLE reschedule_log
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;

-- 기존 데이터 마이그레이션 (plan_group_id를 통해)
UPDATE plan_history ph
SET tenant_id = pg.tenant_id
FROM plan_groups pg
WHERE ph.plan_group_id = pg.id AND ph.tenant_id IS NULL;

UPDATE reschedule_log rl
SET tenant_id = pg.tenant_id
FROM plan_groups pg
WHERE rl.plan_group_id = pg.id AND rl.tenant_id IS NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_plan_history_tenant_id 
  ON plan_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_reschedule_log_tenant_id 
  ON reschedule_log(tenant_id);

-- 주석
COMMENT ON COLUMN plan_history.tenant_id IS 
'테넌트 ID - 다중 테넌트 지원 및 RLS 정책용';

COMMENT ON COLUMN reschedule_log.tenant_id IS 
'테넌트 ID - 다중 테넌트 지원 및 RLS 정책용';

