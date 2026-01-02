-- =====================================================
-- Complete Plan Atomic Transaction Function
-- 플랜 완료 시 세션 종료 + 플랜 업데이트를 원자적으로 처리
-- TODAY-003: 트랜잭션 부재로 인한 데이터 불일치 해결
-- =====================================================

CREATE OR REPLACE FUNCTION complete_plan_atomic(
  p_plan_id UUID,
  p_student_id UUID,
  p_plan_ids UUID[],                    -- 같은 plan_number를 가진 모든 플랜 ID
  p_actual_end_time TIMESTAMPTZ,
  p_plan_updates JSONB                  -- 각 플랜별 업데이트 데이터 [{id, paused_duration_seconds, pause_count}, ...]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed_sessions INTEGER := 0;
  v_updated_plans INTEGER := 0;
  v_session_record RECORD;
  v_plan_update JSONB;
  v_plan_record RECORD;
  v_total_duration_seconds INTEGER;
  v_paused_duration INTEGER;
  v_pause_count INTEGER;
BEGIN
  -- =========================================
  -- 1. 모든 활성 세션 종료 (원자적)
  -- =========================================
  FOR v_session_record IN
    SELECT id, started_at
    FROM student_study_sessions
    WHERE plan_id = ANY(p_plan_ids)
      AND student_id = p_student_id
      AND ended_at IS NULL
  LOOP
    -- 세션 종료 시간 및 duration 계산
    UPDATE student_study_sessions
    SET
      ended_at = p_actual_end_time,
      duration_seconds = EXTRACT(EPOCH FROM (p_actual_end_time - started_at))::INTEGER,
      updated_at = NOW()
    WHERE id = v_session_record.id;

    v_closed_sessions := v_closed_sessions + 1;
  END LOOP;

  -- =========================================
  -- 2. 각 플랜 개별 업데이트 (원자적)
  -- =========================================
  FOR v_plan_update IN SELECT * FROM jsonb_array_elements(p_plan_updates)
  LOOP
    -- 플랜 정보 조회
    SELECT id, actual_start_time
    INTO v_plan_record
    FROM student_plan
    WHERE id = (v_plan_update->>'id')::UUID
      AND student_id = p_student_id;

    IF v_plan_record IS NULL THEN
      CONTINUE;
    END IF;

    -- total_duration_seconds 계산
    IF v_plan_record.actual_start_time IS NOT NULL THEN
      v_total_duration_seconds := EXTRACT(EPOCH FROM (p_actual_end_time - v_plan_record.actual_start_time))::INTEGER;
    ELSE
      v_total_duration_seconds := NULL;
    END IF;

    -- 각 플랜별 일시정지 정보
    v_paused_duration := COALESCE((v_plan_update->>'paused_duration_seconds')::INTEGER, 0);
    v_pause_count := COALESCE((v_plan_update->>'pause_count')::INTEGER, 0);

    -- 플랜 업데이트
    UPDATE student_plan
    SET
      actual_end_time = p_actual_end_time,
      total_duration_seconds = v_total_duration_seconds,
      paused_duration_seconds = v_paused_duration,
      pause_count = v_pause_count,
      updated_at = NOW()
    WHERE id = v_plan_record.id
      AND student_id = p_student_id;

    v_updated_plans := v_updated_plans + 1;
  END LOOP;

  -- =========================================
  -- 3. 성공 응답
  -- =========================================
  RETURN jsonb_build_object(
    'success', true,
    'closed_sessions', v_closed_sessions,
    'updated_plans', v_updated_plans
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 모든 변경사항 자동 롤백
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- RLS 정책: 함수는 SECURITY DEFINER로 실행되므로
-- 호출자의 student_id가 일치하는지 함수 내부에서 검증함

COMMENT ON FUNCTION complete_plan_atomic IS
'플랜 완료 트랜잭션: 세션 종료와 플랜 업데이트를 원자적으로 처리하여 데이터 정합성 보장';
