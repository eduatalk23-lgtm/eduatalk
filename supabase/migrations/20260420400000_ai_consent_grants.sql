-- 학생 AI 에이전트 3자 동의 레코드 (M0.5, 2026-04-20)
-- ------------------------------------------------------------
-- feedback_student-agent-opt-in-gate.md — active 승격 시 학부모 명시 동의 필수.
-- docs/student-facing-agent-design.md §3.2.
--
-- MVP 범위:
--   · 3-party signature 테이블 (학생+학부모+컨설턴트)
--   · granted_level='active' 레코드는 3자 서명 CHECK 강제
--   · revoked_at/expires_at 생애주기
--   · UNIQUE partial: 학생당 활성 grant 1건 (revoked_at IS NULL)
--
-- 비MVP (후속):
--   · ConsentWizard 다단계 UI (M0.5 Phase 2)
--   · parent_users 별도 인증 (M3 이후)
--   · COPPA ip_address_hash·document_url 상세 (Tier 3+)
--
-- 현재는 admin 이 paper-based 동의를 기록하는 형태 (Tier 1 alpha).

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_consent_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id)
                ON UPDATE CASCADE ON DELETE CASCADE,

  -- observer 는 가벼운 레코드, active 는 3자 서명 필수
  granted_level TEXT NOT NULL
                  CHECK (granted_level IN ('observer', 'active')),

  -- 3자 서명 (timestamp + user_id)
  student_signed_at     TIMESTAMPTZ,
  student_user_id       UUID REFERENCES auth.users(id),
  parent_signed_at      TIMESTAMPTZ,
  parent_user_id        UUID REFERENCES auth.users(id),
  consultant_signed_at  TIMESTAMPTZ,
  consultant_user_id    UUID REFERENCES auth.users(id),

  -- 범위 세분화 (JSONB 확장 여지)
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 문서 · 버전
  consent_version  TEXT NOT NULL,              -- 예: "ko-2026-07-v1"
  consent_notes    TEXT,                        -- admin 기록 메모

  -- 생애주기
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  revoked_by   UUID REFERENCES auth.users(id),
  revoke_reason TEXT,

  recorded_by  UUID REFERENCES auth.users(id),  -- 이 레코드를 입력한 admin/consultant
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- active 는 3자 서명 timestamp 모두 필수
  CONSTRAINT ai_consent_active_requires_3party CHECK (
    granted_level = 'observer'
    OR (student_signed_at IS NOT NULL
        AND parent_signed_at IS NOT NULL
        AND consultant_signed_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.ai_consent_grants IS
  'M0.5 학생 AI 에이전트 3자 동의 레코드. active 승격은 학생+학부모+컨설턴트 3 signed_at 필수.';
COMMENT ON COLUMN public.ai_consent_grants.consent_version IS
  '동의서 버전 (예: ko-2026-07-v1). 법 개정 시 재동의 추적 용도.';

-- 학생당 활성 active grant 1건 제한 (partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_consent_unique_active_per_student
  ON public.ai_consent_grants (student_id)
  WHERE revoked_at IS NULL AND granted_level = 'active';

-- 학생별 최신 grant 조회
CREATE INDEX IF NOT EXISTS idx_ai_consent_student_effective
  ON public.ai_consent_grants (student_id, effective_at DESC);

-- 활성 grant 빠른 조회 (admin 집계용)
CREATE INDEX IF NOT EXISTS idx_ai_consent_active
  ON public.ai_consent_grants (student_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.ai_consent_grants ENABLE ROW LEVEL SECURITY;

-- admin/consultant 전체 CRUD
CREATE POLICY "ai_consent_grants_admin_all"
  ON public.ai_consent_grants FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생 본인 SELECT
CREATE POLICY "ai_consent_grants_student_select"
  ON public.ai_consent_grants FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- 학부모 SELECT
CREATE POLICY "ai_consent_grants_parent_select"
  ON public.ai_consent_grants FOR SELECT
  USING (public.rls_check_parent_student(student_id));

COMMIT;
