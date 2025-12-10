# TypeScript 에러 수정 (2025-01-03)

## 개요

프로젝트 전체에서 발생한 24개의 TypeScript 컴파일 에러를 수정했습니다.

## 수정 내용

### 1. `withErrorHandling` 사용법 수정

**문제**: `withErrorHandling`은 함수를 받아서 래핑된 함수를 반환하는 고차 함수인데, 즉시 실행 함수를 전달하여 타입 불일치가 발생했습니다.

**해결**: 함수를 정의한 후 `withErrorHandling`으로 래핑하는 방식으로 변경했습니다.

**수정 파일**:
- `app/(admin)/actions/reschedule/cleanup.ts`
- `app/(student)/actions/plan-groups/reschedule.ts`
- `app/(student)/actions/plan-groups/rollback.ts`

**변경 예시**:
```typescript
// 이전
export async function cleanupOrphanedPlans(groupId: string): Promise<CleanupResult> {
  return withErrorHandling(async () => {
    // ...
  });
}

// 이후
async function _cleanupOrphanedPlans(groupId: string): Promise<CleanupResult> {
  // ...
}

export const cleanupOrphanedPlans = withErrorHandling(_cleanupOrphanedPlans);
```

### 2. `user.id` → `user.userId` 변경

**문제**: `CurrentUser` 타입에는 `id` 속성이 없고 `userId` 속성이 있습니다.

**해결**: 모든 `user.id` 참조를 `user.userId`로 변경하고, null 체크를 추가했습니다.

**수정 파일**:
- `app/(student)/actions/plan-groups/reschedule.ts`
- `app/(student)/actions/plan-groups/rollback.ts`

### 3. `BlockInfo` 타입 불일치 해결

**문제**: `lib/plan/blocks.ts`의 `BlockInfo`와 `lib/plan/scheduler.ts`의 `BlockInfo`가 서로 다른 구조를 가지고 있었습니다.

**해결**: `getBlockSetForPlanGroup`에서 반환된 블록을 `scheduler.ts`의 `BlockInfo` 형식으로 변환하는 로직을 추가했습니다.

**수정 파일**:
- `app/(student)/actions/plan-groups/reschedule.ts`

**변경 내용**:
```typescript
// blocks.ts의 BlockInfo → scheduler.ts의 BlockInfo로 변환
const baseBlocks = baseBlocksRaw.map((block, index) => {
  const start = block.start_time.split(":").map(Number);
  const end = block.end_time.split(":").map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  const durationMinutes = endMinutes - startMinutes;

  return {
    id: `block-${index}`,
    day_of_week: block.day_of_week,
    block_index: index,
    start_time: block.start_time,
    end_time: block.end_time,
    duration_minutes: durationMinutes,
  };
});
```

### 4. `academy_name` null 처리

**문제**: `lib/types/plan.ts`의 `AcademySchedule`은 `academy_name?: string | null`이지만, `validateAcademyScheduleOverlap`은 `academy_name?: string`을 기대합니다.

**해결**: `validateAcademyScheduleOverlap` 호출 전에 null을 undefined로 변환하는 매핑을 추가했습니다.

**수정 파일**:
- `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`

### 5. `replacedContent.info` undefined 체크

**문제**: `replacedContent.info`가 undefined일 수 있는데 체크 없이 접근했습니다.

**해결**: optional chaining과 null 체크를 추가했습니다.

**수정 파일**:
- `app/(student)/plan/group/[id]/reschedule/_components/AdjustmentStep.tsx`

### 6. `dateRange` 타입 불일치

**문제**: `RescheduleWizard`의 `dateRange`는 `{ from: string | null; to: string | null } | null`이지만, `PreviewStep`은 `{ from: string; to: string } | null | undefined`를 기대합니다.

**해결**: 전달 전에 null 체크와 타입 변환을 추가했습니다.

**수정 파일**:
- `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx`

### 7. `maxWidth` 타입 불일치

**문제**: `Dialog` 컴포넌트는 `maxWidth`로 `"3xl"`을 허용하지 않습니다.

**해결**: `"3xl"`을 `"4xl"`로 변경했습니다.

**수정 파일**:
- `app/(student)/today/_components/PlanRangeAdjustModal.tsx`

### 8. `content.subject` null 체크

**문제**: `content.subject`가 null일 수 있는데 체크 없이 `includes` 메서드를 호출했습니다.

**해결**: null 체크를 추가했습니다.

**수정 파일**:
- `lib/plan/1730TimetableLogic.ts`

### 9. `plan.status` 속성 처리

**문제**: `lib/types/plan.ts`의 `Plan` 타입에 `status` 속성이 없지만, `delayDetector.ts`에서 사용하고 있었습니다.

**해결**: 타입 확장을 사용하여 `status`와 `actual_end_time`을 선택적으로 처리하고, `progress`와 `completed_amount`를 기반으로 완료 여부를 판단하도록 수정했습니다.

**수정 파일**:
- `lib/reschedule/delayDetector.ts`

**변경 내용**:
```typescript
function isPlanCompleted(plan: Plan): boolean {
  const isProgressComplete = plan.progress === 100;
  const isAmountComplete = 
    plan.planned_end_page_or_time !== null &&
    plan.planned_end_page_or_time !== undefined &&
    plan.completed_amount !== null &&
    plan.completed_amount !== undefined &&
    plan.completed_amount >= plan.planned_end_page_or_time;
  
  const planWithStatus = plan as Plan & { 
    status?: string | null; 
    actual_end_time?: string | null;
  };
  
  return (
    isProgressComplete ||
    isAmountComplete ||
    planWithStatus.status === "completed" ||
    planWithStatus.actual_end_time !== null
  );
}
```

### 10. Supabase Edge Function Deno 타입 에러 처리

**문제**: Supabase Edge Function은 Deno 환경에서 실행되므로 TypeScript 컴파일러가 Deno 타입을 인식하지 못합니다.

**해결**: `tsconfig.json`에서 `supabase/functions` 디렉토리를 제외했습니다.

**수정 파일**:
- `tsconfig.json`

## 수정된 파일 목록

1. `app/(admin)/actions/reschedule/cleanup.ts`
2. `app/(student)/actions/plan-groups/reschedule.ts`
3. `app/(student)/actions/plan-groups/rollback.ts`
4. `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`
5. `app/(student)/plan/group/[id]/reschedule/_components/AdjustmentStep.tsx`
6. `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx`
7. `app/(student)/today/_components/PlanRangeAdjustModal.tsx`
8. `lib/plan/1730TimetableLogic.ts`
9. `lib/reschedule/delayDetector.ts`
10. `tsconfig.json`

## 검증

모든 TypeScript 에러가 해결되었는지 확인:

```bash
npx tsc --noEmit
```

결과: 에러 없음 ✅

## 참고 사항

- `withErrorHandling`은 함수를 래핑하는 고차 함수이므로, 함수 정의와 export를 분리해야 합니다.
- `CurrentUser` 타입은 `userId` 속성을 사용하며, `id`는 없습니다.
- Supabase Edge Function은 Deno 환경에서 실행되므로 TypeScript 컴파일에서 제외해야 합니다.
