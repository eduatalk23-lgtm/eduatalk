# 제외일 추가 로직 개선 및 코드 최적화

## 작업 일시
2025년 12월 17일

## 작업 개요
플랜 그룹이 없어도 제외일을 추가할 수 있도록 지원하고, 중복 코드를 제거하며 에러 처리를 개선했습니다.

## 주요 변경 사항

### 1. 데이터베이스 마이그레이션
**파일**: `supabase/migrations/20251217020000_allow_null_plan_group_id_in_exclusions.sql`

- `plan_exclusions` 테이블의 `plan_group_id` 컬럼을 NULL 허용으로 변경
- 외래 키 제약조건을 `ON DELETE CASCADE`에서 `ON DELETE SET NULL`로 변경
- 플랜 그룹이 삭제되면 제외일의 `plan_group_id`가 NULL로 설정되어 시간 관리 영역의 제외일로 유지됨

### 2. 타입 정의 업데이트
**파일**: 
- `lib/types/plan/domain.ts`
- `lib/supabase/database.types.ts`

- `PlanExclusion` 타입에 `plan_group_id: string | null` 필드 추가
- 데이터베이스 타입 정의에 `plan_group_id` 필드 추가 (Insert, Update 타입 포함)

### 3. 제외일 생성 함수 통합
**파일**: `lib/data/planGroups.ts`

- 새로운 통합 함수 `createExclusions` 생성
  - `plan_group_id`를 선택적 매개변수로 받음
  - `plan_group_id`가 있으면 플랜 그룹별 관리 로직 실행
  - `plan_group_id`가 없으면 시간 관리 영역에 저장 (plan_group_id = NULL)
- 기존 함수들 하위 호환성 유지
  - `createPlanExclusions`: 내부적으로 `createExclusions` 호출
  - `createStudentExclusions`: 내부적으로 `createExclusions` 호출 (plan_group_id = null)

**개선 사항**:
- 중복 코드 제거
- 시간 관리 영역 제외일 재활용 로직 개선
- 중복 체크 로직 통합 (날짜+유형 조합)

### 4. `_addPlanExclusion` 함수 개선
**파일**: `app/(student)/actions/plan-groups/exclusions.ts`

**주요 변경**:
- 플랜 그룹이 없어도 제외일 추가 가능
- `findTargetPlanGroup` 헬퍼 함수로 플랜 그룹 찾기 로직 분리
- 중복된 에러 체크 제거 (228-235 라인)
- 플랜 그룹이 있으면 `createPlanExclusions`, 없으면 `createStudentExclusions` 호출

**개선된 로직**:
```typescript
// 플랜 그룹 찾기 (활성 → draft/saved 순서)
const targetGroupId = planGroupId || await findTargetPlanGroup(user.userId);

// 플랜 그룹이 있으면 플랜 그룹별로, 없으면 시간 관리 영역에 저장
const result = targetGroupId
  ? await createPlanExclusions(targetGroupId, tenantContext.tenantId, [exclusionData])
  : await createStudentExclusions(user.userId, tenantContext.tenantId, [exclusionData]);
```

### 5. 에러 처리 개선
- 중복 에러와 일반 에러를 구분하여 처리
- 사용자 친화적인 에러 메시지 유지
- 에러 코드 및 상태 코드 적절히 설정

## 기능 개선

### 이전 동작
- 플랜 그룹이 없으면 제외일 추가 불가
- 에러 메시지: "제외일을 추가하려면 먼저 플랜 그룹을 생성해주세요."

### 개선된 동작
- 플랜 그룹이 없어도 제외일 추가 가능
- 시간 관리 영역에 저장됨 (plan_group_id = NULL)
- 이후 플랜 그룹 생성 시 자동으로 재활용됨

## 코드 최적화

1. **중복 코드 제거**
   - `createPlanExclusions`와 `createStudentExclusions` 로직 통합
   - `_addPlanExclusion`에서 중복된 에러 체크 제거

2. **함수 분리**
   - `findTargetPlanGroup` 헬퍼 함수로 플랜 그룹 찾기 로직 분리
   - 코드 가독성 및 재사용성 향상

3. **로직 개선**
   - 시간 관리 영역 제외일 재활용 로직 개선
   - 중복 체크 로직 통합 (날짜+유형 조합)

## 하위 호환성

- 기존 `createPlanExclusions` 함수 유지 (내부적으로 통합 함수 호출)
- 기존 `createStudentExclusions` 함수 유지 (내부적으로 통합 함수 호출)
- 기존 API 인터페이스 변경 없음

## 테스트 권장 사항

1. 플랜 그룹이 있는 경우 제외일 추가
2. 플랜 그룹이 없는 경우 제외일 추가 (시간 관리 영역)
3. 중복 제외일 추가 시도
4. 플랜 그룹 생성 후 시간 관리 영역 제외일 자동 재활용 확인

## 관련 파일

- `supabase/migrations/20251217020000_allow_null_plan_group_id_in_exclusions.sql`
- `lib/types/plan/domain.ts`
- `lib/supabase/database.types.ts`
- `lib/data/planGroups.ts`
- `app/(student)/actions/plan-groups/exclusions.ts`

