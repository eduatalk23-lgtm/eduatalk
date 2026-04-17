-- ============================================================
-- AI Chat Persistence (Chat-First Shell Phase 1)
-- ============================================================
-- 목적: /ai-chat 대화를 영속화. Vercel AI SDK v6 UIMessage.parts[]
--       JSONB 원형 보존. 역할/대상 학생 이중 스코핑 준비.
--
-- 특징:
-- 1. 기존 public.chat_* (사람↔사람)과 분리. AI 대화는 ai_* 프리픽스.
-- 2. RLS initplan 최적화 — (SELECT auth.uid()) 래핑 (CLAUDE.md 규칙).
-- 3. persona + subject_student_id 이중 축 — 컨설턴트가 학생 A/B/C를
--    분리된 대화로 관리할 수 있는 구조(현재 POC에서는 owner 중심 RLS).
-- 4. retention_until — PbD Phase 2 대비 보존기간 컬럼 미리 배치.
-- ============================================================

-- ============================================================
-- 1. ai_conversations — 대화 스레드
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 로그인 주체 (대화 소유자)
  owner_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,

  -- 테넌트 (현재 로그인 사용자의 tenant)
  tenant_id uuid
    REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,

  -- 어떤 페르소나로 진행된 대화인지
  persona text NOT NULL DEFAULT 'student'
    CHECK (persona IN ('student','parent','consultant','admin','superadmin')),

  -- 대상 학생 (컨설턴트/학부모가 특정 학생 문맥으로 대화할 때).
  -- 학생 본인 대화에선 owner_user_id = subject_student_id 이거나 NULL.
  subject_student_id uuid
    REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,

  title text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),

  -- PbD Phase 2 대비 — 보존기간/익명화 후크
  retention_until timestamptz,
  anonymized_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_activity
  ON public.ai_conversations (owner_user_id, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant
  ON public.ai_conversations (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_subject
  ON public.ai_conversations (subject_student_id)
  WHERE subject_student_id IS NOT NULL;

-- updated_at 자동 갱신
CREATE OR REPLACE TRIGGER set_updated_at_ai_conversations
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. ai_messages — 메시지 (UIMessage.parts JSONB 원형 보존)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_messages (
  -- AI SDK v6가 생성한 stable id (서버/클라 공유). text 타입 유지.
  id text PRIMARY KEY,

  conversation_id uuid NOT NULL
    REFERENCES public.ai_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE,

  role text NOT NULL
    CHECK (role IN ('user','assistant','system','tool')),

  -- UIMessage.parts 전체 (text/tool-*/reasoning/file 등 원형 보존)
  parts jsonb NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON public.ai_messages (conversation_id, created_at);

-- ============================================================
-- 3. RLS (initplan 래핑 — 행마다 재평가 방지)
-- ============================================================

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- conversations: 본인 소유만
CREATE POLICY "ai_conversations_owner_select"
  ON public.ai_conversations
  FOR SELECT
  USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "ai_conversations_owner_insert"
  ON public.ai_conversations
  FOR INSERT
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "ai_conversations_owner_update"
  ON public.ai_conversations
  FOR UPDATE
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "ai_conversations_owner_delete"
  ON public.ai_conversations
  FOR DELETE
  USING (owner_user_id = (SELECT auth.uid()));

-- messages: 대화 owner만 (EXISTS + (SELECT auth.uid()) 래핑)
CREATE POLICY "ai_messages_owner_select"
  ON public.ai_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "ai_messages_owner_insert"
  ON public.ai_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "ai_messages_owner_update"
  ON public.ai_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "ai_messages_owner_delete"
  ON public.ai_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.owner_user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 4. 코멘트
-- ============================================================

COMMENT ON TABLE public.ai_conversations IS
  'Chat-First Shell 대화 스레드. 역할(persona)과 대상 학생(subject_student_id) 이중 스코핑.';

COMMENT ON TABLE public.ai_messages IS
  'AI SDK v6 UIMessage.parts[]를 JSONB로 원형 보존. tool 결과·generative UI 포함.';

COMMENT ON COLUMN public.ai_conversations.persona IS
  '대화가 어느 역할의 관점으로 진행되었는지. 동일 user가 여러 persona로 진행 가능.';

COMMENT ON COLUMN public.ai_conversations.subject_student_id IS
  '대화의 대상 학생. 컨설턴트→학생 A/B/C 분리 스레드에 사용. 학생 본인 대화는 self 또는 NULL.';

COMMENT ON COLUMN public.ai_messages.parts IS
  'UIMessage.parts JSONB. [{type:"text",text:"..."},{type:"tool-getScores",state:"output-available",input,output,toolCallId}]';
