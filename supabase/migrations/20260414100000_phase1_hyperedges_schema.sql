-- ============================================
-- Phase 1 (Layer 2 Hypergraph): N-ary 수렴 엣지 영속화
-- student_record_hyperedges — 3+개 레코드가 하나의 테마로 수렴하는 hyperedge
-- Layer 1 (student_record_edges, binary) 위의 상위 계층
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_hyperedges (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id         UUID REFERENCES public.student_record_analysis_pipelines(id)
                        ON DELETE SET NULL,

  -- 하이퍼엣지 식별
  theme_slug          TEXT NOT NULL,                    -- 결정적 slug (hash 또는 정규화된 키워드)
  theme_label         TEXT NOT NULL,                    -- 사람이 읽는 라벨 (공유 키워드 상위 N개)
  hyperedge_type      TEXT NOT NULL DEFAULT 'theme_convergence',

  -- 멤버 노드 (jsonb 배열)
  -- [{ recordType, recordId, label, grade, role? }]
  members             JSONB NOT NULL,
  member_count        INT NOT NULL,                     -- members 길이 캐시 (≥3)

  -- 컨텍스트 (Layer 1 패턴 답습)
  edge_context        TEXT NOT NULL DEFAULT 'analysis',

  -- 품질 메타
  confidence          NUMERIC NOT NULL DEFAULT 0.6,     -- 0.0~1.0
  evidence            TEXT,                             -- 수렴 근거 (규칙/LLM 산출)
  shared_keywords     TEXT[],                           -- 공유 키워드
  shared_competencies TEXT[],                           -- 공유 역량 slug

  -- Staleness / Versioning
  is_stale            BOOLEAN NOT NULL DEFAULT FALSE,
  stale_reason        TEXT,
  snapshot_version    INT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CHECK 제약
  CONSTRAINT student_record_hyperedges_type_check
    CHECK (hyperedge_type IN ('theme_convergence', 'narrative_arc')),
  CONSTRAINT student_record_hyperedges_context_check
    CHECK (edge_context IN ('analysis', 'projected', 'synthesis_inferred')),
  CONSTRAINT student_record_hyperedges_member_count_check
    CHECK (member_count >= 2 AND member_count = jsonb_array_length(members)),
  CONSTRAINT student_record_hyperedges_confidence_range
    CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_hyperedges_student
  ON public.student_record_hyperedges(student_id, tenant_id)
  WHERE is_stale = FALSE;

CREATE INDEX IF NOT EXISTS idx_hyperedges_pipeline
  ON public.student_record_hyperedges(pipeline_id);

CREATE INDEX IF NOT EXISTS idx_hyperedges_theme
  ON public.student_record_hyperedges(student_id, theme_slug);

CREATE INDEX IF NOT EXISTS idx_hyperedges_stale
  ON public.student_record_hyperedges(student_id, is_stale)
  WHERE is_stale = TRUE;

-- 중복 방지 partial UNIQUE (활성 상태 기준)
-- insert RPC의 ON CONFLICT DO NOTHING용
CREATE UNIQUE INDEX IF NOT EXISTS idx_hyperedges_unique_active
  ON public.student_record_hyperedges
  (student_id, hyperedge_type, theme_slug, edge_context)
  WHERE is_stale = FALSE;

-- RLS (Layer 1 edges 정책 답습: tenant_id 기반 admin_manage)
ALTER TABLE public.student_record_hyperedges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_hyperedges" ON public.student_record_hyperedges
  FOR ALL
  USING (
    tenant_id = (
      SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    )
  );

-- 주석
COMMENT ON TABLE public.student_record_hyperedges IS
  'Layer 2 Hypergraph: 3+개 레코드(세특/창체/독서 등)가 하나의 테마로 수렴하는 N-ary 엣지. Layer 1 (student_record_edges, binary) 위의 상위 계층. Phase 1 (2026-04-14).';
COMMENT ON COLUMN public.student_record_hyperedges.members IS
  '하이퍼엣지 멤버: [{ recordType, recordId, label, grade, role? }]. member_count >=3 권장 (규칙 기반 기본값).';
COMMENT ON COLUMN public.student_record_hyperedges.theme_slug IS
  '결정적 slug (공유 키워드 정규화 또는 hash). unique 기준의 일부.';
COMMENT ON COLUMN public.student_record_hyperedges.edge_context IS
  'Layer 1과 동일 3종: analysis(파이프라인), projected(설계 모드), synthesis_inferred(S3 이후 동적 추론, Phase 1.5).';
