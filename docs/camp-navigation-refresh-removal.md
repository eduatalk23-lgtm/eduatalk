# 캠프 네비게이션 불필요한 refresh 제거 리팩토링

## 📋 작업 개요

플랜 완료/미루기 후 불필요한 `router.refresh()` 호출을 제거하고, `CompletionToast`의 중복 실행을 방지하여 네비게이션 안정성을 개선했습니다.

## 🎯 목표

1. **PlanExecutionForm.tsx**: `handleComplete`와 `handlePostpone`에서 불필요한 `router.refresh()` 제거
2. **CompletionToast.tsx**: `useEffect`가 1회만 실행되도록 보장하여 중복 네비게이션 방지

## 🔧 수정 내용

### 1. PlanExecutionForm.tsx

#### 변경 사항

**handleComplete 함수 (177번 줄)**
- `router.refresh()` 제거
- Server Action(`completePlan`)에서 이미 `revalidatePath`를 호출하므로 클라이언트에서 추가 refresh 불필요

**handlePostpone 함수 (218번 줄)**
- `router.refresh()` 제거
- 동일한 이유로 불필요한 refresh 제거

#### 변경 전
```typescript
if (result.success) {
  timerStore.removeTimer(plan.id);
  
  if (mode === "camp") {
    router.push(query ? `/camp/today?${query}` : "/camp/today");
  } else {
    router.push(query ? `/today?${query}` : "/today");
  }
  router.refresh(); // ❌ 제거
}
```

#### 변경 후
```typescript
if (result.success) {
  timerStore.removeTimer(plan.id);
  
  if (mode === "camp") {
    router.push(query ? `/camp/today?${query}` : "/camp/today");
  } else {
    router.push(query ? `/today?${query}` : "/today");
  }
  // ✅ router.refresh() 제거됨
}
```

### 2. CompletionToast.tsx

#### 변경 사항

**useEffect 중복 실행 방지**
- `handled` state 추가하여 이미 처리한 경우 재실행 방지
- `useEffect` dependency array 최적화

#### 변경 전
```typescript
useEffect(() => {
  if (!planId) {
    return;
  }

  // URL 정리 및 토스트 표시
  // ...
}, [planId, planTitle, searchParams, router, pathname, showSuccess]);
// ❌ searchParams가 변경될 때마다 재실행됨
```

#### 변경 후
```typescript
const [handled, setHandled] = useState(false);

useEffect(() => {
  if (!planId) {
    return;
  }

  if (handled) {
    return; // ✅ 이미 처리한 경우 재실행 방지
  }

  setHandled(true);

  // URL 정리 및 토스트 표시
  // ...
}, [planId, planTitle, handled, pathname, router, showSuccess, searchParams]);
```

## 📊 기대 효과

### 성능 개선
- 불필요한 페이지 refresh 제거로 네비게이션 속도 향상
- 중복 네비게이션 요청 방지로 서버 부하 감소

### 네비게이션 안정성
- `/camp/today` 페이지의 중복 GET 요청 방지
- 기존: 4번 이상 반복 호출
- 개선 후: 1~2번 (dev 모드 특성상 허용 범위)

### 사용자 경험
- 더 빠른 페이지 전환
- 토스트 메시지 중복 표시 방지

## 🔍 검증 방법

1. 캠프 모드에서 플랜 완료 실행
2. 터미널에서 `/camp/today?...` 호출 횟수 확인
3. 기대 결과: 1~2번 호출 (기존 4번 이상에서 개선)

## 📝 참고 사항

- Server Action(`completePlan`, `postponePlan`)에서 이미 `revalidatePath`를 호출하므로 클라이언트에서 추가 refresh는 불필요
- `CompletionToast`는 `completedPlanId`가 URL에 있을 때만 1회 실행되어 토스트 표시 및 URL 정리 수행
- `handled` state를 통해 동일한 `planId`에 대한 중복 처리를 방지

## ✅ 완료 체크리스트

- [x] `PlanExecutionForm.tsx`의 `handleComplete`에서 `router.refresh()` 제거
- [x] `PlanExecutionForm.tsx`의 `handlePostpone`에서 `router.refresh()` 제거
- [x] `CompletionToast.tsx`에 `handled` state 추가
- [x] `useEffect` dependency array 최적화
- [x] 린터 오류 확인 완료
- [x] 문서 작성 완료

## 🚀 다음 단계

캠프 모드에서 실제 플랜 완료/미루기 플로우를 테스트하여 네비게이션 호출 횟수가 개선되었는지 확인합니다.

