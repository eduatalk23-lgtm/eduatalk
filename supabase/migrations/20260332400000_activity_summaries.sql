-- ============================================
-- Phase 9.2: AI 활동 요약서
-- 학생이 담임교사에게 제출하는 활동 요약서를 AI로 생성
-- ============================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.student_record_activity_summaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,

  -- 요약 범위
  school_year     integer NOT NULL,
  target_grades   integer[] NOT NULL,

  -- 생성된 요약
  summary_title   varchar(200) NOT NULL,
  summary_sections jsonb NOT NULL DEFAULT '[]',
  summary_text    text NOT NULL,

  -- AI 메타
  model_tier      varchar(20) NOT NULL DEFAULT 'standard',
  prompt_version  varchar(10) NOT NULL DEFAULT 'v1',

  -- 상태
  status          varchar(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'confirmed', 'published')),

  -- 편집
  edited_text     text,
  admin_notes     text,

  -- 추적
  created_by      uuid REFERENCES public.user_profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_activity_summaries IS 'Phase 9.2: AI 활동 요약서 (학생→교사 제출용)';

-- 2. 인덱스
CREATE INDEX idx_sras_student_year
  ON public.student_record_activity_summaries(student_id, school_year);
CREATE INDEX idx_sras_student_status
  ON public.student_record_activity_summaries(student_id, status);

-- 3. updated_at 트리거
CREATE TRIGGER set_sras_updated_at
  BEFORE UPDATE ON public.student_record_activity_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS
ALTER TABLE public.student_record_activity_summaries ENABLE ROW LEVEL SECURITY;

-- Admin/Consultant: 테넌트 내 전체 접근
CREATE POLICY "sras_admin_all"
  ON public.student_record_activity_summaries FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- Student: published 상태만 읽기
CREATE POLICY "sras_student_select"
  ON public.student_record_activity_summaries FOR SELECT
  USING (
    public.rls_check_student_own(student_id)
    AND status = 'published'
  );

-- Parent: 연결된 자녀의 published만 읽기
CREATE POLICY "sras_parent_select"
  ON public.student_record_activity_summaries FOR SELECT
  USING (
    public.rls_check_parent_linked(student_id)
    AND status = 'published'
  );
