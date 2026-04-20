-- ============================================================
-- α4 Proposal Engine — proposal_jobs + proposal_items
--
-- 목적: Perception Trigger 가 triggered=true 로 판정한 학생에 대해
--   "구체 활동 제안 3~5개" 를 생성·영속화.
--
-- Sprint 2 (rule_v1): LLM 없이 결정적 매핑으로 E2E 검증.
-- Sprint 3 (llm_v1): 동일 스키마 위에 engine='llm_v1' 으로 추가.
--
-- 설계 결정:
--   - 1 trigger = 1 proposal_job (재실행 시 새 row).
--   - items 는 UNIQUE (job_id, rank) 로 3~5개 정렬 보장.
--   - student_decision 은 Chat-First Shell 수락률 측정 기반 (Sprint 4+).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. proposal_jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id)
                   ON UPDATE CASCADE ON DELETE CASCADE,

  -- Perception 판정 근거
  perception_source TEXT NOT NULL CHECK (perception_source IN ('snapshot', 'metric_events')),
  severity          TEXT NOT NULL CHECK (severity IN ('none', 'low', 'medium', 'high')),
  perception_reasons TEXT[] NOT NULL DEFAULT '{}',

  -- 엔진 분기 — Sprint 2 rule_v1 / Sprint 3 llm_v1
  engine   TEXT NOT NULL CHECK (engine IN ('rule_v1', 'llm_v1')),
  model    TEXT,
  cost_usd NUMERIC(10,4),

  -- 상태 머신
  status   TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  error    TEXT,

  -- ESS 시점 + gap 우선순위
  state_as_of   JSONB NOT NULL,
  gap_priority  TEXT CHECK (gap_priority IN ('high', 'medium', 'low')),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.proposal_jobs IS
  'α4 Proposal Engine: Perception triggered=true 시 1 job. engine rule_v1(Sprint2) / llm_v1(Sprint3) 분기.';
COMMENT ON COLUMN public.proposal_jobs.perception_source IS
  'snapshot=full diff / metric_events=hakjong delta 만 축소 diff.';
COMMENT ON COLUMN public.proposal_jobs.state_as_of IS
  'StudentStateAsOf (schoolYear/grade/semester/label/builtAt).';
COMMENT ON COLUMN public.proposal_jobs.gap_priority IS
  'BlueprintGap.priority. null 이면 gap 미계산 또는 blueprint 없음.';

-- 학생별 최신 job 조회
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_tenant_student_triggered_at
  ON public.proposal_jobs (tenant_id, student_id, triggered_at DESC);

-- 진행 중 / 실패 job 빠른 조회 (모니터링)
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_active
  ON public.proposal_jobs (status)
  WHERE status IN ('pending', 'running', 'failed');

CREATE OR REPLACE TRIGGER set_updated_at_proposal_jobs
  BEFORE UPDATE ON public.proposal_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. proposal_items
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_items (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id   UUID NOT NULL REFERENCES public.proposal_jobs(id) ON DELETE CASCADE,

  rank     SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 5),

  name     TEXT NOT NULL,
  summary  TEXT NOT NULL,

  target_area  TEXT NOT NULL CHECK (target_area IN ('academic', 'career', 'community')),
  target_axes  TEXT[] NOT NULL CHECK (array_length(target_axes, 1) >= 1),
  roadmap_area TEXT NOT NULL,
  horizon      TEXT NOT NULL CHECK (horizon IN ('immediate', 'this_semester', 'next_semester', 'long_term')),

  rationale        TEXT NOT NULL,
  expected_impact  JSONB NOT NULL,
  prerequisite     TEXT[] NOT NULL DEFAULT '{}',
  risks            TEXT[] NOT NULL DEFAULT '{}',
  evidence_refs    TEXT[] NOT NULL DEFAULT '{}',

  -- Sprint 4+ 수락률 측정
  student_decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (student_decision IN ('pending', 'accepted', 'rejected', 'executed', 'deferred')),
  student_feedback TEXT,
  decided_at       TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (job_id, rank)
);

COMMENT ON TABLE public.proposal_items IS
  'α4 Proposal Engine: 한 job 당 3~5개 제안. rank 1=가장 우선.';
COMMENT ON COLUMN public.proposal_items.target_axes IS
  'CompetencyItemCode[] — 제안이 움직일 기대 역량 축.';
COMMENT ON COLUMN public.proposal_items.expected_impact IS
  '{ hakjongScoreDelta: number|null, axisMovements: [{code, fromGrade, toGrade}] }';
COMMENT ON COLUMN public.proposal_items.student_decision IS
  'Chat-First Shell 수락/거절 수집 (Sprint 4+). 기본 pending.';

CREATE INDEX IF NOT EXISTS idx_proposal_items_job_rank
  ON public.proposal_items (job_id, rank);

CREATE OR REPLACE TRIGGER set_updated_at_proposal_items
  BEFORE UPDATE ON public.proposal_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE public.proposal_jobs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

-- 3-1. proposal_jobs
CREATE POLICY "proposal_jobs_admin_all"
  ON public.proposal_jobs FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "proposal_jobs_student_select"
  ON public.proposal_jobs FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "proposal_jobs_parent_select"
  ON public.proposal_jobs FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- 3-2. proposal_items — job 의 tenant/student 를 통해 판정
CREATE POLICY "proposal_items_admin_all"
  ON public.proposal_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.proposal_jobs j
      WHERE j.id = proposal_items.job_id
        AND public.rls_check_admin_tenant(j.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposal_jobs j
      WHERE j.id = proposal_items.job_id
        AND public.rls_check_admin_tenant(j.tenant_id)
    )
  );

CREATE POLICY "proposal_items_student_select"
  ON public.proposal_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposal_jobs j
      WHERE j.id = proposal_items.job_id
        AND public.rls_check_student_own(j.student_id)
    )
  );

CREATE POLICY "proposal_items_parent_select"
  ON public.proposal_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposal_jobs j
      WHERE j.id = proposal_items.job_id
        AND public.rls_check_parent_student(j.student_id)
    )
  );

-- 학생 본인이 수락/거절을 채팅 UI 에서 직접 업데이트할 수 있도록 (Sprint 4+).
-- 현재 컬럼은 student_decision / student_feedback / decided_at 3개로 제한되나,
-- 최소 권한 원칙으로 FOR UPDATE 허용 후 application layer 에서 컬럼 화이트리스트.
CREATE POLICY "proposal_items_student_update_decision"
  ON public.proposal_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.proposal_jobs j
      WHERE j.id = proposal_items.job_id
        AND public.rls_check_student_own(j.student_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposal_jobs j
      WHERE j.id = proposal_items.job_id
        AND public.rls_check_student_own(j.student_id)
    )
  );

COMMIT;
