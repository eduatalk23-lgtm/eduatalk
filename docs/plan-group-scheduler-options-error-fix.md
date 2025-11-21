# 플랜그룹 scheduler_options 컬럼 에러 처리 및 에러 핸들링 개선

## 문제 상황

플랜그룹 저장 시 `scheduler_options` 컬럼이 없다는 에러(PGRST204)가 발생했지만, 토스트 메시지는 "저장되었습니다"가 표시되는 문제가 있었습니다.

## 원인 분석

1. **컬럼 없음 에러 미처리**: `updatePlanGroup` 함수에서 `scheduler_options` 컬럼이 없을 때 PGRST204 에러가 발생했지만, 42703 에러만 처리하고 있어서 PGRST204 에러가 처리되지 않았습니다.

2. **에러 결과 미확인**: `_updatePlanGroupDraft` 함수에서 `updatePlanGroup`의 결과를 확인하지 않아서 에러가 발생해도 계속 진행되었습니다.

## 수정 내용

### 1. `updatePlanGroup` 함수 수정 (`lib/data/planGroups.ts`)

PGRST204 에러도 처리하도록 수정하고, `scheduler_options` 컬럼이 없을 때는 해당 필드를 제외하고 나머지 필드는 업데이트하도록 변경했습니다.

```typescript
// 수정 전
if (error && error.code === "42703") {
  ({ error } = await supabase
    .from("plan_groups")
    .update(payload)
    .eq("id", groupId));
}

// 수정 후
if (error && (error.code === "42703" || error.code === "PGRST204")) {
  // scheduler_options가 포함된 경우 제외하고 재시도
  if (payload.scheduler_options !== undefined) {
    const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
    ({ error } = await supabase
      .from("plan_groups")
      .update(fallbackPayload)
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null));
    
    // scheduler_options가 없어도 다른 필드는 업데이트 성공
    if (!error) {
      console.warn("[data/planGroups] scheduler_options 컬럼이 없어 해당 필드는 저장되지 않았습니다.");
      return { success: true };
    }
  }
  
  // 다른 컬럼 문제인 경우 일반 fallback
  ({ error } = await supabase
    .from("plan_groups")
    .update(payload)
    .eq("id", groupId));
}
```

### 2. `_updatePlanGroupDraft` 함수 수정 (`app/(student)/actions/planGroupActions.ts`)

`updatePlanGroup`의 결과를 확인하고, 실패 시 예외를 던지도록 수정했습니다.

```typescript
// 수정 전
await updatePlanGroup(groupId, user.userId, {
  // ...
});

// 수정 후
const updateResult = await updatePlanGroup(groupId, user.userId, {
  // ...
});

if (!updateResult.success) {
  throw new AppError(
    updateResult.error || "플랜 그룹 업데이트에 실패했습니다.",
    ErrorCode.DATABASE_ERROR,
    500,
    true
  );
}
```

### 3. 상태 업데이트 결과 확인 추가

`saved` 상태를 `draft`로 변경할 때도 결과를 확인하도록 수정했습니다.

```typescript
// 수정 전
if (group.status === "saved") {
  await updatePlanGroup(groupId, user.userId, { status: "draft" });
}

// 수정 후
if (group.status === "saved") {
  const statusUpdateResult = await updatePlanGroup(groupId, user.userId, { status: "draft" });
  if (!statusUpdateResult.success) {
    throw new AppError(
      statusUpdateResult.error || "플랜 그룹 상태 업데이트에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}
```

## 수정된 파일

- `lib/data/planGroups.ts`
- `app/(student)/actions/planGroupActions.ts`

## 동작 방식

1. **컬럼 없음 에러 처리**: `scheduler_options` 컬럼이 없을 때 PGRST204 에러가 발생하면, 해당 필드를 제외하고 나머지 필드는 업데이트합니다.
2. **에러 전파**: `updatePlanGroup`이 실패하면 예외를 던져서 호출하는 쪽에서 에러를 처리할 수 있도록 합니다.
3. **사용자 피드백**: 에러가 발생하면 토스트 메시지로 에러 메시지가 표시됩니다.

## 테스트 방법

1. `scheduler_options` 컬럼이 없는 데이터베이스에서 플랜그룹 저장 시도
2. 에러가 발생하면 토스트 메시지로 에러 메시지가 표시되는지 확인
3. 다른 필드들은 정상적으로 저장되는지 확인

## 참고사항

- `scheduler_options` 컬럼이 없는 경우, 해당 필드는 저장되지 않지만 다른 필드는 정상적으로 저장됩니다.
- 향후 마이그레이션으로 `scheduler_options` 컬럼을 추가하면 정상적으로 저장됩니다.

