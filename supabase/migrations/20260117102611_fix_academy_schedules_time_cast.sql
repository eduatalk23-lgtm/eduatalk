-- Fix TIME type casting in create_plan_group_atomic RPC function
-- The start_time and end_time fields were being inserted as TEXT instead of TIME
-- This caused error: "column start_time is of type time without time zone but expression is of type text"

CREATE OR REPLACE FUNCTION public.create_plan_group_atomic(
  p_tenant_id uuid,
  p_student_id uuid,
  p_plan_group jsonb,
  p_contents jsonb DEFAULT '[]'::jsonb,
  p_exclusions jsonb DEFAULT '[]'::jsonb,
  p_schedules jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group_id UUID;
  v_content JSONB;
  v_exclusion JSONB;
  v_schedule JSONB;
BEGIN
  -- 1. plan_groups 생성
  INSERT INTO plan_groups (
    tenant_id,
    student_id,
    name,
    plan_purpose,
    scheduler_type,
    scheduler_options,
    period_start,
    period_end,
    target_date,
    block_set_id,
    status,
    subject_constraints,
    additional_period_reallocation,
    non_study_time_blocks,
    daily_schedule,
    plan_type,
    camp_template_id,
    camp_invitation_id,
    use_slot_mode,
    content_slots,
    planner_id,
    creation_mode,
    plan_mode,
    is_single_day,
    study_type,
    strategy_days_per_week
  )
  VALUES (
    p_tenant_id,
    p_student_id,
    p_plan_group->>'name',
    p_plan_group->>'plan_purpose',
    p_plan_group->>'scheduler_type',
    COALESCE(p_plan_group->'scheduler_options', '{}'::JSONB),
    (p_plan_group->>'period_start')::DATE,
    (p_plan_group->>'period_end')::DATE,
    NULLIF(p_plan_group->>'target_date', '')::DATE,
    NULLIF(p_plan_group->>'block_set_id', '')::UUID,
    COALESCE(p_plan_group->>'status', 'active'),
    p_plan_group->'subject_constraints',
    p_plan_group->'additional_period_reallocation',
    p_plan_group->'non_study_time_blocks',
    p_plan_group->'daily_schedule',
    p_plan_group->>'plan_type',
    NULLIF(p_plan_group->>'camp_template_id', '')::UUID,
    NULLIF(p_plan_group->>'camp_invitation_id', '')::UUID,
    COALESCE((p_plan_group->>'use_slot_mode')::BOOLEAN, false),
    p_plan_group->'content_slots',
    NULLIF(p_plan_group->>'planner_id', '')::UUID,
    p_plan_group->>'creation_mode',
    p_plan_group->>'plan_mode',
    COALESCE((p_plan_group->>'is_single_day')::BOOLEAN, false),
    p_plan_group->>'study_type',
    (p_plan_group->>'strategy_days_per_week')::INTEGER
  )
  RETURNING id INTO v_group_id;

  -- 2. plan_contents 생성 (선택적)
  IF p_contents IS NOT NULL AND jsonb_array_length(p_contents) > 0 THEN
    INSERT INTO plan_contents (
      plan_group_id,
      tenant_id,
      content_type,
      content_id,
      start_range,
      end_range,
      display_order,
      master_content_id,
      content_name,
      subject_name,
      subject_category,
      start_detail_id,
      end_detail_id,
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
      v_group_id,
      p_tenant_id,
      (content->>'content_type')::VARCHAR,
      (content->>'content_id')::UUID,
      COALESCE((content->>'start_range')::NUMERIC, 0),
      COALESCE((content->>'end_range')::NUMERIC, 0),
      COALESCE((content->>'display_order')::INTEGER, 0),
      (content->>'master_content_id')::UUID,
      content->>'content_name',
      content->>'subject_name',
      content->>'subject_category',
      (content->>'start_detail_id')::UUID,
      (content->>'end_detail_id')::UUID,
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
  END IF;

  -- 3. plan_exclusions 생성 (선택적)
  IF p_exclusions IS NOT NULL AND jsonb_array_length(p_exclusions) > 0 THEN
    FOR v_exclusion IN SELECT * FROM jsonb_array_elements(p_exclusions)
    LOOP
      INSERT INTO plan_exclusions (
        tenant_id,
        student_id,
        plan_group_id,
        exclusion_date,
        exclusion_type,
        reason
      )
      VALUES (
        p_tenant_id,
        p_student_id,
        v_group_id,
        (v_exclusion->>'exclusion_date')::DATE,
        v_exclusion->>'exclusion_type',
        v_exclusion->>'reason'
      );
    END LOOP;
  END IF;

  -- 4. academy_schedules 생성 (선택적)
  -- FIX: Added ::TIME cast for start_time and end_time
  IF p_schedules IS NOT NULL AND jsonb_array_length(p_schedules) > 0 THEN
    FOR v_schedule IN SELECT * FROM jsonb_array_elements(p_schedules)
    LOOP
      INSERT INTO academy_schedules (
        tenant_id,
        student_id,
        plan_group_id,
        day_of_week,
        start_time,
        end_time,
        academy_name,
        academy_id,
        subject,
        travel_time,
        source,
        is_locked
      )
      VALUES (
        p_tenant_id,
        p_student_id,
        v_group_id,
        (v_schedule->>'day_of_week')::INTEGER,
        (v_schedule->>'start_time')::TIME,   -- FIX: Added ::TIME cast
        (v_schedule->>'end_time')::TIME,     -- FIX: Added ::TIME cast
        v_schedule->>'academy_name',
        COALESCE(NULLIF(v_schedule->>'academy_id', '')::UUID, gen_random_uuid()),
        v_schedule->>'subject',
        (v_schedule->>'travel_time')::INTEGER,
        COALESCE(v_schedule->>'source', 'inherited'),
        COALESCE((v_schedule->>'is_locked')::BOOLEAN, false)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$function$;
