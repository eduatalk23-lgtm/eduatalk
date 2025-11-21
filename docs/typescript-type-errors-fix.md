# TypeScript 타입 에러 수정

## 작업 일시
2025-01-XX

## 문제점
`planGroupActions.ts` 파일에서 다수의 TypeScript 타입 에러가 발생했습니다.

## 수정 내용

### 1. `scheduler_options` select 추가
- **파일**: `lib/data/planGroups.ts`
- **문제**: `getPlanGroupById`와 `getPlanGroupsForStudent`에서 `scheduler_options`를 select하지 않아 타입 에러 발생
- **수정**: select 문에 `scheduler_options` 추가

### 2. `dateTimeSlots` 반환 타입 문제
- **파일**: `app/(student)/actions/planGroupActions.ts`
- **문제**: `_getScheduleResultData` 함수의 반환 타입에 `dateTimeSlots`가 정의되어 있지만 실제로 반환하지 않음
- **수정**: `dailySchedule`에서 `time_slots`를 추출하여 `dateTimeSlots` 생성 후 반환

### 3. `day_type` 비교 수정
- **파일**: `app/(student)/actions/planGroupActions.ts`
- **문제**: `day_type`은 `"개인일정"`인데 코드에서 `"개인사정"`과 비교
- **수정**: `"개인사정"` → `"개인일정"`으로 수정

### 4. `chapter` 타입 문제
- **파일**: `app/(student)/actions/planGroupActions.ts`
- **문제**: `chapterCache.get(cacheKey)`가 `string | null | undefined`를 반환하는데 `planPayload.chapter`는 `string | null` 타입
- **수정**: `?? null` 추가하여 `undefined` 처리

### 5. `group.status` 타입 문제
- **파일**: `app/(student)/actions/planGroupActions.ts`
- **문제**: `group.status === "draft"` 비교 시 타입 에러 발생
- **수정**: 타입 단언 `(group.status as PlanStatus) === "draft"` 사용

### 6. 반환 타입 수정
- **파일**: `app/(student)/actions/planGroupActions.ts`
- **문제**: `_syncTimeManagementExclusions`와 `_syncTimeManagementAcademySchedules` 함수의 반환 타입이 실제 반환값과 불일치
- **수정**: 반환 타입에 `exclusions`와 `academySchedules` 추가

### 7. `targetGroupId` null 체크
- **파일**: `app/(student)/actions/planGroupActions.ts`
- **문제**: `targetGroupId`가 `string | null`인데 `createPlanExclusions`에 전달
- **수정**: null 체크 추가

### 8. `_getScheduleResultData`에서 `scheduler_options` select 추가
- **파일**: `app/(student)/actions/planGroupActions.ts`
- **문제**: 직접 Supabase에서 조회할 때 `scheduler_options`를 select하지 않음
- **수정**: select 문에 `scheduler_options` 추가

## 남은 문제
- `withErrorHandling` 함수의 타입 문제 (다수의 함수에서 발생)
- 이는 `withErrorHandling` 함수의 타입 정의를 수정해야 해결 가능

## 참고
- `PlanStatus` 타입 import 추가
- `day_type`과 `exclusion_type`의 차이:
  - `day_type`: `"학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정"`
  - `exclusion_type`: `"휴가" | "개인사정" | "휴일지정" | "기타"`

