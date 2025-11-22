-- pause_count를 증가시키는 RPC 함수 생성
-- 한 번의 쿼리로 조회 및 업데이트를 수행하여 성능 최적화

-- 기존 함수가 있으면 삭제 (스키마 캐시 문제 해결)
DROP FUNCTION IF EXISTS public.increment_pause_count(UUID, UUID);

-- 함수 생성 (public 스키마에 명시적으로 생성)
CREATE OR REPLACE FUNCTION public.increment_pause_count(
  p_plan_id UUID,
  p_student_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- pause_count를 1 증가시키고 새로운 값을 반환
  UPDATE student_plan
  SET pause_count = COALESCE(pause_count, 0) + 1
  WHERE id = p_plan_id
    AND student_id = p_student_id
  RETURNING pause_count INTO v_new_count;
  
  -- 업데이트된 행이 없으면 0 반환
  RETURN COALESCE(v_new_count, 0);
END;
$$;

-- 함수에 대한 설명 추가
COMMENT ON FUNCTION public.increment_pause_count(UUID, UUID) IS 
'플랜의 pause_count를 1 증가시키고 새로운 값을 반환합니다. 한 번의 쿼리로 조회 및 업데이트를 수행하여 성능을 최적화합니다.';

-- authenticated 역할에 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.increment_pause_count(UUID, UUID) TO authenticated;

