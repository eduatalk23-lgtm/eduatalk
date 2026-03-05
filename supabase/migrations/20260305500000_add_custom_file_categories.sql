-- Custom File Categories per Tenant
-- 테넌트별 커스텀 파일 카테고리

CREATE TABLE public.file_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique key per tenant
CREATE UNIQUE INDEX idx_file_categories_tenant_key ON public.file_categories(tenant_id, key)
WHERE is_active = true;

CREATE INDEX idx_file_categories_tenant ON public.file_categories(tenant_id);

-- RLS
ALTER TABLE public.file_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "file_categories_select"
  ON public.file_categories FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = file_categories.tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = file_categories.tenant_id
      AND s.id IN (SELECT student_id FROM public.parent_student_links WHERE parent_id = auth.uid())
    )
  );

CREATE POLICY "file_categories_admin_insert"
  ON public.file_categories FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = file_categories.tenant_id)
  );

CREATE POLICY "file_categories_admin_update"
  ON public.file_categories FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = file_categories.tenant_id)
  );

-- Relax files.category and file_requests.category CHECK constraints
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_category_check;
ALTER TABLE public.file_requests DROP CONSTRAINT IF EXISTS file_requests_category_check;
