-- 엣지 원자적 교체 RPC (Phase 1-1: 트랜잭션 + Advisory Lock)
-- DELETE+INSERT를 단일 트랜잭션으로 실행하여 크래시 시 데이터 유실 방지.

CREATE OR REPLACE FUNCTION replace_student_record_edges(
  p_student_id uuid,
  p_tenant_id uuid,
  p_pipeline_id uuid,
  p_edge_context text,
  p_edges jsonb DEFAULT '[]'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Advisory Lock: 같은 학생+context의 동시 교체 차단
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_edges_' || p_edge_context)
  );

  -- 1. 해당 context 엣지 삭제
  DELETE FROM student_record_edges
  WHERE student_id = p_student_id
    AND tenant_id = p_tenant_id
    AND edge_context = p_edge_context;

  -- 2. 새 엣지 삽입
  IF jsonb_array_length(p_edges) > 0 THEN
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
      (e->>'source_record_id'),
      COALESCE(e->>'source_label', ''),
      (e->>'source_grade')::int,
      (e->>'target_record_type'),
      e->>'target_record_id',
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
    FROM jsonb_array_elements(p_edges) AS e;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
