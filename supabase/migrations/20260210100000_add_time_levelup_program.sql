-- ============================================================================
-- 타임레벨업 프로그램 추가
--
-- 기존 모든 tenant에 "타임레벨업" (code: TIME) 프로그램을 추가합니다.
-- UNIQUE(tenant_id, code) 제약으로 중복 시 무시됩니다.
-- ============================================================================

INSERT INTO programs (tenant_id, code, name, description, display_order)
SELECT
  t.id,
  'TIME',
  '타임레벨업',
  '타임레벨업 프로그램',
  9
FROM tenants t
ON CONFLICT (tenant_id, code) DO NOTHING;
