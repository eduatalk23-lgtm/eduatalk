-- replace_student_record_edges RPC 버그 수정
--
-- 문제: source_record_id / target_record_id 컬럼은 uuid 타입인데
--       기존 RPC는 `e->>'...'` (jsonb operator)로 text를 그대로 INSERT하여
--       "column source_record_id is of type uuid but expression is of type text" (SQLSTATE 42804) 에러 발생.
--
-- 수정: 양쪽 모두 명시적 `::uuid` 캐스트 추가.
--       target_record_id는 null 허용 — NULLIF로 빈 문자열 방어.

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
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_edges_' || p_edge_context)
  );

  DELETE FROM student_record_edges
  WHERE student_id = p_student_id
    AND tenant_id = p_tenant_id
    AND edge_context = p_edge_context;

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
      (e->>'source_record_id')::uuid,
      COALESCE(e->>'source_label', ''),
      (e->>'source_grade')::int,
      (e->>'target_record_type'),
      NULLIF(e->>'target_record_id', '')::uuid,
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
