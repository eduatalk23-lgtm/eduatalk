-- ============================================================
-- α5 면접 대응력 모듈 — interview_sessions + chains + answers
--
-- 목적: 생기부 기반 꼬꼬무(follow-up) 5 depth 모의 면접 + 답변 일관성 검증.
--
-- 설계:
--   - root 질문은 기존 student_record_interview_questions (S6 생성) 재사용
--   - chains: depth 1~5 self-referential FK (parent_chain_id)
--   - answers: chain 1건당 답변 1건 (재시도는 새 chain)
--   - analysis 필드는 서버 계산 후 UPDATE (초기 INSERT 시 null)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. interview_sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id)
                 ON UPDATE CASCADE ON DELETE CASCADE,

  scenario     JSONB NOT NULL DEFAULT '{}'::jsonb,

  status       TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned')),

  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  score_summary JSONB,

  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.interview_sessions IS
  'α5 면접 모듈: 모의 면접 1회. scenario(targetMajor/level/focus) + score_summary(avg consistency/authenticity/gapCount/aiSuspicion).';

CREATE INDEX IF NOT EXISTS idx_interview_sessions_tenant_student_started
  ON public.interview_sessions (tenant_id, student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_active
  ON public.interview_sessions (status)
  WHERE status IN ('pending', 'in_progress');

CREATE OR REPLACE TRIGGER set_updated_at_interview_sessions
  BEFORE UPDATE ON public.interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. interview_question_chains
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interview_question_chains (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  root_question_id  UUID NOT NULL REFERENCES public.student_record_interview_questions(id) ON DELETE CASCADE,
  parent_chain_id   UUID REFERENCES public.interview_question_chains(id) ON DELETE CASCADE,

  depth             SMALLINT NOT NULL CHECK (depth BETWEEN 1 AND 5),

  question_text     TEXT NOT NULL,
  expected_hook     TEXT,

  generated_by      TEXT NOT NULL CHECK (generated_by IN ('seed', 'llm_v1')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.interview_question_chains IS
  'α5 꼬꼬무 트리: depth 1 = root(seed), depth 2~5 = follow-up. parent_chain_id 로 이전 질문 연결.';
COMMENT ON COLUMN public.interview_question_chains.expected_hook IS
  '답변에서 드러내야 할 핵심 (LLM hint). rule_v1 은 템플릿 매핑, llm_v1 은 생성.';

CREATE INDEX IF NOT EXISTS idx_iqc_session_depth
  ON public.interview_question_chains (session_id, depth, created_at);
CREATE INDEX IF NOT EXISTS idx_iqc_parent
  ON public.interview_question_chains (parent_chain_id);
CREATE INDEX IF NOT EXISTS idx_iqc_root
  ON public.interview_question_chains (root_question_id);

-- ============================================================
-- 3. interview_answers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interview_answers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id            UUID NOT NULL UNIQUE REFERENCES public.interview_question_chains(id) ON DELETE CASCADE,

  answer_text         TEXT NOT NULL,
  audio_url           TEXT,

  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  consistency_score   NUMERIC(5,2),
  authenticity_score  NUMERIC(5,2),
  ai_signals          JSONB,
  gap_findings        JSONB NOT NULL DEFAULT '[]'::jsonb,
  coach_comment       TEXT,

  analyzed_by         TEXT CHECK (analyzed_by IN ('rule_v1', 'llm_v1')),
  analyzed_at         TIMESTAMPTZ,
  cost_usd            NUMERIC(10,4),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.interview_answers IS
  'α5 학생 답변 + 분석. chain 1건당 답변 1건 (UNIQUE). 재시도는 새 chain 생성.';
COMMENT ON COLUMN public.interview_answers.ai_signals IS
  '{ jargonDensity, sentenceUniformity, vagueHedging } 각 1~5. 합산 → aiSuspicion.';

-- 분석 대기 큐 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_iat_pending_analysis
  ON public.interview_answers (submitted_at)
  WHERE analyzed_at IS NULL;

CREATE OR REPLACE TRIGGER set_updated_at_interview_answers
  BEFORE UPDATE ON public.interview_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.interview_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_question_chains  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers          ENABLE ROW LEVEL SECURITY;

-- 4-1. sessions
CREATE POLICY "interview_sessions_admin_all"
  ON public.interview_sessions FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "interview_sessions_student_select"
  ON public.interview_sessions FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- 학생 본인이 답변 제출 과정에서 session 을 조회·생성·종료
CREATE POLICY "interview_sessions_student_insert"
  ON public.interview_sessions FOR INSERT
  WITH CHECK (public.rls_check_student_own(student_id));

CREATE POLICY "interview_sessions_student_update"
  ON public.interview_sessions FOR UPDATE
  USING (public.rls_check_student_own(student_id))
  WITH CHECK (public.rls_check_student_own(student_id));

CREATE POLICY "interview_sessions_parent_select"
  ON public.interview_sessions FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- 4-2. chains — session 을 통해 판정
CREATE POLICY "interview_chains_admin_all"
  ON public.interview_question_chains FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = interview_question_chains.session_id
        AND public.rls_check_admin_tenant(s.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = interview_question_chains.session_id
        AND public.rls_check_admin_tenant(s.tenant_id)
    )
  );

CREATE POLICY "interview_chains_student_select"
  ON public.interview_question_chains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = interview_question_chains.session_id
        AND public.rls_check_student_own(s.student_id)
    )
  );

CREATE POLICY "interview_chains_parent_select"
  ON public.interview_question_chains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = interview_question_chains.session_id
        AND public.rls_check_parent_student(s.student_id)
    )
  );

-- 4-3. answers — chain → session 경유
CREATE POLICY "interview_answers_admin_all"
  ON public.interview_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_question_chains c
      JOIN public.interview_sessions s ON s.id = c.session_id
      WHERE c.id = interview_answers.chain_id
        AND public.rls_check_admin_tenant(s.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interview_question_chains c
      JOIN public.interview_sessions s ON s.id = c.session_id
      WHERE c.id = interview_answers.chain_id
        AND public.rls_check_admin_tenant(s.tenant_id)
    )
  );

-- 학생 본인이 답변 제출 (INSERT)
CREATE POLICY "interview_answers_student_insert"
  ON public.interview_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interview_question_chains c
      JOIN public.interview_sessions s ON s.id = c.session_id
      WHERE c.id = interview_answers.chain_id
        AND public.rls_check_student_own(s.student_id)
    )
  );

-- 학생 본인이 답변 수정 (재제출 전까지). 분석 필드 수정은 application layer 가 차단.
CREATE POLICY "interview_answers_student_update"
  ON public.interview_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_question_chains c
      JOIN public.interview_sessions s ON s.id = c.session_id
      WHERE c.id = interview_answers.chain_id
        AND public.rls_check_student_own(s.student_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interview_question_chains c
      JOIN public.interview_sessions s ON s.id = c.session_id
      WHERE c.id = interview_answers.chain_id
        AND public.rls_check_student_own(s.student_id)
    )
  );

CREATE POLICY "interview_answers_student_select"
  ON public.interview_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_question_chains c
      JOIN public.interview_sessions s ON s.id = c.session_id
      WHERE c.id = interview_answers.chain_id
        AND public.rls_check_student_own(s.student_id)
    )
  );

CREATE POLICY "interview_answers_parent_select"
  ON public.interview_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_question_chains c
      JOIN public.interview_sessions s ON s.id = c.session_id
      WHERE c.id = interview_answers.chain_id
        AND public.rls_check_parent_student(s.student_id)
    )
  );

COMMIT;
