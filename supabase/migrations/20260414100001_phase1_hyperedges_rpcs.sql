-- ============================================
-- Phase 1: Hyperedges RPC 2종 (replace + insert)
-- Layer 1 edges RPC 패턴 답습
-- ============================================

-- 1. 치환형 (atomic DELETE+INSERT, 컨텍스트 단위)
CREATE OR REPLACE FUNCTION replace_student_record_hyperedges(
  p_student_id uuid,
  p_tenant_id uuid,
  p_pipeline_id uuid,
  p_edge_context text,
  p_hyperedges jsonb DEFAULT '[]'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Advisory Lock: 같은 학생+context 동시 교체 차단
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_hyperedges_' || p_edge_context)
  );

  -- 1. 해당 컨텍스트의 하이퍼엣지 삭제
  DELETE FROM student_record_hyperedges
  WHERE student_id = p_student_id
    AND tenant_id = p_tenant_id
    AND edge_context = p_edge_context;

  -- 2. 새 하이퍼엣지 삽입
  IF jsonb_array_length(p_hyperedges) > 0 THEN
    INSERT INTO student_record_hyperedges (
      tenant_id, student_id, pipeline_id,
      theme_slug, theme_label, hyperedge_type,
      members, member_count,
      edge_context,
      confidence, evidence, shared_keywords, shared_competencies
    )
    SELECT
      p_tenant_id,
      p_student_id,
      p_pipeline_id,
      (e->>'theme_slug'),
      (e->>'theme_label'),
      COALESCE(e->>'hyperedge_type', 'theme_convergence'),
      COALESCE(e->'members', '[]'::jsonb),
      jsonb_array_length(COALESCE(e->'members', '[]'::jsonb)),
      p_edge_context,
      COALESCE((e->>'confidence')::numeric, 0.6),
      e->>'evidence',
      CASE WHEN e->'shared_keywords' IS NOT NULL AND e->'shared_keywords' != 'null'::jsonb
        THEN ARRAY(SELECT jsonb_array_elements_text(e->'shared_keywords'))
        ELSE NULL
      END,
      CASE WHEN e->'shared_competencies' IS NOT NULL AND e->'shared_competencies' != 'null'::jsonb
        THEN ARRAY(SELECT jsonb_array_elements_text(e->'shared_competencies'))
        ELSE NULL
      END
    FROM jsonb_array_elements(p_hyperedges) AS e;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2. 보존형 (기존 유지 + 추가만, Phase 1.5 LLM 방식용)
-- ON CONFLICT DO NOTHING: (student_id, hyperedge_type, theme_slug, edge_context) WHERE is_stale=false
CREATE OR REPLACE FUNCTION insert_student_record_hyperedges(
  p_student_id uuid,
  p_tenant_id uuid,
  p_pipeline_id uuid,
  p_edge_context text DEFAULT 'synthesis_inferred',
  p_hyperedges jsonb DEFAULT '[]'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_insert_hyperedges_' || p_edge_context)
  );

  IF jsonb_array_length(p_hyperedges) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO student_record_hyperedges (
    tenant_id, student_id, pipeline_id,
    theme_slug, theme_label, hyperedge_type,
    members, member_count,
    edge_context,
    confidence, evidence, shared_keywords, shared_competencies
  )
  SELECT
    p_tenant_id,
    p_student_id,
    p_pipeline_id,
    (e->>'theme_slug'),
    (e->>'theme_label'),
    COALESCE(e->>'hyperedge_type', 'theme_convergence'),
    COALESCE(e->'members', '[]'::jsonb),
    jsonb_array_length(COALESCE(e->'members', '[]'::jsonb)),
    p_edge_context,
    COALESCE((e->>'confidence')::numeric, 0.6),
    e->>'evidence',
    CASE WHEN e->'shared_keywords' IS NOT NULL AND e->'shared_keywords' != 'null'::jsonb
      THEN ARRAY(SELECT jsonb_array_elements_text(e->'shared_keywords'))
      ELSE NULL
    END,
    CASE WHEN e->'shared_competencies' IS NOT NULL AND e->'shared_competencies' != 'null'::jsonb
      THEN ARRAY(SELECT jsonb_array_elements_text(e->'shared_competencies'))
      ELSE NULL
    END
  FROM jsonb_array_elements(p_hyperedges) AS e
  ON CONFLICT (student_id, hyperedge_type, theme_slug, edge_context)
    WHERE is_stale = FALSE
    DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION replace_student_record_hyperedges IS
  'Layer 2 hyperedges 원자적 교체 (Advisory Lock + DELETE+INSERT). p_edge_context 단위로 치환.';
COMMENT ON FUNCTION insert_student_record_hyperedges IS
  'Layer 2 hyperedges 보존형 삽입. 중복은 ON CONFLICT DO NOTHING. Phase 1.5 LLM 추론용.';
