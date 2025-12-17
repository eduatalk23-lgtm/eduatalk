# 플랜 그룹 생성 시 제외일/학원일정 불러오기 수정 및 코드 최적화

## 작업 일자
2025-01-15

## 작업 개요
플랜 그룹 생성 시 시간 관리 영역의 제외일과 학원 일정을 올바르게 불러오도록 수정하고, 중복 코드를 제거하여 유지보수성을 향상시켰습니다.

## 문제점

### 1. 제외일 불러오기 문제
- `syncTimeManagementExclusionsAction`이 `getStudentExclusions`를 사용하여 모든 제외일을 조회
- 현재 플랜 그룹의 제외일까지 포함되어 중복 표시됨

### 2. 학원 일정 불러오기 문제
- `syncTimeManagementAcademySchedulesAction`도 동일한 방식으로 모든 학원 일정을 조회
- 현재 플랜 그룹의 학원 일정까지 포함되어 중복 표시됨

### 3. 중복 코드
- 두 함수에서 유사한 인증/권한 체크 로직이 반복됨
- `createExclusions`와 `createPlanAcademySchedules`에서 동일한 `plan_group_id` 필터링 패턴이 반복됨

## 해결 방법

### 1. 공통 헬퍼 함수 생성
**파일**: `lib/data/planGroups.ts`

`applyTimeManagementFilter` 함수를 생성하여 `plan_group_id` 필터링 로직을 공통화했습니다.

```typescript
export function applyTimeManagementFilter<
  T extends PostgrestQueryBuilder<any, any, any, any>
>(
  query: T,
  currentGroupId: string | null
): T {
  if (currentGroupId) {
    // 현재 그룹을 제외한 모든 데이터 조회 (시간 관리 영역 + 다른 플랜 그룹)
    return query.or(`plan_group_id.is.null,plan_group_id.neq.${currentGroupId}`) as T;
  } else {
    // 시간 관리 영역만 조회
    return query.is("plan_group_id", null) as T;
  }
}
```

### 2. 인증/권한 체크 공통 함수 생성
**파일**: `lib/utils/planGroupAuth.ts` (신규)

`resolveTargetStudentId` 함수를 생성하여 인증/권한 체크 로직을 공통화했습니다.

```typescript
export async function resolveTargetStudentId(
  groupId: string | null,
  studentId?: string
): Promise<{
  targetStudentId: string;
  group?: PlanGroup;
  tenantId: string;
}>
```

### 3. `syncTimeManagementExclusionsAction` 수정
**파일**: `app/(student)/actions/plan-groups/exclusions.ts`

- `getStudentExclusions` 대신 직접 Supabase 쿼리 사용
- `applyTimeManagementFilter` 헬퍼 함수 활용
- `resolveTargetStudentId`로 인증/권한 체크 공통화

### 4. `syncTimeManagementAcademySchedulesAction` 수정
**파일**: `app/(student)/actions/plan-groups/academy.ts`

- `getStudentAcademySchedules` 대신 직접 Supabase 쿼리 사용
- `applyTimeManagementFilter` 헬퍼 함수 활용
- `resolveTargetStudentId`로 인증/권한 체크 공통화
- `academies` 조인을 통한 `travel_time` 조회 유지

### 5. 기존 함수 리팩토링
**파일**: `lib/data/planGroups.ts`

- `createExclusions` 함수에서 `applyTimeManagementFilter` 사용
- `createPlanAcademySchedules` 함수에서 `applyTimeManagementFilter` 사용

## 수정된 파일 목록

1. `lib/data/planGroups.ts`
   - `applyTimeManagementFilter` 함수 추가 (export)
   - `createExclusions` 함수 리팩토링
   - `createPlanAcademySchedules` 함수 리팩토링

2. `app/(student)/actions/plan-groups/exclusions.ts`
   - `_syncTimeManagementExclusions` 함수 수정
   - 직접 쿼리 사용 및 `plan_group_id` 필터링 추가
   - `resolveTargetStudentId` 사용

3. `app/(student)/actions/plan-groups/academy.ts`
   - `_syncTimeManagementAcademySchedules` 함수 수정
   - 직접 쿼리 사용 및 `plan_group_id` 필터링 추가
   - `resolveTargetStudentId` 사용

4. `lib/utils/planGroupAuth.ts` (신규)
   - `resolveTargetStudentId` 함수 추가

## 쿼리 패턴

Supabase 모범 사례에 따라 `.or()` 메서드를 사용한 복합 조건 처리:

```typescript
// groupId가 있는 경우: 시간 관리 영역 + 다른 플랜 그룹
query.or(`plan_group_id.is.null,plan_group_id.neq.${groupId}`)

// groupId가 없는 경우: 시간 관리 영역만
query.is("plan_group_id", null)
```

## 데이터베이스 스키마

- `plan_exclusions.plan_group_id`: NULL 허용 (NULL이면 시간 관리 영역)
- `academy_schedules.plan_group_id`: NULL 허용 (NULL이면 시간 관리 영역)

## 테스트 시나리오

1. **시간 관리 영역 제외일 불러오기**
   - 시간 관리에 제외일 등록 → 플랜 그룹 생성 시 불러오기 확인

2. **다른 플랜 그룹 제외일 불러오기**
   - 플랜 그룹 A에 제외일 등록 → 플랜 그룹 B 생성 시 불러오기 확인

3. **현재 플랜 그룹 제외일 제외 확인**
   - 플랜 그룹 A에 제외일 등록 → 플랜 그룹 A 편집 시 불러오기에서 제외 확인

4. **학원 일정도 동일한 시나리오로 테스트**

## 개선 효과

1. **중복 코드 제거**: 인증/권한 체크 로직과 쿼리 필터링 로직을 공통 함수로 추출하여 유지보수성 향상
2. **정확한 데이터 조회**: 현재 플랜 그룹의 데이터를 제외하여 올바른 "불러오기" 목록 제공
3. **일관성 유지**: 모든 관련 함수에서 동일한 필터링 패턴 사용

## 참고사항

- Supabase `.or()` 메서드는 PostgREST 필터 문법을 사용합니다
- `plan_group_id`가 NULL인 경우와 특정 값이 아닌 경우를 OR 조건으로 처리
- 기존 `createExclusions`와 `createPlanAcademySchedules`의 패턴을 재사용하여 일관성 유지

