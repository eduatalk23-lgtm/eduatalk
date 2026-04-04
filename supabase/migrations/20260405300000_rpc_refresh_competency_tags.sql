-- 역량 분석 태그 원자적 교체 RPC (Phase 1-3)
-- P1~P3 역량 분석: 기존 AI 태그 삭제 + 새 태그 삽입을 단일 트랜잭션으로.

CREATE OR REPLACE FUNCTION refresh_competency_tags(
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
  -- Advisory Lock: 같은 학생의 동시 역량 분석 차단
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_competency_tags')
  );

  -- 1. 해당 레코드의 기존 AI 태그 삭제 (analysis context만)
  IF array_length(p_record_ids, 1) IS NOT NULL THEN
    DELETE FROM student_record_activity_tags
    WHERE record_id = ANY(p_record_ids)
      AND tenant_id = p_tenant_id
      AND source = 'ai'
      AND (tag_context = 'analysis' OR tag_context IS NULL);
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
      COALESCE(t->>'tag_context', 'analysis')
    FROM jsonb_array_elements(p_new_tags) AS t;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;
