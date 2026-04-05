-- 스토리라인 원자적 삭제/생성 RPC (S1 storyline_generation)
-- 부분 실패 시 고아 레코드(링크 없는 스토리라인) 방지를 위한 트랜잭션 보장.

-- ============================================================
-- A. delete_ai_storylines_by_student
--    AI가 생성한 스토리라인([AI] 접두사) + 연관 링크를 트랜잭션으로 일괄 삭제.
--    storyline_links는 ON DELETE CASCADE로 자동 삭제됨.
--    RETURNS integer: 삭제된 스토리라인 수
-- ============================================================
CREATE OR REPLACE FUNCTION delete_ai_storylines_by_student(
  p_student_id uuid,
  p_tenant_id  uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Advisory Lock: 같은 학생의 동시 스토리라인 재생성 차단
  PERFORM pg_advisory_xact_lock(
    hashtext(p_student_id::text || '_storylines')
  );

  DELETE FROM student_record_storylines
  WHERE student_id = p_student_id
    AND tenant_id  = p_tenant_id
    AND title LIKE '[AI]%';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- B. create_ai_storyline_with_links
--    스토리라인 1건 삽입 + 링크 N건 삽입을 하나의 트랜잭션으로.
--    RETURNS uuid: 생성된 스토리라인 ID
-- ============================================================
CREATE OR REPLACE FUNCTION create_ai_storyline_with_links(
  p_tenant_id   uuid,
  p_student_id  uuid,
  p_storyline   jsonb,
  p_links       jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_storyline_id uuid;
BEGIN
  -- 스토리라인 삽입
  INSERT INTO student_record_storylines (
    tenant_id,
    student_id,
    title,
    keywords,
    narrative,
    career_field,
    grade_1_theme,
    grade_2_theme,
    grade_3_theme,
    strength,
    sort_order
  ) VALUES (
    p_tenant_id,
    p_student_id,
    (p_storyline->>'title'),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_storyline->'keywords')),
      '{}'::text[]
    ),
    (p_storyline->>'narrative'),
    (p_storyline->>'career_field'),
    (p_storyline->>'grade_1_theme'),
    (p_storyline->>'grade_2_theme'),
    (p_storyline->>'grade_3_theme'),
    COALESCE((p_storyline->>'strength'), 'moderate'),
    COALESCE((p_storyline->>'sort_order')::integer, 0)
  )
  RETURNING id INTO v_storyline_id;

  -- 링크 N건 삽입
  IF jsonb_array_length(p_links) > 0 THEN
    INSERT INTO student_record_storyline_links (
      storyline_id,
      record_type,
      record_id,
      grade,
      connection_note,
      sort_order
    )
    SELECT
      v_storyline_id,
      (lnk->>'record_type'),
      (lnk->>'record_id')::uuid,
      (lnk->>'grade')::integer,
      (lnk->>'connection_note'),
      COALESCE((lnk->>'sort_order')::integer, 0)
    FROM jsonb_array_elements(p_links) AS lnk;
  END IF;

  RETURN v_storyline_id;
END;
$$;
