# 캠프 액션 SchedulerOptions 타입 에러 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:

### 에러 1
```
./app/(student)/actions/campActions.ts:543:42
Type error: Property 'template_block_set_id' does not exist on type 'SchedulerOptions'.
```

### 에러 2
```
./app/(student)/actions/campActions.ts:697:58
Type error: Type 'string' is not assignable to type 'PlanType | undefined'.
```

## 원인 분석

### 에러 1
`SchedulerOptions` 타입에 `template_block_set_id` 속성이 정의되어 있지 않지만, 코드에서는 `scheduler_options`에 이 속성을 동적으로 추가하고 있었습니다. 543번 라인에서 타입 체크를 하려고 했지만, 타입 정의에 없어서 에러가 발생했습니다.

### 에러 2
`plan_type: "camp"`가 `string` 타입으로 추론되어 `PlanType | undefined` 타입을 기대하는 함수에 전달할 수 없었습니다. `PlanType`은 `"individual" | "integrated" | "camp"` 리터럴 유니온 타입입니다.

## 수정 내용

### 파일
- `app/(student)/actions/campActions.ts`

### 변경 사항

#### 수정 1: SchedulerOptions 타입 에러
`creationData.scheduler_options?.template_block_set_id`를 체크하는 부분에 타입 단언(`as any`)을 추가하여 타입 에러를 해결했습니다.

```typescript
// 수정 전
if (!creationData.scheduler_options?.template_block_set_id && blockSetId) {
  // ...
}

// 수정 후
if (!(creationData.scheduler_options as any)?.template_block_set_id && blockSetId) {
  // ...
}
```

#### 수정 2: PlanType 타입 에러
`plan_type: "camp"`에 `as const`를 추가하여 리터럴 타입으로 추론되도록 수정했습니다.

```typescript
// 수정 전
const updateData = {
  ...creationData,
  plan_type: "camp",
  camp_template_id: invitation.camp_template_id,
  camp_invitation_id: invitationId,
};

// 수정 후
const updateData = {
  ...creationData,
  plan_type: "camp" as const,
  camp_template_id: invitation.camp_template_id,
  camp_invitation_id: invitationId,
};
```

같은 수정을 `planGroupData`에도 적용했습니다.

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `SchedulerOptions` 타입은 `lib/types/plan.ts`에 정의되어 있으며, `template_block_set_id`는 타입 정의에 포함되어 있지 않습니다.
- 코드의 다른 부분(554번 라인)에서는 이미 `(creationData.scheduler_options as any).template_block_set_id`를 사용하고 있었습니다.
- `template_block_set_id`는 캠프 템플릿의 블록 세트 ID를 저장하기 위한 동적 속성입니다.
- 향후 `SchedulerOptions` 타입에 `template_block_set_id?: string`을 추가하는 것을 고려할 수 있습니다.
- `PlanType`은 `lib/types/plan.ts`에 `"individual" | "integrated" | "camp"`로 정의되어 있습니다.
- `as const`를 사용하면 TypeScript가 리터럴 타입으로 추론하여 타입 안전성을 보장합니다.

