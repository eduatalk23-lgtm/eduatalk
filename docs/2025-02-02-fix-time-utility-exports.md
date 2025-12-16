# 시간 유틸리티 함수 Export 수정

## 작업 일시
2025-02-02

## 문제 상황
여러 파일에서 `timeToMinutes`와 `minutesToTime` 함수를 import하려고 했지만, 해당 모듈들이 이 함수들을 export하지 않아 TypeScript 컴파일 에러가 발생했습니다.

### 에러 발생 파일
1. `app/(admin)/actions/campTemplateActions.ts` - `@/lib/plan/assignPlanTimes`에서 `timeToMinutes` import
2. `app/(student)/actions/plan-groups/generatePlansRefactored.ts` - `./utils`에서 `timeToMinutes` import
3. `app/(student)/actions/plan-groups/queries.ts` - `./utils`에서 `timeToMinutes` import
4. `app/(student)/plan/calendar/_components/DayTimelineModal.tsx` - `../_utils/timelineUtils`에서 `timeToMinutes` import
5. `app/(student)/plan/calendar/_components/DayView.tsx` - `../_utils/timelineUtils`에서 `timeToMinutes` import
6. `app/(student)/plan/calendar/_components/MonthView.tsx` - `../_utils/timelineUtils`에서 `timeToMinutes` import
7. `app/(student)/plan/calendar/_components/WeekView.tsx` - `../_utils/timelineUtils`에서 `timeToMinutes` import
8. `app/(student)/plan/new-group/_components/_features/scheduling/components/PlanTable.tsx` - `./scheduleUtils`에서 `timeToMinutes` import
9. `app/(student)/plan/new-group/_components/_features/scheduling/components/TimeSlotsWithPlans.tsx` - `./scheduleUtils`에서 `timeToMinutes`, `minutesToTime` import

## 해결 방법
각 모듈에서 `timeToMinutes`와 `minutesToTime` 함수를 re-export하도록 수정했습니다.

### 수정된 파일

#### 1. `lib/plan/assignPlanTimes.ts`
```typescript
// Re-export time utility functions for convenience
export { timeToMinutes, minutesToTime };
```

#### 2. `app/(student)/actions/plan-groups/utils.ts`
```typescript
// Re-export time utility function for convenience
export { timeToMinutes };
```

#### 3. `app/(student)/plan/calendar/_utils/timelineUtils.ts`
```typescript
// Re-export time utility functions for convenience
export { timeToMinutes, minutesToTime };
```

#### 4. `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts`
```typescript
// Re-export time utility functions for convenience
export { timeToMinutes, minutesToTime };
```

## 결과
- TypeScript 컴파일 에러 10개 모두 해결
- 모든 파일에서 `timeToMinutes`와 `minutesToTime` 함수를 정상적으로 import 가능

## 참고
- 원본 함수는 `@/lib/utils/time`에 정의되어 있음
- 각 모듈에서 re-export하여 편의성을 제공

