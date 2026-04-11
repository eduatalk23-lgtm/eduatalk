-- Phase 0: 증거 체인 — RPC refresh_competency_tags 갱신
-- section_type, highlight_phrase 컬럼을 INSERT에 추가.
-- 기존 호출자가 이 키를 보내지 않으면 NULL로 삽입 (->>'missing_key' = NULL).

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

  -- 2. 새 태그 삽입 (section_type, highlight_phrase 추가)
  IF jsonb_array_length(p_new_tags) > 0 THEN
    INSERT INTO student_record_activity_tags (
      tenant_id, student_id, record_type, record_id,
      competency_item, evaluation, evidence_summary,
      source, status, tag_context,
      section_type, highlight_phrase
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
      COALESCE(t->>'tag_context', 'analysis'),
      t->>'section_type',
      t->>'highlight_phrase'
    FROM jsonb_array_elements(p_new_tags) AS t;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;
