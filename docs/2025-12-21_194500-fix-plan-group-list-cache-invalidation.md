# 플랜 목록 페이지 캐시 무효화 개선

## 작업 일시
2025-12-21 19:45:00

## 문제점

플랜 목록 페이지에서 활성/비활성화나 삭제 액션 후에 페이지가 자동으로 새로고침되지 않아 변경사항이 반영되지 않는 문제가 있었습니다.

### 증상

1. **활성/비활성화 후**: 상태 변경 후에도 UI에 변경사항이 즉시 반영되지 않음
2. **삭제 후**: 플랜 그룹 삭제 후에도 목록에서 사라지지 않음
3. **수동 새로고침 필요**: 사용자가 브라우저를 새로고침해야 변경사항 확인 가능

### 원인

- `router.refresh()`만 호출하고 React Query 캐시를 무효화하지 않음
- React Query가 캐시된 데이터를 사용하여 UI가 업데이트되지 않음

## 해결 방법

### 1. React Query 캐시 무효화 추가

모든 액션 후에 `useQueryClient`를 사용하여 `planGroups` 쿼리 캐시를 무효화하도록 수정했습니다.

```typescript
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();

// 액션 후
await queryClient.invalidateQueries({
  queryKey: ["planGroups"],
});
```

### 2. 수정된 컴포넌트

#### PlanGroupListItem.tsx
- 활성/비활성화 토글 후 캐시 무효화 추가
- `useQueryClient` 훅 추가

```typescript
const queryClient = useQueryClient();

startTransition(async () => {
  try {
    await updatePlanGroupStatus(group.id, newStatus);
    toast.showSuccess(/* ... */);
    setToggleDialogOpen(false);
    // React Query 캐시 무효화
    await queryClient.invalidateQueries({
      queryKey: ["planGroups"],
    });
    router.refresh();
  } catch (error) {
    // ...
  }
});
```

#### PlanGroupDeleteDialog.tsx
- 삭제 후 캐시 무효화 추가
- `useQueryClient` 훅 추가

```typescript
const queryClient = useQueryClient();

startTransition(async () => {
  try {
    await deletePlanGroupAction(groupId);
    toast.showSuccess("플랜 그룹이 삭제되었습니다.");
    onOpenChange(false);
    // React Query 캐시 무효화
    await queryClient.invalidateQueries({
      queryKey: ["planGroups"],
    });
    router.push("/plan", { scroll: true });
    router.refresh();
  } catch (error) {
    // ...
  }
});
```

#### PlanGroupBulkDeleteDialog.tsx
- 일괄 삭제 후 캐시 무효화 추가
- `useQueryClient` 훅 추가

```typescript
const queryClient = useQueryClient();

startTransition(async () => {
  try {
    // 여러 플랜 그룹 삭제
    const results = await Promise.allSettled(/* ... */);
    // ...
    onOpenChange(false);
    // React Query 캐시 무효화
    await queryClient.invalidateQueries({
      queryKey: ["planGroups"],
    });
    router.push("/plan", { scroll: true });
    router.refresh();
  } catch (error) {
    // ...
  }
});
```

## 수정된 파일

- `app/(student)/plan/_components/PlanGroupListItem.tsx`
- `app/(student)/plan/_components/PlanGroupDeleteDialog.tsx`
- `app/(student)/plan/_components/PlanGroupBulkDeleteDialog.tsx`

## 결과

이제 다음과 같이 동작합니다:

1. **활성/비활성화**: 상태 변경 후 즉시 UI에 반영됨
2. **삭제**: 플랜 그룹 삭제 후 목록에서 즉시 제거됨
3. **일괄 삭제**: 여러 플랜 그룹 삭제 후 목록에서 즉시 제거됨
4. **자동 새로고침**: 수동 새로고침 없이도 변경사항 확인 가능

## 기술적 세부사항

### React Query 캐시 무효화

- `invalidateQueries`를 사용하여 `["planGroups"]` 쿼리 키를 가진 모든 쿼리 캐시를 무효화
- 무효화 후 React Query가 자동으로 데이터를 다시 가져옴
- `router.refresh()`와 함께 사용하여 서버 컴포넌트도 새로고침

### 쿼리 키 구조

```typescript
queryKey: [
  "planGroups",
  filters.studentId,
  filters.tenantId ?? null,
  filters.status ?? null,
  filters.planPurpose ?? null,
  filters.dateRange ?? null,
  filters.includeDeleted ?? false,
]
```

`["planGroups"]`로 무효화하면 모든 필터 조합의 쿼리가 무효화됩니다.




