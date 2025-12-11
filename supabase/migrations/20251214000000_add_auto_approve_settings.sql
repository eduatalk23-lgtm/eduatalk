-- ============================================
-- Migration: tenants 테이블에 자동 승인 설정 추가
-- Date: 2025-02-02
-- Refs: docs/student-parent-link-system-implementation-todo.md [Phase 3]
-- Purpose: tenants.settings JSONB 필드에 parentLinkAutoApprove 설정 구조 추가
-- ============================================

-- tenants 테이블에 settings 컬럼 추가 (없는 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'settings'
  ) THEN
    ALTER TABLE tenants
    ADD COLUMN settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- tenants.settings JSONB 필드에 parentLinkAutoApprove 설정 추가
-- 기존 설정은 유지하고, parentLinkAutoApprove가 없으면 기본값으로 추가
DO $$
DECLARE
  tenant_record RECORD;
  current_settings JSONB;
  default_auto_approve JSONB;
BEGIN
  -- 기본 자동 승인 설정 구조
  default_auto_approve := jsonb_build_object(
    'enabled', false,
    'conditions', jsonb_build_object(
      'sameTenantOnly', true,
      'allowedRelations', jsonb_build_array('father', 'mother')
    )
  );

  -- 모든 테넌트에 대해 설정 추가
  FOR tenant_record IN SELECT id, settings FROM tenants
  LOOP
    current_settings := COALESCE(tenant_record.settings, '{}'::jsonb);
    
    -- parentLinkAutoApprove가 없으면 기본값 추가
    IF NOT (current_settings ? 'parentLinkAutoApprove') THEN
      current_settings := current_settings || jsonb_build_object('parentLinkAutoApprove', default_auto_approve);
      
      UPDATE tenants
      SET settings = current_settings
      WHERE id = tenant_record.id;
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN tenants.settings IS '테넌트 설정 (JSONB). parentLinkAutoApprove 필드: 자동 승인 설정 (enabled: boolean, conditions: {sameTenantOnly: boolean, allowedRelations: string[]})';

