-- =====================================================
-- Plan Group RPC Transaction Functions
-- 플랜 그룹 CRUD를 위한 트랜잭션 함수들
-- =====================================================

-- 1. 플랜 그룹 삭제 트랜잭션 함수
-- 관련 데이터를 원자적으로 삭제하여 FK 위반 방지
CREATE OR REPLACE FUNCTION delete_plan_group_cascade(
  p_group_id UUID,
  p_student_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_plans INTEGER;
  v_deleted_contents INTEGER;
  v_deleted_exclusions INTEGER;
  v_deleted_schedules INTEGER;
BEGIN
  -- 1. student_plan 삭제 (hard delete)
  DELETE FROM student_plan
  WHERE plan_group_id = p_group_id
    AND student_id = p_student_id;
  GET DIAGNOSTICS v_deleted_plans = ROW_COUNT;

  -- 2. plan_contents 삭제
  DELETE FROM plan_contents
  WHERE plan_group_id = p_group_id;
  GET DIAGNOSTICS v_deleted_contents = ROW_COUNT;

  -- 3. plan_exclusions 삭제
  DELETE FROM plan_exclusions
  WHERE plan_group_id = p_group_id;
  GET DIAGNOSTICS v_deleted_exclusions = ROW_COUNT;

  -- 4. academy_schedules 삭제 (plan_group_id 기준)
  DELETE FROM academy_schedules
  WHERE plan_group_id = p_group_id;
  GET DIAGNOSTICS v_deleted_schedules = ROW_COUNT;

  -- 5. plan_group_items 삭제 (V2 모델)
  DELETE FROM plan_group_items
  WHERE plan_group_id = p_group_id;

  -- 6. plan_groups soft delete
  UPDATE plan_groups
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_group_id
    AND student_id = p_student_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plan group not found or already deleted',
      'code', 'NOT_FOUND'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_plans', v_deleted_plans,
    'deleted_contents', v_deleted_contents,
    'deleted_exclusions', v_deleted_exclusions,
    'deleted_schedules', v_deleted_schedules
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- 2. 콘텐츠 추가 트랜잭션 함수 (Calendar-Only 플랜그룹에)
CREATE OR REPLACE FUNCTION add_content_to_plan_group_atomic(
  p_plan_group_id UUID,
  p_tenant_id UUID,
  p_content JSONB,
  p_plans JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_id UUID;
  v_plans_inserted INTEGER;
BEGIN
  -- 1. plan_contents 생성
  INSERT INTO plan_contents (
    plan_group_id,
    tenant_id,
    content_type,
    content_id,
    content_name,
    start_page_or_time,
    end_page_or_time,
    subject_name,
    subject_category
  )
  VALUES (
    p_plan_group_id,
    p_tenant_id,
    p_content->>'content_type',
    (p_content->>'content_id')::UUID,
    p_content->>'content_name',
    (p_content->>'start_page_or_time')::INTEGER,
    (p_content->>'end_page_or_time')::INTEGER,
    p_content->>'subject_name',
    p_content->>'subject_category'
  )
  RETURNING id INTO v_content_id;

  -- 2. student_plan 다중 생성
  INSERT INTO student_plan (
    id,
    tenant_id,
    student_id,
    plan_group_id,
    plan_date,
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
    is_active
  )
  SELECT
    COALESCE((plan->>'id')::UUID, gen_random_uuid()),
    p_tenant_id,
    (plan->>'student_id')::UUID,
    p_plan_group_id,
    (plan->>'plan_date')::DATE,
    plan->>'content_type',
    (plan->>'content_id')::UUID,
    plan->>'content_title',
    plan->>'content_subject',
    plan->>'content_subject_category',
    (plan->>'planned_start_page_or_time')::INTEGER,
    (plan->>'planned_end_page_or_time')::INTEGER,
    COALESCE(plan->>'status', 'pending'),
    COALESCE(plan->>'container_type', 'daily'),
    plan->>'subject_type',
    COALESCE((plan->>'is_active')::BOOLEAN, true)
  FROM jsonb_array_elements(p_plans) AS plan;

  GET DIAGNOSTICS v_plans_inserted = ROW_COUNT;

  -- 3. plan_groups 업데이트
  UPDATE plan_groups
  SET is_calendar_only = false,
      content_status = 'complete',
      updated_at = NOW()
  WHERE id = p_plan_group_id;

  RETURN jsonb_build_object(
    'success', true,
    'content_id', v_content_id,
    'plans_inserted', v_plans_inserted
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- 3. 빠른 플랜 생성 트랜잭션 함수
CREATE OR REPLACE FUNCTION create_quick_plan_atomic(
  p_plan_group JSONB,
  p_plan_content JSONB,
  p_student_plans JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID;
  v_content_id UUID;
  v_plans_inserted INTEGER;
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
    scheduler_options,
    plan_mode,
    is_single_day
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
    COALESCE(p_plan_group->'scheduler_options', '{}'::JSONB),
    p_plan_group->>'plan_mode',
    COALESCE((p_plan_group->>'is_single_day')::BOOLEAN, false)
  )
  RETURNING id INTO v_group_id;

  -- 2. plan_contents 생성 (선택적)
  IF p_plan_content IS NOT NULL AND p_plan_content != 'null'::JSONB THEN
    INSERT INTO plan_contents (
      plan_group_id,
      tenant_id,
      content_type,
      content_id,
      content_name,
      start_page_or_time,
      end_page_or_time,
      subject_name,
      subject_category
    )
    VALUES (
      v_group_id,
      (p_plan_group->>'tenant_id')::UUID,
      p_plan_content->>'content_type',
      (p_plan_content->>'content_id')::UUID,
      p_plan_content->>'content_name',
      (p_plan_content->>'start_page_or_time')::INTEGER,
      (p_plan_content->>'end_page_or_time')::INTEGER,
      p_plan_content->>'subject_name',
      p_plan_content->>'subject_category'
    )
    RETURNING id INTO v_content_id;
  END IF;

  -- 3. student_plan 다중 생성
  INSERT INTO student_plan (
    id,
    tenant_id,
    student_id,
    plan_group_id,
    plan_date,
    title,
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
    estimated_minutes,
    is_virtual
  )
  SELECT
    COALESCE((plan->>'id')::UUID, gen_random_uuid()),
    (p_plan_group->>'tenant_id')::UUID,
    (p_plan_group->>'student_id')::UUID,
    v_group_id,
    (plan->>'plan_date')::DATE,
    plan->>'title',
    plan->>'content_type',
    NULLIF(plan->>'content_id', '')::UUID,
    plan->>'content_title',
    plan->>'content_subject',
    plan->>'content_subject_category',
    (plan->>'planned_start_page_or_time')::INTEGER,
    (plan->>'planned_end_page_or_time')::INTEGER,
    COALESCE(plan->>'status', 'pending'),
    COALESCE(plan->>'container_type', 'daily'),
    plan->>'subject_type',
    COALESCE((plan->>'is_active')::BOOLEAN, true),
    (plan->>'estimated_minutes')::INTEGER,
    COALESCE((plan->>'is_virtual')::BOOLEAN, false)
  FROM jsonb_array_elements(p_student_plans) AS plan;

  GET DIAGNOSTICS v_plans_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group_id,
    'content_id', v_content_id,
    'plans_inserted', v_plans_inserted
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- 4. 콘텐츠 존재 확인 함수
CREATE OR REPLACE FUNCTION check_content_exists(
  p_content_id UUID,
  p_content_type TEXT,
  p_student_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN := false;
  v_table_name TEXT;
  v_master_table_name TEXT;
BEGIN
  -- 테이블 결정
  IF p_content_type = 'book' THEN
    v_table_name := 'books';
    v_master_table_name := 'master_books';
  ELSIF p_content_type = 'lecture' THEN
    v_table_name := 'lectures';
    v_master_table_name := 'master_lectures';
  ELSIF p_content_type = 'custom' THEN
    v_table_name := 'custom_contents';
    v_master_table_name := NULL;
  ELSE
    RETURN jsonb_build_object(
      'exists', false,
      'error', 'Invalid content type'
    );
  END IF;

  -- 학생 콘텐츠 테이블에서 확인
  EXECUTE format(
    'SELECT EXISTS(SELECT 1 FROM %I WHERE id = $1 %s)',
    v_table_name,
    CASE WHEN p_student_id IS NOT NULL THEN 'AND student_id = $2' ELSE '' END
  )
  INTO v_exists
  USING p_content_id, p_student_id;

  IF v_exists THEN
    RETURN jsonb_build_object('exists', true, 'source', 'student');
  END IF;

  -- 마스터 테이블에서 확인 (custom 제외)
  IF v_master_table_name IS NOT NULL THEN
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM %I WHERE id = $1)',
      v_master_table_name
    )
    INTO v_exists
    USING p_content_id;

    IF v_exists THEN
      RETURN jsonb_build_object('exists', true, 'source', 'master');
    END IF;
  END IF;

  RETURN jsonb_build_object('exists', false);
END;
$$;

-- RLS 정책 추가 (SECURITY DEFINER 함수는 RLS 우회)
-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION delete_plan_group_cascade(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_content_to_plan_group_atomic(UUID, UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_quick_plan_atomic(JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION check_content_exists(UUID, TEXT, UUID) TO authenticated;

-- 코멘트 추가
COMMENT ON FUNCTION delete_plan_group_cascade IS '플랜 그룹과 관련 데이터를 원자적으로 삭제합니다. 롤백 안전성을 보장합니다.';
COMMENT ON FUNCTION add_content_to_plan_group_atomic IS 'Calendar-Only 플랜 그룹에 콘텐츠를 원자적으로 추가합니다.';
COMMENT ON FUNCTION create_quick_plan_atomic IS '빠른 플랜 생성을 원자적으로 처리합니다.';
COMMENT ON FUNCTION check_content_exists IS '콘텐츠 존재 여부를 확인합니다 (학생 콘텐츠 또는 마스터 콘텐츠).';
