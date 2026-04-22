-- ============================================================
-- Phase D-4 Sprint 1 — 대화 장기 기억 (pgvector)
-- ai_conversation_memories: AI 대화에서 추출된 의미 단위 기억.
--   turn: user+assistant 합본 per-turn 기록 (Sprint 2+ 자동 훅)
--   summary: 긴 대화 자동 요약 (Sprint 3+)
--   explicit: 컨설턴트가 직접 추가한 영구 메모 (D-3 Memory Panel)
-- ============================================================

-- pgvector 는 이미 설치됨 (20260332800000_pgvector_guide_embedding.sql)

CREATE TABLE IF NOT EXISTS public.ai_conversation_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 소유자(대화 owner). superadmin 대화도 owner 는 superadmin 본인.
  owner_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,

  -- 테넌트. superadmin(tenant_id=null) 대화 대비 nullable.
  tenant_id uuid
    REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,

  -- 대화 문맥 학생. 학생 미지정 일반 대화는 NULL.
  subject_student_id uuid
    REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,

  -- 원본 대화/메시지 포인터 (추적용, 메시지 삭제 시 기억은 유지)
  conversation_id uuid
    REFERENCES public.ai_conversations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  source_message_id text
    REFERENCES public.ai_messages(id) ON UPDATE CASCADE ON DELETE SET NULL,

  -- 기억 본문 (검색 매칭 + 프롬프트 주입 대상)
  content text NOT NULL CHECK (char_length(content) > 0),

  -- Gemini gemini-embedding-2-preview 768 dim (guide_embedding 과 동일)
  embedding vector(768),

  kind text NOT NULL DEFAULT 'turn'
    CHECK (kind IN ('turn','summary','explicit')),

  -- D-4 S3+ 확장 여지 (현재 미사용, NULL 허용)
  pinned boolean NOT NULL DEFAULT false,
  decay_score numeric(3,2),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 검색 경로 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_memories_owner_created
  ON public.ai_conversation_memories (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memories_subject
  ON public.ai_conversation_memories (subject_student_id)
  WHERE subject_student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_memories_tenant
  ON public.ai_conversation_memories (tenant_id)
  WHERE tenant_id IS NOT NULL;

-- HNSW 벡터 인덱스 (cosine). guide embedding 과 동일 파라미터.
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding
  ON public.ai_conversation_memories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE TRIGGER set_updated_at_ai_memories
  BEFORE UPDATE ON public.ai_conversation_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS (initplan 래핑 + G-6 Option A)
-- ============================================================

ALTER TABLE public.ai_conversation_memories ENABLE ROW LEVEL SECURITY;

-- owner 본인 CRUD (대화의 주체만 자기 기억을 관리)
CREATE POLICY ai_memories_owner_select
  ON public.ai_conversation_memories
  FOR SELECT
  USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY ai_memories_owner_insert
  ON public.ai_conversation_memories
  FOR INSERT
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY ai_memories_owner_update
  ON public.ai_conversation_memories
  FOR UPDATE
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY ai_memories_owner_delete
  ON public.ai_conversation_memories
  FOR DELETE
  USING (owner_user_id = (SELECT auth.uid()));

-- 동일 테넌트 admin/consultant READ 허용 (감사·품질 관리)
-- 쓰기는 여전히 owner 한정 (임의 기억 주입 차단)
CREATE POLICY ai_memories_tenant_admin_select
  ON public.ai_conversation_memories
  FOR SELECT
  USING (
    tenant_id IS NOT NULL
    AND tenant_id::text = (SELECT (auth.jwt() ->> 'tenant_id'))
    AND (SELECT (auth.jwt() ->> 'user_role')) IN ('admin','consultant')
  );

-- superadmin cross-tenant ALL (Option A)
CREATE POLICY ai_memories_superadmin_all
  ON public.ai_conversation_memories
  FOR ALL
  USING (public.rls_check_is_superadmin())
  WITH CHECK (public.rls_check_is_superadmin());

-- ============================================================
-- Search RPC — 의미 기반 top-K 검색 (SECURITY INVOKER 로 RLS 자동 적용)
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_conversation_memories(
  query_embedding vector(768),
  p_owner_user_id uuid,
  p_subject_student_id uuid DEFAULT NULL,
  p_match_count int DEFAULT 5,
  p_similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  content text,
  kind text,
  conversation_id uuid,
  created_at timestamptz,
  score float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    m.id,
    m.content,
    m.kind,
    m.conversation_id,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS score
  FROM public.ai_conversation_memories m
  WHERE m.embedding IS NOT NULL
    AND m.owner_user_id = p_owner_user_id
    AND (
      p_subject_student_id IS NULL
      OR m.subject_student_id = p_subject_student_id
    )
    AND 1 - (m.embedding <=> query_embedding) >= p_similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT p_match_count;
$$;

GRANT EXECUTE ON FUNCTION public.search_conversation_memories(
  vector(768), uuid, uuid, int, float
) TO authenticated;

-- ============================================================
-- 코멘트
-- ============================================================

COMMENT ON TABLE public.ai_conversation_memories IS
  'Phase D-4: AI 대화의 의미 단위 장기 기억. per-turn + summary + explicit 세 종류 kind. 검색은 pgvector HNSW cosine.';

COMMENT ON COLUMN public.ai_conversation_memories.kind IS
  '기억 종류. turn: 자동 저장된 user+assistant 한 쌍. summary: 긴 대화 요약(D-4 S3). explicit: 컨설턴트 직접 추가(D-3 Memory Panel).';

COMMENT ON COLUMN public.ai_conversation_memories.embedding IS
  'Gemini gemini-embedding-2-preview 768 dim. guide embedding 과 동일 모델/차원.';

COMMENT ON FUNCTION public.search_conversation_memories IS
  'Phase D-4: owner_user_id 기준 의미 검색. subject_student_id 필터 선택. SECURITY INVOKER 로 RLS 적용(cross-owner 누출 불가).';
