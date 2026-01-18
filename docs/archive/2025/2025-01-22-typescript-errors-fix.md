# TypeScript 에러 대량 수정 (2025-01-22)

## 개요

`npx tsc --noEmit` 명령어로 확인된 TypeScript 에러를 대량으로 수정했습니다.

## 수정 내용

### 1. ErrorCode.CONFIGURATION_ERROR 추가

**파일**: `lib/errors/handler.ts`

`ErrorCode` enum에 `CONFIGURATION_ERROR`를 추가하여 설정 관련 에러를 처리할 수 있도록 했습니다.

```typescript
export enum ErrorCode {
  // ... 기존 코드
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}
```

### 2. PlanGroupWizardProps의 studentId를 optional로 변경

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

템플릿 모드에서는 `studentId`가 필요하지 않으므로 optional로 변경했습니다.

```typescript
export type PlanGroupWizardProps = {
  studentId?: string; // 선택: 템플릿 모드에서는 불필요
  // ... 기타 props
};
```

### 3. day_of_week 타입 변환 함수 추가

**파일**: `lib/types/time-management.ts`

`number` 타입의 `day_of_week`를 `DayOfWeek` 타입으로 변환하는 함수를 추가했습니다.

```typescript
export function toDayOfWeek(value: number): DayOfWeek {
  if (value >= 0 && value <= 6) {
    return value as DayOfWeek;
  }
  throw new Error(`Invalid day of week: ${value}. Must be between 0 and 6.`);
}

export function normalizeBlock(block: {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}): Block {
  return {
    ...block,
    day_of_week: toDayOfWeek(block.day_of_week),
  };
}

export function normalizeBlocks(blocks: Array<...>): Block[] {
  return blocks.map(normalizeBlock);
}
```

**적용 파일**:
- `app/(admin)/admin/time-management/_components/TemplateBlockSetManagement.tsx`
- `app/(admin)/admin/time-management/[templateId]/_components/TemplateBlockSetManagement.tsx`
- `app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlockSetManagement.tsx`
- `app/(admin)/admin/time-management/page.tsx`
- `app/(admin)/admin/time-management/[templateId]/page.tsx`

### 4. isErrorResponse import 누락 문제 해결

**파일**:
- `app/(student)/blocks/_components/BlocksViewer.tsx`
- `app/(student)/plan/new-group/_components/_features/basic-info/hooks/useBlockSetManagement.ts`

`isErrorResponse` 함수를 import하여 타입 가드를 사용할 수 있도록 했습니다.

### 5. FormEvent 타입 불일치 문제 해결

**파일**:
- `app/(admin)/admin/subjects/_components/base/BaseGroupForm.tsx`
- `app/(admin)/admin/subjects/_components/base/BaseSubjectForm.tsx`
- `app/(admin)/admin/subjects/_components/base/BaseSubjectTypeForm.tsx`

`onSubmit` prop의 타입을 `React.FormEvent`에서 `React.FormEvent<HTMLFormElement>`로 변경하여 타입 안전성을 개선했습니다.

### 6. ActionResponse 타입 관련 문제 해결

**파일**: `app/(admin)/admin/parent-links/_components/PendingLinkRequestsList.tsx`

`approveLinkRequests`와 `rejectLinkRequests`는 `ActionResponse`를 반환하지 않으므로 래퍼 함수를 추가했습니다.

```typescript
const approveLinkRequestsWrapper = async (linkIds: string[]) => {
  const result = await approveLinkRequests(linkIds);
  if (result.success) {
    return {
      success: true as const,
      data: result,
    };
  }
  return {
    success: false as const,
    error: "승인 처리 중 오류가 발생했습니다.",
  };
};
```

### 7. BlocksViewer의 useActionState 타입 문제 해결

**파일**: `app/(student)/blocks/_components/BlocksViewer.tsx`

`useActionState`의 상태 타입을 `{ error: string | null }`에서 `{ error: string | undefined }`로 변경하여 타입 일관성을 개선했습니다.

### 8. SubjectGroupManagement의 any 타입 문제 해결

**파일**: `app/(admin)/admin/subjects/_components/SubjectGroupManagement.tsx`

`map` 함수의 `subject` 파라미터에 `Subject` 타입을 명시적으로 지정했습니다.

### 9. SMSSendForm의 undefined 처리 문제 해결

**파일**: `app/(admin)/admin/sms/_components/SMSSendForm.tsx`

`selectedTemplateObj`가 `SMSTemplate | null | undefined`인데 `SMSTemplate | null`을 기대하므로 `?? null`을 사용하여 변환했습니다.

### 10. BlockForm과 BlockList의 form action 타입 문제 해결

**파일**:
- `app/(student)/blocks/_components/BlockForm.tsx`
- `app/(student)/blocks/[setId]/_components/BlockList.tsx`

`form action`은 `void`를 반환해야 하므로 `useServerForm`의 `action`을 래핑하는 함수를 추가했습니다.

```typescript
const { action: serverAction, ... } = useServerForm(wrappedAction, ...);

// form action은 void를 반환해야 하므로 래퍼 함수 생성
const action = async (formData: FormData) => {
  await serverAction(formData);
};
```

## 결과

- **1단계 수정 전**: 159개 에러
- **1단계 수정 후**: 67개 에러
- **2단계 수정 후**: 55개 에러
- **3단계 수정 후**: 47개 에러
- **총 해결된 에러**: 112개

## 추가 수정 사항 (2-3단계)

### 2단계 수정
- **PlanGroupFilters export 추가**: `usePlanGroups.ts`에서 re-export
- **useBlockSetManagement 타입 수정**: `createTenantBlockSet`는 `ActionResponse`를 반환하지 않으므로 직접 객체 사용
- **ScoreFormModal 타입 수정**: `ActionResponse<{ success: boolean; scoreId?: string }>` 타입 명시
- **superadmin 컴포넌트들**: `isErrorResponse` 타입 가드 사용 추가

### 3단계 수정
- **plan/page.tsx**: `sortOrder` 타입을 `"asc" | "desc"`로 제한
- **actions/blocks.ts**: `student.tenant_id`의 `undefined`를 `null`로 변환 (`?? null`)
- **actions/blocks.ts**: `active_block_set_id` 속성 타입 단언 추가

## 남은 에러 (47개)

주요 남은 에러들:
1. `camp/today/page`의 `initialPlansData` prop 문제
2. `plan/group/[id]/page`의 `Plan[]` 타입 문제
3. `today`의 `initialData` prop 문제
4. `signup/page`의 null 체크 문제
5. `lib/data`의 타입 불일치 문제들
6. `api/student-content-details`의 ParserError 타입 문제

## 참고

- TypeScript strict mode 활성화
- 타입 안전성 개선을 위한 지속적인 수정 필요

