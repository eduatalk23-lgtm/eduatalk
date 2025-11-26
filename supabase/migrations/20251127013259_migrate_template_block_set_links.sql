-- Migration: Migrate Template Block Set Links
-- Description: 기존 template_data.block_set_id를 camp_template_block_sets로 마이그레이션
-- Date: 2025-11-27

-- ============================================
-- 1. 기존 template_data.block_set_id를 연결 테이블로 마이그레이션
-- ============================================

-- template_data에 block_set_id가 있는 템플릿들을 camp_template_block_sets에 연결
-- 1:N 관계이므로 하나의 템플릿당 하나의 블록 세트만 연결
INSERT INTO camp_template_block_sets (camp_template_id, tenant_block_set_id)
SELECT DISTINCT ON (ct.id)
  ct.id as camp_template_id,
  (ct.template_data::json->>'block_set_id')::uuid as tenant_block_set_id
FROM camp_templates ct
WHERE ct.template_data::json->>'block_set_id' IS NOT NULL
  AND (ct.template_data::json->>'block_set_id')::uuid IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM tenant_block_sets tbs 
    WHERE tbs.id = (ct.template_data::json->>'block_set_id')::uuid
  )
ON CONFLICT (camp_template_id) DO NOTHING;

-- ============================================
-- 2. 마이그레이션 결과 확인용 뷰 (선택사항)
-- ============================================

-- 마이그레이션된 템플릿 수 확인
-- SELECT COUNT(*) as migrated_count FROM camp_template_block_sets;

