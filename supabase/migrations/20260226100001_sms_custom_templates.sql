-- SMS 커스텀 템플릿 테이블
-- 관리자가 직접 문자 양식을 생성/편집할 수 있는 DB 기반 템플릿

CREATE TABLE sms_custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'payment', 'notice', 'consultation')),
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_custom_templates_tenant ON sms_custom_templates(tenant_id);
CREATE INDEX idx_sms_custom_templates_active ON sms_custom_templates(tenant_id, is_active);

ALTER TABLE sms_custom_templates ENABLE ROW LEVEL SECURITY;

-- 관리자만 자기 테넌트 템플릿 CRUD 가능
CREATE POLICY "admin_manage_sms_templates"
  ON sms_custom_templates
  FOR ALL
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au WHERE au.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au WHERE au.id = auth.uid()
    )
  );

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_sms_custom_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sms_custom_templates_updated_at
  BEFORE UPDATE ON sms_custom_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_custom_templates_updated_at();
