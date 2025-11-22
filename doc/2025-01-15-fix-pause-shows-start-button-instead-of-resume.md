# 일시정지 후 시작하기 버튼 표시 오류 수정

## 📋 문제 상황

일시정지를 누르면 재시작 버튼이 아니라 시작하기 버튼이 표시되는 문제가 발생했습니다.

## 🔍 원인 분석

### 문제점

1. **세션 데이터 전달 지연**: `pausePlan` 액션 실행 후 `revalidatePath`가 호출되어 페이지가 다시 렌더링되지만, 세션 데이터가 즉시 업데이트되지 않음
2. **Optimistic Update 부재**: `PlanItem` 컴포넌트에 optimistic update 로직이 없어서 서버 응답 전까지 UI가 업데이트되지 않음
3. **세션 데이터 의존성**: `isPaused` 상태가 `plan.session?.isPaused`에만 의존하여, 세션 데이터가 없으면 일시정지 상태를 감지하지 못함

### 시나리오

1. 사용자가 일시정지 버튼 클릭
2. `pausePlan` 액션 실행 → `paused_at` 설정
3. `revalidatePath` 호출 → 페이지 재렌더링
4. 하지만 세션 데이터가 아직 업데이트되지 않아 `plan.session`이 undefined
5. `isPaused = plan.session?.isPaused ?? false` → false
6. `isRunning = !!plan.actual_start_time && !plan.actual_end_time && !plan.session?.isPaused` → false
7. `!isActive && !isPaused` 조건에 걸려 시작하기 버튼 표시

## ✅ 해결 방법

### PlanItem 컴포넌트에 Optimistic Update 추가

**파일**: `app/(student)/today/_components/PlanItem.tsx`

**변경 사항**:
1. Optimistic 상태 관리 추가 (`optimisticIsPaused`, `optimisticIsActive`)
2. `useEffect`로 서버 상태와 동기화
3. 일시정지/재시작/시작 핸들러에서 optimistic 상태 즉시 업데이트

```typescript
// Optimistic 상태 관리 (서버 응답 전 즉시 UI 업데이트)
const [optimisticIsPaused, setOptimisticIsPaused] = useState<boolean | null>(null);
const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(null);

// props가 변경되면 optimistic 상태 초기화 (서버 상태와 동기화)
useEffect(() => {
  setOptimisticIsPaused(null);
  setOptimisticIsActive(null);
}, [plan.session?.isPaused, plan.actual_start_time, plan.actual_end_time]);

// Optimistic 상태가 있으면 우선 사용, 없으면 props 사용
const isPausedState = optimisticIsPaused !== null ? optimisticIsPaused : (plan.session?.isPaused ?? false);
const isActiveState = optimisticIsActive !== null ? optimisticIsActive : (!!plan.actual_start_time && !plan.actual_end_time);

const isRunning = isActiveState && !isPausedState;
const isPaused = isPausedState;
```

### 핸들러에 Optimistic Update 적용

```typescript
const handlePause = async () => {
  // Optimistic 상태 즉시 업데이트 (UI 반응성 향상)
  setOptimisticIsPaused(true);
  setOptimisticIsActive(false);
  
  setIsLoading(true);
  try {
    const timestamp = new Date().toISOString();
    const result = await pausePlan(plan.id, timestamp);
    if (result.success) {
      // 서버 상태는 자동 동기화됨
    } else {
      // 실패 시 optimistic 상태 롤백
      setOptimisticIsPaused(null);
      setOptimisticIsActive(null);
      alert(result.error || "플랜 일시정지에 실패했습니다.");
    }
  } catch (error) {
    // 실패 시 optimistic 상태 롤백
    setOptimisticIsPaused(null);
    setOptimisticIsActive(null);
    alert("오류가 발생했습니다.");
  } finally {
    setIsLoading(false);
  }
};

const handleResume = async () => {
  // Optimistic 상태 즉시 업데이트
  setOptimisticIsPaused(false);
  setOptimisticIsActive(true);
  
  // ... 나머지 로직
};
```

## 🎯 수정 효과

### 수정 전
- 일시정지 버튼 클릭 → 서버 응답 대기 → 세션 데이터 업데이트 대기 → 시작하기 버튼 표시
- 사용자가 혼란스러워함

### 수정 후
- 일시정지 버튼 클릭 → 즉시 재시작 버튼 표시 (optimistic update)
- 서버 응답 후 실제 상태와 동기화
- 사용자 경험 향상

## 📌 Optimistic Update 동작 방식

1. **사용자 액션**: 일시정지/재시작/시작 버튼 클릭
2. **즉시 UI 업데이트**: Optimistic 상태로 버튼 즉시 변경
3. **서버 동기화**: 백그라운드에서 서버 액션 실행
4. **상태 동기화**: `useEffect`로 서버 상태와 optimistic 상태 동기화
5. **롤백**: 실패 시 optimistic 상태 롤백

## ✅ 테스트 시나리오

1. ✅ 플랜 시작 → 시작하기 버튼이 즉시 일시정지 버튼으로 변경
2. ✅ 일시정지 → 일시정지 버튼이 즉시 재시작 버튼으로 변경
3. ✅ 재시작 → 재시작 버튼이 즉시 일시정지 버튼으로 변경
4. ✅ 서버 응답 실패 시 → 이전 상태로 롤백

