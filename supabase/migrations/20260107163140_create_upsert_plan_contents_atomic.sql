-- =====================================================
-- Upsert Plan Contents Atomic Transaction Function
-- plan_contents의 DELETE → INSERT를 원자적으로 처리
-- Phase 1.1: DELETE → INSERT 패턴을 UPSERT로 전환
-- =====================================================

CREATE OR REPLACE FUNCTION upsert_plan_contents_atomic(
  p_group_id UUID,
  p_tenant_id UUID,
  p_contents JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
  v_inserted_count INTEGER;
  v_content_record JSONB;
BEGIN
  -- 1. 기존 plan_contents 삭제 (트랜잭션 내에서)
  DELETE FROM plan_contents
  WHERE plan_group_id = p_group_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 2. 새 plan_contents 삽입 (배치)
  IF p_contents IS NOT NULL AND jsonb_array_length(p_contents) > 0 THEN
    INSERT INTO plan_contents (
      plan_group_id,
      tenant_id,
      content_type,
      content_id,
      content_name,
      start_range,
      end_range,
      subject_name,
      subject_category,
      display_order,
      start_detail_id,
      end_detail_id,
      master_content_id,
      priority,
      is_paused,
      paused_until,
      scheduler_mode,
      individual_schedule,
      custom_study_days,
      content_scheduler_options,
      is_auto_recommended,
      recommendation_source,
      recommendation_reason,
      recommendation_metadata,
      recommended_by,
      recommended_at,
      generation_status
    )
    SELECT
      p_group_id,
      p_tenant_id,
      (content->>'content_type')::VARCHAR,
      (content->>'content_id')::UUID,
      content->>'content_name',
      COALESCE((content->>'start_range')::NUMERIC, (content->>'start_page_or_time')::NUMERIC),
      COALESCE((content->>'end_range')::NUMERIC, (content->>'end_page_or_time')::NUMERIC),
      content->>'subject_name',
      content->>'subject_category',
      COALESCE((content->>'display_order')::INTEGER, 0),
      (content->>'start_detail_id')::UUID,
      (content->>'end_detail_id')::UUID,
      (content->>'master_content_id')::UUID,
      content->>'priority',
      COALESCE((content->>'is_paused')::BOOLEAN, false),
      (content->>'paused_until')::TIMESTAMPTZ,
      content->>'scheduler_mode',
      content->'individual_schedule',
      (content->>'custom_study_days')::INTEGER[],
      content->'content_scheduler_options',
      COALESCE((content->>'is_auto_recommended')::BOOLEAN, false),
      content->>'recommendation_source',
      content->>'recommendation_reason',
      content->'recommendation_metadata',
      (content->>'recommended_by')::UUID,
      (content->>'recommended_at')::TIMESTAMPTZ,
      content->>'generation_status'
    FROM jsonb_array_elements(p_contents) AS content;
    
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  ELSE
    v_inserted_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'inserted_count', v_inserted_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE,
      'deleted_count', v_deleted_count,
      'inserted_count', v_inserted_count
    );
END;
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION upsert_plan_contents_atomic IS 
'플랜 그룹의 plan_contents를 원자적으로 교체합니다. 
기존 데이터를 삭제한 후 새 데이터를 삽입하는 작업이 하나의 트랜잭션으로 처리되어 
DELETE 성공 후 INSERT 실패 시 자동 롤백됩니다.';

