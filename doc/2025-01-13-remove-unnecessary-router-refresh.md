# 작업 일지: 불필요한 router.refresh() 제거

## 날짜
2025-01-13

## 문제 상황

사용자가 지적한 문제:
- 단일뷰에서는 하나의 플랜 그룹만 보이는데, 왜 다른 플랜의 상태를 업데이트해야 하는가?
- `router.refresh()`가 전체 페이지를 새로고침하여 불필요한 딜레이 발생

## 원인 분석

1. **불필요한 전체 페이지 새로고침**
   - 타이머 버튼 클릭 시마다 `router.refresh()` 호출
   - 전체 페이지 데이터를 다시 가져옴
   - 단일뷰에서는 현재 플랜 그룹만 보이므로 불필요

2. **서버 액션에서 이미 캐시 무효화**
   - `startPlan`, `pausePlan`, `resumePlan` 등에서 `revalidatePath("/today")` 호출
   - 캐시는 이미 무효화되어 있음
   - `router.refresh()`는 중복 작업

3. **Optimistic Update로 즉시 반응**
   - 클라이언트에서 타임스탬프 생성 및 즉시 UI 업데이트
   - 서버 응답 후 props 업데이트로 자동 동기화
   - `router.refresh()` 없이도 충분

## 해결 방법

### 1. router.refresh() 제거
타이머 버튼 클릭 성공 시 `router.refresh()` 제거:

```typescript
// Before
if (result.success) {
  startTransition(() => {
    router.refresh();
  });
  setIsLoading(false);
}

// After
if (result.success) {
  // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
  // Optimistic Update로 즉시 UI 반응, 서버 상태는 자동 동기화됨
  setIsLoading(false);
}
```

### 2. 에러 발생 시에만 refresh
에러 발생 시에만 상태 동기화를 위해 `router.refresh()` 호출:

```typescript
if (criticalErrors.length > 0) {
  alert(`일시정지에 실패했습니다: ${errorMessages}`);
  setIsLoading(false);
  // 에러 발생 시에만 상태 동기화를 위해 refresh
  startTransition(() => {
    router.refresh();
  });
} else {
  // 성공 시에는 refresh 불필요
  setIsLoading(false);
}
```

## 📝 변경 사항

### 파일
- `app/(student)/today/_components/PlanGroupCard.tsx`
  - `handleGroupStart`: 성공 시 `router.refresh()` 제거
  - `handleGroupPause`: 성공 시 `router.refresh()` 제거
  - `handleGroupResume`: 성공 시 `router.refresh()` 제거
  - 에러 발생 시에만 `router.refresh()` 호출

- `app/(student)/today/_components/PlanItem.tsx`
  - `handleStart`: `router.refresh()` 제거
  - `handlePause`: `router.refresh()` 제거
  - `handleResume`: `router.refresh()` 제거

- `app/(student)/today/_components/PlanTimerCard.tsx`
  - `handleStart`: `router.refresh()` 제거
  - `handlePause`: `router.refresh()` 제거
  - `handleResume`: `router.refresh()` 제거

## 🎯 효과

### 성능 개선
- **딜레이 제거**: 불필요한 전체 페이지 새로고침 제거로 즉시 반응
- **네트워크 부하 감소**: 전체 페이지 데이터를 다시 가져오지 않음
- **서버 부하 감소**: 불필요한 데이터베이스 쿼리 제거

### 사용자 경험 개선
- **즉시 반응**: Optimistic Update로 버튼 클릭 시 즉시 UI 업데이트
- **자동 동기화**: 서버 액션의 `revalidatePath`로 다음 페이지 로드 시 최신 데이터 표시
- **에러 처리**: 에러 발생 시에만 상태 동기화를 위해 refresh

## 참고사항

### router.refresh()가 여전히 필요한 경우
1. **에러 발생 시**: 상태 동기화를 위해 필요
2. **완료 처리**: 다른 페이지로 이동하므로 필요
3. **메모/범위 조정**: 다른 데이터 변경이므로 필요

### 서버 액션의 revalidatePath
- `startPlan`, `pausePlan`, `resumePlan`에서 `revalidatePath("/today")` 호출
- 캐시는 이미 무효화되어 있음
- 다음 페이지 로드 시 최신 데이터 표시

### Optimistic Update
- 클라이언트에서 타임스탬프 생성 및 즉시 UI 업데이트
- 서버 응답 후 props 업데이트로 자동 동기화
- `router.refresh()` 없이도 충분

