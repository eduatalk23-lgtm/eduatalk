-- =============================================================================
-- File Distributions: Admin -> Student read-only file sharing
-- =============================================================================

-- 1. Allow NULL student_id for distribution source files
ALTER TABLE public.files ALTER COLUMN student_id DROP NOT NULL;

-- 2. file_distributions table
CREATE TABLE public.file_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  distributed_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT file_distributions_file_student_unique UNIQUE (file_id, student_id)
);

COMMENT ON TABLE public.file_distributions IS '관리자→학생 자료 배포';

CREATE INDEX idx_file_distributions_student ON public.file_distributions(student_id);
CREATE INDEX idx_file_distributions_tenant ON public.file_distributions(tenant_id);
CREATE INDEX idx_file_distributions_file ON public.file_distributions(file_id);
CREATE INDEX idx_file_distributions_expires ON public.file_distributions(expires_at);

-- 3. RLS
ALTER TABLE public.file_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distributions_select"
  ON public.file_distributions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = file_distributions.student_id AND s.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = file_distributions.tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      JOIN public.parent_users pu ON pu.id = psl.parent_id
      WHERE pu.id = auth.uid() AND psl.student_id = file_distributions.student_id
    )
  );

CREATE POLICY "distributions_admin_insert"
  ON public.file_distributions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = file_distributions.tenant_id));

CREATE POLICY "distributions_admin_update"
  ON public.file_distributions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = file_distributions.tenant_id));

CREATE POLICY "distributions_admin_delete"
  ON public.file_distributions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.tenant_id = file_distributions.tenant_id));

-- 4. Allow students/parents to read distribution source files
CREATE POLICY "files_distribution_select"
  ON public.files FOR SELECT TO authenticated
  USING (
    student_id IS NULL AND EXISTS (
      SELECT 1 FROM public.file_distributions fd
      WHERE fd.file_id = files.id
        AND (
          fd.student_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.parent_student_links psl
            JOIN public.parent_users pu ON pu.id = psl.parent_id
            WHERE pu.id = auth.uid() AND psl.student_id = fd.student_id
          )
        )
    )
  );

-- 5. updated_at trigger (reuse existing function)
CREATE TRIGGER trigger_file_distributions_updated_at
  BEFORE UPDATE ON public.file_distributions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_file_requests_updated_at();
