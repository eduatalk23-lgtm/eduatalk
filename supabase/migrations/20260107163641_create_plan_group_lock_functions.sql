-- =====================================================
-- Plan Group Lock Functions
-- 플랜 그룹 동시성 제어를 위한 Advisory Lock 함수들
-- Phase 2.1: 플랜 생성 동시성 제어 구현
-- =====================================================

-- 1. 플랜 그룹 Advisory Lock 획득 (논블로킹)
-- 트랜잭션 레벨 Advisory Lock을 사용하여 동일 플랜 그룹에 대한
-- 동시 작업을 방지합니다.
CREATE OR REPLACE FUNCTION acquire_plan_group_lock(
  p_group_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  v_acquired BOOLEAN;
BEGIN
  -- UUID를 해시하여 Advisory Lock 키 생성
  -- FNV-1a 변형 해시 함수 사용
  v_lock_key := abs(hashtext(p_group_id::TEXT))::BIGINT;
  
  -- 논블로킹 Advisory Lock 시도 (트랜잭션 레벨)
  -- pg_try_advisory_xact_lock은 현재 트랜잭션 내에서만 유효
  SELECT pg_try_advisory_xact_lock(v_lock_key) INTO v_acquired;
  
  IF v_acquired THEN
    RETURN jsonb_build_object(
      'success', true,
      'acquired', true,
      'lock_key', v_lock_key
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'acquired', false,
      'lock_key', v_lock_key,
      'message', 'Lock is already held by another transaction'
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'acquired', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- 2. 플랜 그룹 Advisory Lock 해제 확인
-- 트랜잭션 레벨 Advisory Lock은 트랜잭션이 끝나면 자동으로 해제되므로,
-- 이 함수는 현재 Lock 보유 여부만 확인합니다.
CREATE OR REPLACE FUNCTION check_plan_group_lock(
  p_group_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  v_held BOOLEAN;
BEGIN
  -- UUID를 해시하여 Advisory Lock 키 생성
  v_lock_key := abs(hashtext(p_group_id::TEXT))::BIGINT;
  
  -- 현재 트랜잭션에서 Lock 보유 여부 확인
  SELECT pg_advisory_xact_lock_held(v_lock_key) INTO v_held;
  
  RETURN jsonb_build_object(
    'success', true,
    'held', v_held,
    'lock_key', v_lock_key
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'held', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION acquire_plan_group_lock IS 
'플랜 그룹에 대한 Advisory Lock을 획득합니다 (논블로킹).
트랜잭션 레벨 Lock이므로 트랜잭션이 끝나면 자동으로 해제됩니다.
동일 플랜 그룹에 대한 동시 작업을 방지하기 위해 사용됩니다.';

COMMENT ON FUNCTION check_plan_group_lock IS 
'플랜 그룹에 대한 Advisory Lock 보유 여부를 확인합니다.
현재 트랜잭션에서 Lock을 보유하고 있는지 확인합니다.';

