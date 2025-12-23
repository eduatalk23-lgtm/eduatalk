-- ============================================
-- Migration: camp_template_block_sets 테이블 RLS 정책 추가
-- Date: 2025-12-22
-- Purpose: 관리자/컨설턴트가 템플릿-블록세트 연결을 관리할 수 있도록 RLS 정책 추가
-- Related: app/(admin)/actions/campTemplateBlockSets.ts
-- ============================================

-- ============================================
-- 1. RLS 활성화
-- ============================================
ALTER TABLE camp_template_block_sets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. SELECT 정책: 자신의 테넌트에 속한 템플릿의 연결 정보 조회
-- ============================================
DROP POLICY IF EXISTS "camp_template_block_sets_select_for_admin" ON camp_template_block_sets;

CREATE POLICY "camp_template_block_sets_select_for_admin"
ON camp_template_block_sets
FOR SELECT
TO authenticated
USING (
  -- 관리자/컨설턴트만 조회 가능
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  -- 자신의 테넌트에 속한 템플릿의 연결 정보만 조회 가능
  AND (
    -- 일반 관리자/컨설턴트: 템플릿의 테넌트가 자신의 테넌트와 일치해야 함
    EXISTS (
      SELECT 1 FROM camp_templates
      WHERE camp_templates.id = camp_template_block_sets.camp_template_id
        AND camp_templates.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
    )
    -- Super Admin: 모든 템플릿의 연결 정보 조회 가능
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
);

-- ============================================
-- 3. INSERT 정책: 자신의 테넌트에 속한 템플릿과 블록 세트 연결 생성
-- ============================================
DROP POLICY IF EXISTS "camp_template_block_sets_insert_for_admin" ON camp_template_block_sets;

CREATE POLICY "camp_template_block_sets_insert_for_admin"
ON camp_template_block_sets
FOR INSERT
TO authenticated
WITH CHECK (
  -- 관리자/컨설턴트만 INSERT 가능
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  -- 자신의 테넌트에 속한 템플릿만 연결 가능
  AND EXISTS (
    SELECT 1 FROM camp_templates
    WHERE camp_templates.id = camp_template_block_sets.camp_template_id
      AND (
        -- 일반 관리자/컨설턴트: 템플릿의 테넌트가 자신의 테넌트와 일치해야 함
        camp_templates.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
        -- Super Admin: 모든 템플릿에 연결 가능
        OR EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.role = 'superadmin'
        )
      )
  )
  -- 자신의 테넌트에 속한 블록 세트만 연결 가능
  AND EXISTS (
    SELECT 1 FROM tenant_block_sets
    WHERE tenant_block_sets.id = camp_template_block_sets.tenant_block_set_id
      AND (
        -- 일반 관리자/컨설턴트: 블록 세트의 테넌트가 자신의 테넌트와 일치해야 함
        tenant_block_sets.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
        -- Super Admin: 모든 블록 세트에 연결 가능
        OR EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.role = 'superadmin'
        )
      )
  )
);

-- ============================================
-- 4. UPDATE 정책: 자신의 테넌트에 속한 템플릿의 연결 정보 수정
-- ============================================
DROP POLICY IF EXISTS "camp_template_block_sets_update_for_admin" ON camp_template_block_sets;

CREATE POLICY "camp_template_block_sets_update_for_admin"
ON camp_template_block_sets
FOR UPDATE
TO authenticated
USING (
  -- 관리자/컨설턴트만 UPDATE 가능
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  -- 자신의 테넌트에 속한 템플릿의 연결 정보만 수정 가능
  AND (
    -- 일반 관리자/컨설턴트: 템플릿의 테넌트가 자신의 테넌트와 일치해야 함
    EXISTS (
      SELECT 1 FROM camp_templates
      WHERE camp_templates.id = camp_template_block_sets.camp_template_id
        AND camp_templates.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
    )
    -- Super Admin: 모든 템플릿의 연결 정보 수정 가능
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
)
WITH CHECK (
  -- 수정 후에도 자신의 테넌트에 속한 템플릿과 블록 세트만 연결 가능
  EXISTS (
    SELECT 1 FROM camp_templates
    WHERE camp_templates.id = camp_template_block_sets.camp_template_id
      AND (
        camp_templates.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.role = 'superadmin'
        )
      )
  )
  AND EXISTS (
    SELECT 1 FROM tenant_block_sets
    WHERE tenant_block_sets.id = camp_template_block_sets.tenant_block_set_id
      AND (
        tenant_block_sets.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.role = 'superadmin'
        )
      )
  )
);

-- ============================================
-- 5. DELETE 정책: 자신의 테넌트에 속한 템플릿의 연결 정보 삭제
-- ============================================
DROP POLICY IF EXISTS "camp_template_block_sets_delete_for_admin" ON camp_template_block_sets;

CREATE POLICY "camp_template_block_sets_delete_for_admin"
ON camp_template_block_sets
FOR DELETE
TO authenticated
USING (
  -- 관리자/컨설턴트만 DELETE 가능
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
  -- 자신의 테넌트에 속한 템플릿의 연결 정보만 삭제 가능
  AND (
    -- 일반 관리자/컨설턴트: 템플릿의 테넌트가 자신의 테넌트와 일치해야 함
    EXISTS (
      SELECT 1 FROM camp_templates
      WHERE camp_templates.id = camp_template_block_sets.camp_template_id
        AND camp_templates.tenant_id IN (
          SELECT tenant_id FROM admin_users
          WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id IS NOT NULL
        )
    )
    -- Super Admin: 모든 템플릿의 연결 정보 삭제 가능
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.role = 'superadmin'
    )
  )
);


