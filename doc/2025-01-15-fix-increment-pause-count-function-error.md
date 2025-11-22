# increment_pause_count 함수 오류 수정

## 📋 문제 상황

플랜 일시정지 시 `increment_pause_count` 함수를 찾을 수 없다는 오류가 발생했습니다.

```
[todayActions] pause_count 증가 오류: {
  code: 'PGRST202',
  details: 'Searched for the function public.increment_pause_count with parameters p_plan_id, p_student_id or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
  hint: null,
  message: 'Could not find the function public.increment_pause_count(p_plan_id, p_student_id) in the schema cache'
}
```

## 🔍 원인 분석

1. **PostgREST 스키마 캐시 문제**: PostgREST가 함수를 스키마 캐시에서 찾지 못함
2. **스키마 명시 부족**: 함수가 `public` 스키마에 명시적으로 생성되지 않음
3. **권한 부여 누락**: `authenticated` 역할에 함수 실행 권한이 없음

## ✅ 해결 방법

### 1. 마이그레이션 파일 수정

**파일**: `supabase/migrations/20250114000000_create_increment_pause_count_function.sql`

**변경 사항**:
- 기존 함수 삭제 후 재생성 (스키마 캐시 문제 해결)
- `public` 스키마 명시적 지정
- `SET search_path = public` 추가하여 스키마 경로 명확화
- `authenticated` 역할에 함수 실행 권한 부여

```sql
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
```

## 📝 적용 방법

### 방법 1: Supabase Dashboard SQL Editor 사용 (권장)

1. Supabase Dashboard → SQL Editor로 이동
2. 마이그레이션 파일 내용을 복사하여 실행
3. 실행 후 PostgREST 스키마 캐시가 자동으로 업데이트됨

### 방법 2: Supabase CLI 사용

```bash
# Supabase 프로젝트 연결 (이미 연결된 경우 생략)
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

## ✅ 검증 방법

마이그레이션 실행 후 다음 SQL로 함수가 정상적으로 생성되었는지 확인:

```sql
-- 함수 존재 확인
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname = 'increment_pause_count'
  AND pronamespace = 'public'::regnamespace;

-- 권한 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'increment_pause_count'
  AND routine_schema = 'public';
```

## 🎯 예상 효과

- `increment_pause_count` 함수 오류 해결
- PostgREST가 함수를 정상적으로 인식
- 플랜 일시정지 시 `pause_count` 정상 증가

## 📌 참고 사항

- 마이그레이션 실행 후 PostgREST 스키마 캐시가 자동으로 업데이트됩니다
- 함수가 이미 존재하는 경우 `DROP FUNCTION IF EXISTS`로 안전하게 재생성됩니다
- `SECURITY DEFINER`로 설정되어 있어 함수 실행 시 함수 소유자의 권한으로 실행됩니다

