-- 학생 AI 에이전트 접근 권한 (M0, 2026-04-20)
-- ------------------------------------------------------------
-- feedback_student-agent-opt-in-gate.md + docs/student-facing-agent-design.md §3.1.
--
-- 3-state enum:
--   disabled — AI 기능 완전 차단 (기본)
--   observer — AI 분석 OK, 학생 직접 대화 X
--   active   — AI 와 자율 대화 허용 (M0.5 의 ai_consent_grants 3자 서명 필수이지만,
--              M0 에서는 테이블·enum·admin 토글만 도입. application layer 에서
--              "active 승격 전 consent 검증" 로직은 M0.5 에서 부착.)
--
-- RLS:
--   · admin/consultant — 전체 CRUD (tenant 경계)
--   · 학생 본인 — SELECT 만
--   · 학부모 — SELECT 만
--
-- students 테이블 status enrolled/not_enrolled 와는 독립. AI 권한은 별도 축.

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_ai_access (
  student_id       UUID PRIMARY KEY
                     REFERENCES public.students(id)
                     ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_level     TEXT NOT NULL DEFAULT 'disabled'
                     CHECK (access_level IN ('disabled', 'observer', 'active')),

  granted_at       TIMESTAMPTZ,
  granted_by       UUID REFERENCES auth.users(id),

  last_revoked_at  TIMESTAMPTZ,
  revoke_reason    TEXT,

  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_ai_access IS
  'M0 학생 AI 에이전트 접근 권한. 3-state enum (disabled/observer/active). active 승격은 M0.5 의 ai_consent_grants 3자 서명 필수(application layer 가드).';
COMMENT ON COLUMN public.student_ai_access.access_level IS
  'disabled=완전 차단 / observer=분석만·대화 X / active=자율 대화 O (M0.5 동의 필수)';

CREATE INDEX IF NOT EXISTS idx_student_ai_access_level
  ON public.student_ai_access (access_level)
  WHERE access_level <> 'disabled';
CREATE INDEX IF NOT EXISTS idx_student_ai_access_tenant
  ON public.student_ai_access (tenant_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_student_ai_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_student_ai_access_updated_at ON public.student_ai_access;
CREATE TRIGGER tr_student_ai_access_updated_at
  BEFORE UPDATE ON public.student_ai_access
  FOR EACH ROW EXECUTE FUNCTION public.update_student_ai_access_updated_at();

ALTER TABLE public.student_ai_access ENABLE ROW LEVEL SECURITY;

-- admin/consultant 전체 CRUD
CREATE POLICY "student_ai_access_admin_all"
  ON public.student_ai_access FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생 본인 SELECT
CREATE POLICY "student_ai_access_student_select"
  ON public.student_ai_access FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- 학부모 SELECT
CREATE POLICY "student_ai_access_parent_select"
  ON public.student_ai_access FOR SELECT
  USING (public.rls_check_parent_student(student_id));

COMMIT;
