-- 플랜 템플릿 테이블 생성
-- 관리자가 플랜 구성을 템플릿으로 저장하고 재사용할 수 있도록 함

CREATE TABLE IF NOT EXISTS plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_templates_tenant_id ON plan_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plan_templates_created_by ON plan_templates(created_by);

-- RLS 정책
ALTER TABLE plan_templates ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능
CREATE POLICY "Admins can manage plan templates"
  ON plan_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = plan_templates.tenant_id
        AND au.role IN ('admin', 'consultant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = plan_templates.tenant_id
        AND au.role IN ('admin', 'consultant')
    )
  );

-- 코멘트
COMMENT ON TABLE plan_templates IS '플랜 템플릿 - 관리자가 저장한 플랜 구성 템플릿';
COMMENT ON COLUMN plan_templates.items IS '템플릿 아이템 배열 (JSON)';
