-- ============================================
-- Phase E1: 엣지 영속화 + 스냅샷 + content_hash
-- 생기부 연결 시스템 고도화
-- ============================================

-- 1. 엣지 테이블
CREATE TABLE IF NOT EXISTS public.student_record_edges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES public.students(id)
                       ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id        UUID REFERENCES public.student_record_analysis_pipelines(id)
                       ON DELETE SET NULL,
  -- Source
  source_record_type VARCHAR(30) NOT NULL,
  source_record_id   UUID NOT NULL,
  source_label       VARCHAR(200) NOT NULL DEFAULT '',
  source_grade       SMALLINT,
  -- Target
  target_record_type VARCHAR(30) NOT NULL,
  target_record_id   UUID,
  target_label       VARCHAR(200) NOT NULL DEFAULT '',
  target_grade       SMALLINT,
  -- Edge
  edge_type          VARCHAR(30) NOT NULL,
  reason             TEXT NOT NULL DEFAULT '',
  shared_competencies TEXT[],
  confidence         REAL NOT NULL DEFAULT 1.0,
  -- Staleness
  is_stale           BOOLEAN NOT NULL DEFAULT FALSE,
  stale_reason       TEXT,
  -- Versioning
  snapshot_version   INTEGER NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_edges_student
  ON public.student_record_edges(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_record_edges_source
  ON public.student_record_edges(source_record_id);
CREATE INDEX IF NOT EXISTS idx_record_edges_target
  ON public.student_record_edges(target_record_id)
  WHERE target_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_record_edges_type
  ON public.student_record_edges(student_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_record_edges_stale
  ON public.student_record_edges(student_id, is_stale)
  WHERE is_stale = TRUE;

-- RLS
ALTER TABLE public.student_record_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_edges" ON public.student_record_edges
  FOR ALL
  USING (
    tenant_id = (
      SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    )
  );

-- 2. 스냅샷 테이블 (이전 분석 비교용)
CREATE TABLE IF NOT EXISTS public.student_record_edge_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.students(id)
                 ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id  UUID NOT NULL REFERENCES public.student_record_analysis_pipelines(id)
                 ON DELETE CASCADE,
  edge_count   INTEGER NOT NULL DEFAULT 0,
  edges_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, pipeline_id)
);

ALTER TABLE public.student_record_edge_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_edge_snapshots" ON public.student_record_edge_snapshots
  FOR ALL
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.tenant_id = (
        SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
      )
    )
  );

-- 3. pipelines에 content_hash 추가
ALTER TABLE public.student_record_analysis_pipelines
  ADD COLUMN IF NOT EXISTS content_hash TEXT;
