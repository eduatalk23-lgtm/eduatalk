-- ============================================
-- Quick Plan Atomic RPCs
-- 빠른 플랜 생성 관련 트랜잭션 RPC 함수 3개
-- ============================================
-- 목표:
--   - quickCreateFromContent → quick_create_from_content_atomic
--   - createQuickPlan / createQuickPlanForStudent → create_quick_plan_atomic
--   - addContentToExistingPlanGroup → append_plans_to_group_atomic
-- ============================================

-- ============================================
-- RPC 1: quick_create_from_content_atomic
-- quickCreateFromContent()용
-- plan_groups + plan_contents + student_plan(학습) + student_plan(복습) 원자 생성
-- ============================================

CREATE OR REPLACE FUNCTION public.quick_create_from_content_atomic(
  p_plan_group jsonb,
  p_plan_content jsonb,
  p_study_plans jsonb,
  p_review_plans jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group_id UUID;
  v_plan JSONB;
  v_inserted_study INTEGER := 0;
  v_inserted_review INTEGER := 0;
BEGIN
  -- 1. plan_groups 생성
  INSERT INTO plan_groups (
    tenant_id,
    student_id,
    name,
    period_start,
    period_end,
    status,
    creation_mode,
    study_type,
    scheduler_options
  )
  VALUES (
    (p_plan_group->>'tenant_id')::UUID,
    (p_plan_group->>'student_id')::UUID,
    p_plan_group->>'name',
    (p_plan_group->>'period_start')::DATE,
    (p_plan_group->>'period_end')::DATE,
    COALESCE(p_plan_group->>'status', 'active'),
    COALESCE(p_plan_group->>'creation_mode', 'content_based'),
    p_plan_group->>'study_type',
    COALESCE(p_plan_group->'scheduler_options', '{}'::JSONB)
  )
  RETURNING id INTO v_group_id;

  -- 2. plan_contents 생성
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
    display_order
  )
  VALUES (
    v_group_id,
    (p_plan_content->>'tenant_id')::UUID,
    p_plan_content->>'content_type',
    (p_plan_content->>'content_id')::UUID,
    p_plan_content->>'content_name',
    COALESCE((p_plan_content->>'start_range')::NUMERIC, 0),
    COALESCE((p_plan_content->>'end_range')::NUMERIC, 0),
    p_plan_content->>'subject_name',
    p_plan_content->>'subject_category',
    COALESCE((p_plan_content->>'display_order')::INTEGER, 0)
  );

  -- 3. 학습 student_plan 생성
  FOR v_plan IN SELECT * FROM jsonb_array_elements(p_study_plans)
  LOOP
    INSERT INTO student_plan (
      id,
      tenant_id,
      student_id,
      plan_group_id,
      plan_date,
      block_index,
      content_type,
      content_id,
      content_title,
      content_subject,
      content_subject_category,
      planned_start_page_or_time,
      planned_end_page_or_time,
      status,
      container_type,
      subject_type,
      is_active,
      sequence
    )
    VALUES (
      COALESCE((v_plan->>'id')::UUID, gen_random_uuid()),
      (v_plan->>'tenant_id')::UUID,
      (v_plan->>'student_id')::UUID,
      v_group_id,
      (v_plan->>'plan_date')::DATE,
      COALESCE((v_plan->>'block_index')::INTEGER, 0),
      v_plan->>'content_type',
      (v_plan->>'content_id')::UUID,
      v_plan->>'content_title',
      v_plan->>'content_subject',
      v_plan->>'content_subject_category',
      (v_plan->>'planned_start_page_or_time')::NUMERIC,
      (v_plan->>'planned_end_page_or_time')::NUMERIC,
      COALESCE(v_plan->>'status', 'pending'),
      COALESCE(v_plan->>'container_type', 'daily'),
      v_plan->>'subject_type',
      COALESCE((v_plan->>'is_active')::BOOLEAN, true),
      COALESCE((v_plan->>'sequence')::INTEGER, 1)
    );
    v_inserted_study := v_inserted_study + 1;
  END LOOP;

  -- 4. 복습 student_plan 생성 (선택적)
  IF p_review_plans IS NOT NULL AND jsonb_array_length(p_review_plans) > 0 THEN
    FOR v_plan IN SELECT * FROM jsonb_array_elements(p_review_plans)
    LOOP
      INSERT INTO student_plan (
        id,
        tenant_id,
        student_id,
        plan_group_id,
        plan_date,
        block_index,
        content_type,
        content_id,
        content_title,
        content_subject,
        content_subject_category,
        planned_start_page_or_time,
        planned_end_page_or_time,
        status,
        container_type,
        subject_type,
        is_active,
        sequence
      )
      VALUES (
        COALESCE((v_plan->>'id')::UUID, gen_random_uuid()),
        (v_plan->>'tenant_id')::UUID,
        (v_plan->>'student_id')::UUID,
        v_group_id,
        (v_plan->>'plan_date')::DATE,
        COALESCE((v_plan->>'block_index')::INTEGER, 0),
        v_plan->>'content_type',
        (v_plan->>'content_id')::UUID,
        v_plan->>'content_title',
        v_plan->>'content_subject',
        v_plan->>'content_subject_category',
        (v_plan->>'planned_start_page_or_time')::NUMERIC,
        (v_plan->>'planned_end_page_or_time')::NUMERIC,
        COALESCE(v_plan->>'status', 'pending'),
        COALESCE(v_plan->>'container_type', 'daily'),
        COALESCE(v_plan->>'subject_type', 'review'),
        COALESCE((v_plan->>'is_active')::BOOLEAN, true),
        COALESCE((v_plan->>'sequence')::INTEGER, 1)
      );
      v_inserted_review := v_inserted_review + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group_id,
    'study_count', v_inserted_study,
    'review_count', v_inserted_review
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

COMMENT ON FUNCTION public.quick_create_from_content_atomic IS
'quickCreateFromContent용 원자적 RPC. plan_groups + plan_contents + student_plan(학습+복습) 일괄 생성.';


-- ============================================
-- RPC 2: create_quick_plan_atomic
-- createQuickPlan() / createQuickPlanForStudent()용
-- (optional) flexible_contents + (optional) plan_groups + student_plan 원자 생성
-- ============================================

CREATE OR REPLACE FUNCTION public.create_quick_plan_atomic(
  p_flexible_content jsonb DEFAULT NULL,
  p_plan_group jsonb DEFAULT NULL,
  p_plan_group_id uuid DEFAULT NULL,
  p_student_plan jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_flexible_content_id UUID;
  v_plan_group_id UUID;
  v_plan_id UUID;
BEGIN
  -- 1. flexible_contents 생성 (자유 학습인 경우)
  IF p_flexible_content IS NOT NULL THEN
    INSERT INTO flexible_contents (
      tenant_id,
      student_id,
      content_type,
      title,
      item_type,
      estimated_minutes,
      subject
    )
    VALUES (
      (p_flexible_content->>'tenant_id')::UUID,
      (p_flexible_content->>'student_id')::UUID,
      COALESCE(p_flexible_content->>'content_type', 'free'),
      p_flexible_content->>'title',
      COALESCE(p_flexible_content->>'item_type', 'free'),
      COALESCE((p_flexible_content->>'estimated_minutes')::INTEGER, 30),
      p_flexible_content->>'subject'
    )
    RETURNING id INTO v_flexible_content_id;
  END IF;

  -- 2. plan_groups 생성 (새 그룹이 필요한 경우)
  IF p_plan_group IS NOT NULL THEN
    INSERT INTO plan_groups (
      student_id,
      tenant_id,
      name,
      plan_purpose,
      period_start,
      period_end,
      status,
      plan_mode,
      is_single_day,
      creation_mode,
      last_admin_id,
      admin_modified_at
    )
    VALUES (
      (p_plan_group->>'student_id')::UUID,
      (p_plan_group->>'tenant_id')::UUID,
      p_plan_group->>'name',
      p_plan_group->>'plan_purpose',
      (p_plan_group->>'period_start')::DATE,
      (p_plan_group->>'period_end')::DATE,
      COALESCE(p_plan_group->>'status', 'active'),
      p_plan_group->>'plan_mode',
      COALESCE((p_plan_group->>'is_single_day')::BOOLEAN, true),
      p_plan_group->>'creation_mode',
      NULLIF(p_plan_group->>'last_admin_id', '')::UUID,
      NULLIF(p_plan_group->>'admin_modified_at', '')::TIMESTAMPTZ
    )
    RETURNING id INTO v_plan_group_id;
  ELSIF p_plan_group_id IS NOT NULL THEN
    v_plan_group_id := p_plan_group_id;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'plan_group_id 또는 plan_group 데이터가 필요합니다.',
      'code', 'MISSING_GROUP'
    );
  END IF;

  -- 3. student_plan 생성
  INSERT INTO student_plan (
    student_id,
    tenant_id,
    plan_group_id,
    plan_date,
    block_index,
    content_type,
    content_id,
    content_title,
    container_type,
    status,
    is_virtual,
    is_adhoc,
    flexible_content_id,
    planned_start_page_or_time,
    planned_end_page_or_time,
    estimated_minutes,
    start_time,
    end_time,
    description,
    tags,
    color,
    icon,
    priority
  )
  VALUES (
    (p_student_plan->>'student_id')::UUID,
    (p_student_plan->>'tenant_id')::UUID,
    v_plan_group_id,
    (p_student_plan->>'plan_date')::DATE,
    COALESCE((p_student_plan->>'block_index')::INTEGER, 0),
    p_student_plan->>'content_type',
    NULLIF(p_student_plan->>'content_id', '')::UUID,
    p_student_plan->>'content_title',
    COALESCE(p_student_plan->>'container_type', 'daily'),
    COALESCE(p_student_plan->>'status', 'pending'),
    COALESCE((p_student_plan->>'is_virtual')::BOOLEAN, false),
    COALESCE((p_student_plan->>'is_adhoc')::BOOLEAN, true),
    COALESCE(v_flexible_content_id, NULLIF(p_student_plan->>'flexible_content_id', '')::UUID),
    (p_student_plan->>'planned_start_page_or_time')::NUMERIC,
    (p_student_plan->>'planned_end_page_or_time')::NUMERIC,
    COALESCE((p_student_plan->>'estimated_minutes')::INTEGER, 30),
    p_student_plan->>'start_time',
    p_student_plan->>'end_time',
    p_student_plan->>'description',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_student_plan->'tags')),
      '{}'::TEXT[]
    ),
    p_student_plan->>'color',
    p_student_plan->>'icon',
    COALESCE((p_student_plan->>'priority')::INTEGER, 0)
  )
  RETURNING id INTO v_plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'plan_group_id', v_plan_group_id,
    'plan_id', v_plan_id,
    'flexible_content_id', v_flexible_content_id
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

COMMENT ON FUNCTION public.create_quick_plan_atomic IS
'createQuickPlan/createQuickPlanForStudent용 원자적 RPC. flexible_contents + plan_groups + student_plan 일괄 생성.';


-- ============================================
-- RPC 3: append_plans_to_group_atomic
-- addContentToExistingPlanGroup()용
-- plan_contents + student_plan(학습+복습) 추가 + plan_groups 메타데이터 업데이트
-- 기존 데이터 삭제 없음
-- ============================================

CREATE OR REPLACE FUNCTION public.append_plans_to_group_atomic(
  p_plan_group_id uuid,
  p_plan_content jsonb,
  p_plans jsonb,
  p_group_update jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_content_id UUID;
  v_plan JSONB;
  v_inserted_count INTEGER := 0;
BEGIN
  -- 1. plan_contents 생성
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
    display_order
  )
  VALUES (
    p_plan_group_id,
    (p_plan_content->>'tenant_id')::UUID,
    p_plan_content->>'content_type',
    (p_plan_content->>'content_id')::UUID,
    p_plan_content->>'content_name',
    COALESCE((p_plan_content->>'start_range')::NUMERIC, 0),
    COALESCE((p_plan_content->>'end_range')::NUMERIC, 0),
    p_plan_content->>'subject_name',
    p_plan_content->>'subject_category',
    COALESCE((p_plan_content->>'display_order')::INTEGER, 0)
  )
  RETURNING id INTO v_content_id;

  -- 2. student_plan 일괄 삽입 (학습 + 복습)
  FOR v_plan IN SELECT * FROM jsonb_array_elements(p_plans)
  LOOP
    INSERT INTO student_plan (
      plan_group_id,
      tenant_id,
      student_id,
      plan_date,
      block_index,
      content_type,
      content_id,
      content_title,
      content_subject,
      content_subject_category,
      planned_start_page_or_time,
      planned_end_page_or_time,
      status,
      container_type,
      subject_type,
      day_type,
      review_group_id,
      review_source_content_ids,
      is_active
    )
    VALUES (
      p_plan_group_id,
      (v_plan->>'tenant_id')::UUID,
      (v_plan->>'student_id')::UUID,
      (v_plan->>'plan_date')::DATE,
      COALESCE((v_plan->>'block_index')::INTEGER, 0),
      v_plan->>'content_type',
      (v_plan->>'content_id')::UUID,
      v_plan->>'content_title',
      v_plan->>'content_subject',
      v_plan->>'content_subject_category',
      (v_plan->>'planned_start_page_or_time')::NUMERIC,
      (v_plan->>'planned_end_page_or_time')::NUMERIC,
      COALESCE(v_plan->>'status', 'pending'),
      COALESCE(v_plan->>'container_type', 'daily'),
      v_plan->>'subject_type',
      v_plan->>'day_type',
      NULLIF(v_plan->>'review_group_id', '')::UUID,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(v_plan->'review_source_content_ids')),
        '{}'::TEXT[]
      ),
      COALESCE((v_plan->>'is_active')::BOOLEAN, true)
    );
    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  -- 3. plan_groups 메타데이터 업데이트
  IF p_group_update IS NOT NULL AND p_group_update != '{}'::jsonb THEN
    UPDATE plan_groups
    SET
      is_calendar_only = COALESCE(
        (p_group_update->>'is_calendar_only')::BOOLEAN,
        is_calendar_only
      ),
      content_status = COALESCE(
        p_group_update->>'content_status',
        content_status
      ),
      status = COALESCE(
        p_group_update->>'status',
        status
      )
    WHERE id = p_plan_group_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'content_id', v_content_id,
    'inserted_count', v_inserted_count
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

COMMENT ON FUNCTION public.append_plans_to_group_atomic IS
'addContentToExistingPlanGroup용 원자적 RPC. plan_contents + student_plan 추가 + plan_groups 메타데이터 업데이트. 기존 데이터 보존.';
