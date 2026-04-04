-- 가안 분석 태그 원자적 교��� RPC (Phase 1-2)
-- P8 draft_analysis 태그: 기존 삭제 + 새 태그 삽입을 단일 트랜잭션으로.

CREATE OR REPLACE FUNCTION replace_draft_analysis_tags(
  p_student_id uuid,
  p_tenant_id uuid,
  p_record_ids uuid[],
  p_new_tags jsonb DEFAULT '[]'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  -- Advisory Lock: 같은 학생의 동시 P8 실행 차단
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_draft_analysis')
  );

  -- 1. 해당 레코드의 기존 draft_analysis AI 태그 삭제
  IF array_length(p_record_ids, 1) IS NOT NULL THEN
    DELETE FROM student_record_activity_tags
    WHERE record_id = ANY(p_record_ids)
      AND tag_context = 'draft_analysis'
      AND source = 'ai';
  END IF;

  -- 2. 새 태그 삽입
  IF jsonb_array_length(p_new_tags) > 0 THEN
    INSERT INTO student_record_activity_tags (
      tenant_id, student_id, record_type, record_id,
      competency_item, evaluation, evidence_summary,
      source, status, tag_context
    )
    SELECT
      p_tenant_id,
      p_student_id,
      (t->>'record_type'),
      (t->>'record_id')::uuid,
      (t->>'competency_item'),
      (t->>'evaluation'),
      COALESCE(t->>'evidence_summary', ''),
      'ai',
      'suggested',
      'draft_analysis'
    FROM jsonb_array_elements(p_new_tags) AS t;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;
