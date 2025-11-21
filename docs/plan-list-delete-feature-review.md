# 플랜 목록 삭제 기능 및 상태 관리 개선

## 📋 구현 완료 사항

### 1. 삭제 기능 추가
- ✅ 플랜 목록 페이지에 삭제 버튼 추가
- ✅ 삭제 확인 Dialog 컴포넌트 생성 (shadcn/ui 패턴)
- ✅ 상태별 삭제 권한 체크 (`PlanStatusManager.canDelete`)
- ✅ Toast 알림 시스템 통합

### 2. UI/UX 개선
- ✅ Dialog 기반 삭제 확인 (alert 대신)
- ✅ Toast를 통한 성공/실패 알림
- ✅ 로딩 상태 표시 (삭제 중...)
- ✅ 삭제 버튼 스타일링 (빨간색 강조)

### 3. 상태 관리 개선
- ✅ ToastProvider를 통한 전역 Toast 관리
- ✅ 클라이언트에서 router.push로 리다이렉트 처리
- ✅ 서버 액션에서 redirect 제거 (클라이언트 제어)

## 🔍 현재 상태 관리 구조

### 기존 방식
```typescript
// 서버 액션에서 redirect 호출
async function _deletePlanGroup(groupId: string): Promise<void> {
  // ... 삭제 로직
  revalidatePath("/plan");
  redirect("/plan"); // 서버에서 리다이렉트
}
```

### 개선된 방식
```typescript
// 서버 액션: redirect 제거
async function _deletePlanGroup(groupId: string): Promise<void> {
  // ... 삭제 로직
  revalidatePath("/plan");
  // redirect는 클라이언트에서 처리
}

// 클라이언트: Dialog에서 제어
const handleDelete = () => {
  startTransition(async () => {
    try {
      await deletePlanGroupAction(groupId);
      toast.showSuccess("플랜 그룹이 삭제되었습니다.");
      onOpenChange(false);
      router.push("/plan");
      router.refresh();
    } catch (error) {
      toast.showError(error.message);
    }
  });
};
```

## 🚀 추가 개선 방향

### 1. Optimistic Update 구현 (권장)

현재는 삭제 완료 후 페이지를 새로고침하여 목록을 갱신합니다. React Query를 도입하여 Optimistic Update를 구현하면 즉각적인 UI 반응을 제공할 수 있습니다.

#### 구현 방법

```typescript
// hooks/usePlanGroups.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";

export function usePlanGroups(filters: PlanGroupFilters) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ["planGroups", filters],
    queryFn: () => getPlanGroupsForStudent(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => deletePlanGroupAction(groupId),
    onMutate: async (groupId) => {
      // Optimistic Update: 즉시 UI에서 제거
      await queryClient.cancelQueries({ queryKey: ["planGroups"] });
      const previousGroups = queryClient.getQueryData(["planGroups", filters]);
      
      queryClient.setQueryData(["planGroups", filters], (old: PlanGroup[]) => {
        return old?.filter(group => group.id !== groupId) ?? [];
      });
      
      return { previousGroups };
    },
    onError: (err, groupId, context) => {
      // 실패 시 이전 상태로 롤백
      queryClient.setQueryData(["planGroups", filters], context?.previousGroups);
    },
    onSettled: () => {
      // 성공/실패 여부와 관계없이 최신 데이터 가져오기
      queryClient.invalidateQueries({ queryKey: ["planGroups"] });
    },
  });

  return {
    ...query,
    deleteGroup: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
```

#### 장점
- 즉각적인 UI 반응 (네트워크 지연 없음)
- 더 나은 사용자 경험
- 서버 응답을 기다리지 않음

#### 단점
- React Query 도입 필요
- 서버 액션을 mutation으로 래핑 필요
- 에러 처리 복잡도 증가

### 2. 부분 새로고침 (Partial Refresh)

현재는 전체 페이지를 새로고침합니다. React Query 없이도 부분 새로고침을 구현할 수 있습니다.

```typescript
// PlanGroupList 컴포넌트
const [groups, setGroups] = useState<PlanGroup[]>(initialGroups);

const handleDeleteSuccess = (deletedGroupId: string) => {
  // 로컬 상태에서 제거
  setGroups(prev => prev.filter(group => group.id !== deletedGroupId));
  
  // Toast 알림
  toast.showSuccess("플랜 그룹이 삭제되었습니다.");
  
  // 서버 상태와 동기화 (선택적)
  router.refresh();
};
```

### 3. 에러 핸들링 개선

현재는 try-catch로 에러를 처리합니다. 더 세밀한 에러 처리를 추가할 수 있습니다.

```typescript
const handleDelete = async () => {
  try {
    await deletePlanGroupAction(groupId);
    // 성공 처리
  } catch (error) {
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.NOT_FOUND:
          toast.showError("플랜 그룹을 찾을 수 없습니다.");
          break;
        case ErrorCode.VALIDATION_ERROR:
          toast.showError("삭제할 수 없는 상태입니다.");
          break;
        default:
          toast.showError("삭제에 실패했습니다.");
      }
    } else {
      toast.showError("예상치 못한 오류가 발생했습니다.");
    }
  }
};
```

### 4. 다중 선택 삭제 (향후 기능)

여러 플랜 그룹을 한 번에 삭제할 수 있는 기능을 추가할 수 있습니다.

```typescript
const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

const handleBulkDelete = async () => {
  const promises = Array.from(selectedGroups).map(groupId =>
    deletePlanGroupAction(groupId)
  );
  
  try {
    await Promise.all(promises);
    toast.showSuccess(`${selectedGroups.size}개의 플랜 그룹이 삭제되었습니다.`);
    setSelectedGroups(new Set());
    router.refresh();
  } catch (error) {
    toast.showError("일부 플랜 그룹 삭제에 실패했습니다.");
  }
};
```

### 5. Undo 기능 (향후 기능)

삭제 후 일정 시간 내에 되돌릴 수 있는 기능을 추가할 수 있습니다.

```typescript
const [deletedGroup, setDeletedGroup] = useState<PlanGroup | null>(null);

const handleDelete = async () => {
  const group = groups.find(g => g.id === groupId);
  await deletePlanGroupAction(groupId);
  
  setDeletedGroup(group);
  toast.showSuccess("플랜 그룹이 삭제되었습니다.", {
    action: {
      label: "되돌리기",
      onClick: () => handleUndo(group),
    },
  });
};
```

## 📊 상태 관리 비교

| 방식 | 즉각성 | 복잡도 | 권장도 |
|------|--------|--------|--------|
| 현재 방식 (전체 새로고침) | 낮음 | 낮음 | ⭐⭐⭐ |
| 부분 새로고침 | 중간 | 중간 | ⭐⭐⭐⭐ |
| Optimistic Update | 높음 | 높음 | ⭐⭐⭐⭐⭐ |

## ✅ 권장 사항

### 단기 (현재 구현)
- ✅ Dialog 기반 삭제 확인
- ✅ Toast 알림 시스템
- ✅ 상태별 권한 체크

### 중기 (추가 개선)
1. **부분 새로고침**: 전체 페이지 새로고침 대신 로컬 상태 업데이트
2. **에러 핸들링 개선**: 더 세밀한 에러 메시지 제공
3. **로딩 상태 개선**: 스켈레톤 UI 또는 개별 아이템 로딩 표시

### 장기 (React Query 도입 후)
1. **Optimistic Update**: 즉각적인 UI 반응
2. **캐싱 전략**: 서버 요청 최소화
3. **무한 스크롤**: 많은 플랜 그룹 처리

## 🔧 기술적 고려사항

### React Query 도입 시
1. **QueryClientProvider 설정**: root layout에 추가
2. **서버 액션 래핑**: mutation 함수로 변환
3. **캐시 키 관리**: 일관된 키 네이밍
4. **에러 바운더리**: React Query 에러 처리

### 성능 최적화
1. **메모이제이션**: 불필요한 리렌더링 방지
2. **가상화**: 많은 항목 처리 시 (react-window)
3. **Lazy Loading**: 초기 로딩 시간 단축

## 📝 결론

현재 구현된 삭제 기능은 기본적인 요구사항을 충족합니다. 사용자 경험을 더욱 향상시키기 위해서는:

1. **단기**: 부분 새로고침 구현 (추가 작업 최소화)
2. **중기**: React Query 도입 검토 (상태 관리 일원화)
3. **장기**: Optimistic Update 및 고급 기능 추가

현재 구조는 유지보수하기 쉽고, 점진적인 개선이 가능합니다.

