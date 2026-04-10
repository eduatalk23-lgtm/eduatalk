-- ============================================================
-- Fix: create_ai_storyline_with_links RPC 가 storyline_links 삽입 시
--      tenant_id 를 채우지 않아 NOT NULL 제약(23502) 위반
--
-- 타임라인:
--   2026-04-05 20260405600000_storyline_atomic_ops.sql — RPC 최초 생성
--                (당시 storyline_links 에 tenant_id 없음)
--   2026-04-08 20260408100000_link_tables_tenant_id.sql — tenant_id 컬럼 추가 + NOT NULL
--                (RPC 는 미수정 → 이 시점 이후 AI 스토리라인 저장이 전부 실패)
--
-- 결과: phase-s1-storyline 이 LLM 으로부터 스토리라인 제안을 받아도
--       createAiStorylineWithLinks 호출이 try/catch 안에서 조용히 실패해
--       savedCount=0 이 되고, 리포트 스토리라인 섹션이 비어 보임.
--
-- 수정 내용: 함수 인자로 이미 받고 있는 p_tenant_id 를 링크 INSERT 에도 포함.
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

  -- 링크 N건 삽입 (tenant_id 포함 — 2026-04-08 NOT NULL 추가 대응)
  IF jsonb_array_length(p_links) > 0 THEN
    INSERT INTO student_record_storyline_links (
      tenant_id,
      storyline_id,
      record_type,
      record_id,
      grade,
      connection_note,
      sort_order
    )
    SELECT
      p_tenant_id,
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
