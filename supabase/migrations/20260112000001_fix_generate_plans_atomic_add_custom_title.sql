-- =====================================================
-- generate_plans_atomic RPC 함수 수정
-- custom_title, content_category, plan_number, is_reschedulable 추가
-- =====================================================

CREATE OR REPLACE FUNCTION generate_plans_atomic(
  p_group_id UUID,
  p_plans JSONB,
  p_update_status_to TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan jsonb;
  v_inserted_count integer := 0;
  v_deleted_count integer;
  v_now timestamptz := now();
  v_content_id_text text;
BEGIN
  DELETE FROM public.student_plan
  WHERE plan_group_id = p_group_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF p_plans IS NOT NULL AND jsonb_array_length(p_plans) > 0 THEN
    FOR v_plan IN SELECT * FROM jsonb_array_elements(p_plans)
    LOOP
      v_content_id_text := v_plan->>'content_id';

      INSERT INTO public.student_plan (
        plan_group_id, student_id, tenant_id, plan_date, block_index,
        status, content_type, content_id,
        planned_start_page_or_time, planned_end_page_or_time,
        chapter, start_time, end_time, day_type, week, day,
        is_partial, is_continued, content_title, custom_title, content_subject,
        content_subject_category, content_category, sequence, plan_number, is_reschedulable,
        is_virtual, slot_index, virtual_subject_category, virtual_description,
        created_at, updated_at
      ) VALUES (
        (v_plan->>'plan_group_id')::uuid,
        (v_plan->>'student_id')::uuid,
        (v_plan->>'tenant_id')::uuid,
        (v_plan->>'plan_date')::date,
        (v_plan->>'block_index')::integer,
        COALESCE(v_plan->>'status', 'pending'),
        v_plan->>'content_type',
        CASE WHEN v_content_id_text IS NOT NULL AND v_content_id_text != ''
             THEN v_content_id_text::uuid
             ELSE NULL
        END,
        (v_plan->>'planned_start_page_or_time')::numeric,
        (v_plan->>'planned_end_page_or_time')::numeric,
        v_plan->>'chapter',
        (v_plan->>'start_time')::time,
        (v_plan->>'end_time')::time,
        v_plan->>'day_type',
        (v_plan->>'week')::integer,
        (v_plan->>'day')::integer,
        COALESCE((v_plan->>'is_partial')::boolean, false),
        COALESCE((v_plan->>'is_continued')::boolean, false),
        v_plan->>'content_title',
        v_plan->>'custom_title',
        v_plan->>'content_subject',
        v_plan->>'content_subject_category',
        v_plan->>'content_category',
        (v_plan->>'sequence')::integer,
        (v_plan->>'plan_number')::integer,
        COALESCE((v_plan->>'is_reschedulable')::boolean, true),
        COALESCE((v_plan->>'is_virtual')::boolean, false),
        (v_plan->>'slot_index')::integer,
        v_plan->>'virtual_subject_category',
        v_plan->>'virtual_description',
        v_now, v_now
      );

      v_inserted_count := v_inserted_count + 1;
    END LOOP;
  END IF;

  IF p_update_status_to IS NOT NULL THEN
    UPDATE public.plan_groups
    SET status = p_update_status_to, updated_at = v_now
    WHERE id = p_group_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'inserted_count', v_inserted_count
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE
  );
END;
$$;

-- 코멘트 업데이트
COMMENT ON FUNCTION generate_plans_atomic IS '플랜을 원자적으로 생성합니다. custom_title, content_category 등 추가 필드 포함.';
