-- Request Templates for File Workflow
-- 관리자가 자주 사용하는 파일 요청 설정을 템플릿으로 저장

CREATE TABLE public.request_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  allowed_mime_types TEXT[],
  deadline_days INT, -- 적용 시점으로부터 N일 후 기한
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_request_templates_tenant ON public.request_templates(tenant_id);

-- RLS
ALTER TABLE public.request_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request_templates_select"
  ON public.request_templates FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = request_templates.tenant_id)
  );

CREATE POLICY "request_templates_admin_insert"
  ON public.request_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = request_templates.tenant_id)
  );

CREATE POLICY "request_templates_admin_update"
  ON public.request_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = request_templates.tenant_id)
  );

CREATE POLICY "request_templates_admin_delete"
  ON public.request_templates FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = request_templates.tenant_id)
  );

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER update_request_templates_updated_at
  BEFORE UPDATE ON public.request_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_file_requests_updated_at();
