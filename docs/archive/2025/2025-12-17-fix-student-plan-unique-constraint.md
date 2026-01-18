# student_plan_unique 제약 조건 제거 수정

**작업 일자**: 2025-12-17  
**관련 파일**: 
- `supabase/migrations/20251217160000_remove_student_plan_unique_constraint_corrected.sql`
- `supabase/migrations/20251212000002_remove_student_plan_unique_constraint.sql`

## 문제 상황

### 발견된 문제

플랜 저장 시 다음과 같은 에러가 발생했습니다:

```
Error Code: 23505
Message: duplicate key value violates unique constraint "student_plan_unique"
```

### 원인 분석

1. **이전 마이그레이션 실패**: `20251212000002_remove_student_plan_unique_constraint.sql`에서 잘못된 제약 조건 이름으로 제거를 시도했습니다.
   - 시도한 이름: `student_plan_student_id_plan_date_block_index_key`
   - 실제 이름: `student_plan_unique`

2. **제약 조건 정의**: `student_plan_unique`는 `(student_id, plan_date, block_index)`에 대한 복합 UNIQUE 제약 조건입니다.

3. **문제점**: 이 제약 조건은 여러 플랜 그룹이 같은 날짜와 블록 인덱스를 가질 수 없게 막고 있었습니다.

## 해결 방법

### 마이그레이션 파일 생성

새로운 마이그레이션 파일을 생성하여 올바른 제약 조건 이름으로 제거:

```sql
-- 올바른 제약 조건 이름으로 제거
ALTER TABLE student_plan 
DROP CONSTRAINT IF EXISTS student_plan_unique;

-- 이전 이름도 시도 (혹시 모를 경우를 위해)
ALTER TABLE student_plan 
DROP CONSTRAINT IF EXISTS student_plan_student_id_plan_date_block_index_key;
```

### 마이그레이션 적용

- **방법**: Supabase MCP를 사용하여 직접 적용
- **결과**: ✅ 성공적으로 적용됨

## 제약 조건 제거 이유

다음 이유로 제약 조건을 제거했습니다:

1. **애플리케이션 로직으로 중복 방지**: 같은 플랜 그룹 내에서는 `usedIndices` Set을 사용하여 `block_index` 중복을 방지합니다.

2. **활성화 로직으로 충돌 제어**: 다른 플랜 그룹과의 충돌은 활성화 로직으로 제어됩니다.
   - 활성화된 플랜 그룹만 조회: `getActivePlanGroupsForDate()`
   - 활성화 시 다른 활성 플랜 그룹 자동 비활성화

3. **플랜 그룹 재사용 및 여러 플랜 그룹 생성 허용**: 플랜 그룹을 자유롭게 생성하고 재사용할 수 있도록 합니다.

## 적용 결과 확인

제약 조건이 제거되었는지 확인하는 쿼리:

```sql
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
    AND tc.table_name = 'student_plan'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name, kcu.ordinal_position;
```

**예상 결과**: `student_plan_pkey` (PRIMARY KEY)만 남아있어야 하며, `student_plan_unique`는 제거되어야 합니다.

## 영향 범위

### 변경 전
- 같은 `(student_id, plan_date, block_index)` 조합은 한 번만 저장 가능
- 여러 플랜 그룹이 같은 날짜와 블록에 플랜을 가질 수 없음

### 변경 후
- 같은 `(student_id, plan_date, block_index)` 조합을 여러 플랜 그룹이 가질 수 있음
- 애플리케이션 로직과 활성화 로직으로 충돌 제어

## 관련 문서

- `docs/refactoring/remove-student-plan-unique-constraint.md` - 초기 제약 조건 제거 계획 문서
- `supabase/migrations/20251212000002_remove_student_plan_unique_constraint.sql` - 이전 마이그레이션 (실패)

## 참고사항

- 마이그레이션 적용 후 플랜 생성 기능이 정상적으로 작동하는지 테스트 필요
- 여러 플랜 그룹 생성 및 활성화 로직이 제대로 작동하는지 확인 필요

