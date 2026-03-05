-- =============================================================================
-- Drive System: File Exchange Hub
-- files, file_contexts, file_requests + Storage bucket + RLS
-- =============================================================================

-- 1. files 테이블: 모든 파일의 메타데이터
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_by_role TEXT NOT NULL CHECK (uploaded_by_role IN ('student', 'parent', 'admin')),
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  category TEXT NOT NULL CHECK (category IN ('transcript', 'grade_report')),
  version_group_id UUID NOT NULL DEFAULT gen_random_uuid(),
  version_number INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT files_storage_path_unique UNIQUE (storage_path)
);

COMMENT ON TABLE public.files IS '통합 파일 저장소 - 드라이브/워크플로우/채팅 파일 메타데이터';
COMMENT ON COLUMN public.files.category IS 'transcript=생기부, grade_report=성적표';
COMMENT ON COLUMN public.files.version_group_id IS '같은 그룹 = 같은 파일의 버전들';
COMMENT ON COLUMN public.files.expires_at IS '만료일시 (업로드+7일, 워크플로우는 최종상태+7일)';

-- 인덱스
CREATE INDEX idx_files_student_id ON public.files(student_id);
CREATE INDEX idx_files_tenant_id ON public.files(tenant_id);
CREATE INDEX idx_files_expires_at ON public.files(expires_at);
CREATE INDEX idx_files_version_group ON public.files(version_group_id, version_number);

-- 2. file_contexts 테이블: 파일의 용처 연결
CREATE TABLE public.file_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('drive', 'workflow', 'chat')),
  context_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.file_contexts IS '파일 용처 연결 (drive/workflow/chat)';
COMMENT ON COLUMN public.file_contexts.context_id IS 'workflow=file_request_id, chat=message_id, drive=null';

CREATE INDEX idx_file_contexts_file_id ON public.file_contexts(file_id);
CREATE INDEX idx_file_contexts_context ON public.file_contexts(context_type, context_id);

-- 3. file_requests 테이블: 워크플로우 요청
CREATE TABLE public.file_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('transcript', 'grade_report')),
  allowed_mime_types TEXT[],
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'overdue', 'submitted', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.file_requests IS '파일 제출 워크플로우 요청';
COMMENT ON COLUMN public.file_requests.status IS 'pending→submitted→approved/rejected';

CREATE INDEX idx_file_requests_student_id ON public.file_requests(student_id);
CREATE INDEX idx_file_requests_tenant_id ON public.file_requests(tenant_id);
CREATE INDEX idx_file_requests_status ON public.file_requests(student_id, status);

-- =============================================================================
-- Storage Bucket
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('drive-files', 'drive-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 인증된 사용자만 업로드 (경로: tenant_id/student_id/...)
CREATE POLICY "drive file upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'drive-files');

-- Storage RLS: 인증된 사용자만 조회 (signed URL 사용)
CREATE POLICY "drive file read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'drive-files');

-- Storage RLS: 업로드한 사용자만 삭제
CREATE POLICY "drive file delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'drive-files');

-- =============================================================================
-- Table RLS
-- =============================================================================

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_requests ENABLE ROW LEVEL SECURITY;

-- files: 학생 본인 파일 조회
CREATE POLICY "files_student_select"
  ON public.files FOR SELECT
  TO authenticated
  USING (
    -- 학생 본인
    uploaded_by = auth.uid()
    OR
    -- 관리자 (같은 tenant)
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = files.tenant_id
    )
    OR
    -- 학부모 (연결된 자녀)
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      JOIN public.parent_users pu ON pu.id = psl.parent_id
      WHERE pu.id = auth.uid()
        AND psl.student_id = files.student_id
    )
  );

-- files: 인증 사용자 삽입
CREATE POLICY "files_insert"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- files: 업로더 본인 또는 관리자 삭제
CREATE POLICY "files_delete"
  ON public.files FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = files.tenant_id
    )
  );

-- file_contexts: files와 동일한 접근 범위
CREATE POLICY "file_contexts_select"
  ON public.file_contexts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_contexts.file_id
    )
  );

CREATE POLICY "file_contexts_insert"
  ON public.file_contexts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_contexts.file_id
        AND f.uploaded_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.files f
      JOIN public.admin_users au ON au.tenant_id = f.tenant_id
      WHERE f.id = file_contexts.file_id
        AND au.id = auth.uid()
    )
  );

CREATE POLICY "file_contexts_delete"
  ON public.file_contexts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_contexts.file_id
        AND (
          f.uploaded_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.id = auth.uid()
              AND au.tenant_id = f.tenant_id
          )
        )
    )
  );

-- file_requests: 관련 학생/학부모/관리자 조회
CREATE POLICY "file_requests_select"
  ON public.file_requests FOR SELECT
  TO authenticated
  USING (
    -- 관리자
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = file_requests.tenant_id
    )
    OR
    -- 학생 본인
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = file_requests.student_id
        AND s.id = auth.uid()
    )
    OR
    -- 학부모
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      JOIN public.parent_users pu ON pu.id = psl.parent_id
      WHERE pu.id = auth.uid()
        AND psl.student_id = file_requests.student_id
    )
  );

-- file_requests: 관리자만 생성
CREATE POLICY "file_requests_insert"
  ON public.file_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = file_requests.tenant_id
    )
  );

-- file_requests: 관리자만 수정 (상태 변경)
CREATE POLICY "file_requests_update"
  ON public.file_requests FOR UPDATE
  TO authenticated
  USING (
    -- 관리자 (승인/반려)
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = file_requests.tenant_id
    )
    OR
    -- 학생 본인 (제출 시 상태 변경)
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = file_requests.student_id
        AND s.id = auth.uid()
    )
    OR
    -- 학부모 (대리 제출 시)
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      JOIN public.parent_users pu ON pu.id = psl.parent_id
      WHERE pu.id = auth.uid()
        AND psl.student_id = file_requests.student_id
    )
  );

-- file_requests: 관리자만 삭제
CREATE POLICY "file_requests_delete"
  ON public.file_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid()
        AND au.tenant_id = file_requests.tenant_id
    )
  );

-- =============================================================================
-- updated_at 자동 갱신 트리거
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_file_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_file_requests_updated_at
  BEFORE UPDATE ON public.file_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_file_requests_updated_at();
