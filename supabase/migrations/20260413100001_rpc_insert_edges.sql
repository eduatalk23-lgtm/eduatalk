-- L3-C: 기존 엣지 보존형 삽입 RPC
-- replace_student_record_edges(DELETE+INSERT 치환)와 달리,
-- 기존 엣지를 건드리지 않고 추가만 수행. 중복은 ON CONFLICT DO NOTHING으로 무시.
-- 주 용도: S3 진단 이후 synthesis_inferred edge 동적 추가.

CREATE OR REPLACE FUNCTION insert_student_record_edges(
  p_student_id uuid,
  p_tenant_id uuid,
  p_pipeline_id uuid,
  p_edge_context text DEFAULT 'synthesis_inferred',
  p_edges jsonb DEFAULT '[]'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  -- Advisory Lock: 같은 학생+context의 동시 삽입 직렬화
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_insert_edges_' || p_edge_context)
  );

  IF jsonb_array_length(p_edges) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO student_record_edges (
    tenant_id, student_id, pipeline_id,
    source_record_type, source_record_id, source_label, source_grade,
    target_record_type, target_record_id, target_label, target_grade,
    edge_type, edge_context, reason, shared_competencies, confidence
  )
  SELECT
    p_tenant_id,
    p_student_id,
    p_pipeline_id,
    (e->>'source_record_type'),
    (e->>'source_record_id')::uuid,
    COALESCE(e->>'source_label', ''),
    (e->>'source_grade')::int,
    (e->>'target_record_type'),
    (e->>'target_record_id')::uuid,
    COALESCE(e->>'target_label', ''),
    (e->>'target_grade')::int,
    (e->>'edge_type'),
    p_edge_context,
    COALESCE(e->>'reason', ''),
    CASE WHEN e->'shared_competencies' IS NOT NULL AND e->'shared_competencies' != 'null'::jsonb
      THEN ARRAY(SELECT jsonb_array_elements_text(e->'shared_competencies'))
      ELSE NULL
    END,
    COALESCE((e->>'confidence')::numeric, 0.5)
  FROM jsonb_array_elements(p_edges) AS e
  -- 중복 엣지는 조용히 스킵 (기존 analysis edge 우선 원칙)
  ON CONFLICT (student_id, source_record_id, target_record_id, edge_type, edge_context)
    WHERE target_record_id IS NOT NULL
    DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;
