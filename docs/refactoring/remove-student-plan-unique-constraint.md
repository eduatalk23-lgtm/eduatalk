# student_plan UNIQUE 제약 조건 제거

## 배경

### 문제 상황

`student_plan` 테이블에 `student_id + plan_date + block_index`에 대한 UNIQUE 제약 조건이 있어서, 같은 학생의 같은 날짜와 블록에 여러 플랜 그룹의 플랜이 공존할 수 없었습니다.

**에러 메시지:**
```
duplicate key value violates unique constraint "student_plan_student_id_plan_date_block_index_key"
```

### 문제점

1. **플랜 그룹 재사용 불가**: 같은 플랜 그룹을 다시 활성화하거나 수정할 때 제약 조건 위반
2. **여러 플랜 그룹 생성 제한**: 같은 날짜와 블록에 다른 플랜 그룹의 플랜이 있으면 생성 불가
3. **불필요한 제약**: 애플리케이션 로직으로 이미 충분히 제어 가능

## 해결 방안

### 제약 조건 제거 이유

1. **같은 플랜 그룹 내 중복 방지**: 애플리케이션 로직으로 처리
   - `usedIndices` Set을 사용하여 같은 날짜 내에서 `block_index` 중복 방지
   - 코드 위치: `app/(student)/actions/plan-groups/plans.ts` (1240-1247번 라인)

2. **다른 플랜 그룹과의 충돌 제어**: 활성화 로직으로 처리
   - 활성화된 플랜 그룹만 조회: `getActivePlanGroupsForDate()`
   - 활성화 시 다른 활성 플랜 그룹 자동 비활성화
   - 코드 위치: `app/(student)/actions/plan-groups/status.ts` (46-95번 라인)

3. **플랜 그룹 재사용 및 여러 플랜 그룹 생성 허용**
   - 플랜 그룹을 자유롭게 생성하고 재사용 가능
   - 활성화 로직으로 실제 사용 시 충돌 방지

## 구현 내용

### 1. 마이그레이션 파일

**파일:** `supabase/migrations/20251212000002_remove_student_plan_unique_constraint.sql`

```sql
ALTER TABLE student_plan 
DROP CONSTRAINT IF EXISTS student_plan_student_id_plan_date_block_index_key;
```

### 2. 에러 처리 코드 정리

**파일:** `app/(student)/actions/plan-groups/plans.ts` (1402-1446번 라인)

- 기존: 특정 제약 조건에 대한 상세한 에러 처리
- 변경: 일반적인 UNIQUE 제약 조건 에러 처리로 단순화
- 이유: 제약 조건이 제거되어 특정 에러는 발생하지 않지만, 다른 UNIQUE 제약 조건이 있을 수 있음

### 3. 영향 분석

#### 긍정적 영향

- ✅ 여러 플랜 그룹 생성 가능
- ✅ 플랜 그룹 재사용 가능
- ✅ 활성화 로직으로 충돌 제어
- ✅ 더 유연한 플랜 관리

#### 부정적 영향

- ❌ 없음
  - 같은 플랜 그룹 내 중복은 로직상 발생하지 않음
  - 활성화 로직으로 다른 플랜 그룹과의 충돌 제어

## 검증 방법

1. **마이그레이션 실행 확인**
   ```sql
   SELECT constraint_name 
   FROM information_schema.table_constraints 
   WHERE table_name = 'student_plan' 
   AND constraint_name = 'student_plan_student_id_plan_date_block_index_key';
   -- 결과: 없음 (제약 조건 제거됨)
   ```

2. **플랜 생성 테스트**
   - 같은 날짜와 블록에 여러 플랜 그룹의 플랜 생성 가능 확인
   - 같은 플랜 그룹 내에서 중복 방지 로직 동작 확인

3. **활성화 로직 테스트**
   - 여러 플랜 그룹 생성 후 활성화
   - 활성화 시 다른 활성 플랜 그룹 자동 비활성화 확인

## 관련 파일

- `supabase/migrations/20251212000002_remove_student_plan_unique_constraint.sql`
- `app/(student)/actions/plan-groups/plans.ts`
- `app/(student)/actions/plan-groups/status.ts`
- `lib/domains/plan/service.ts` (활성화 로직)

## 참고

- 제약 조건 제거 후에도 애플리케이션 로직으로 데이터 무결성 보장
- 활성화 로직이 실제 사용 시 충돌을 방지하므로 안전함
- 플랜 그룹 재사용 및 여러 플랜 그룹 생성이 가능해져 더 유연한 플랜 관리 가능

