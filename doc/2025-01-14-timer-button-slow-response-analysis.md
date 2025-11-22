# 타이머 버튼 클릭 시 서버 응답이 느린 이유 분석

## 📋 문제 상황

타이머 버튼(시작/일시정지/재개)을 누를 때마다 서버 응답이 느리고, 로딩이 오래 걸립니다.

## 🔍 원인 분석

### 1. 중복된 revalidatePath 호출 ⚠️

**문제**: 같은 경로를 여러 번 재검증하고 있습니다.

```typescript
// startPlan 함수 (todayActions.ts:80)
revalidatePath("/today");

// startStudySession 함수 내부 (studySessionActions.ts:90)
revalidatePath("/today"); // 중복 호출!
```

**영향**:

- 불필요한 서버 컴포넌트 재렌더링이 2번 발생
- 데이터베이스 쿼리가 중복 실행

### 2. 서버 컴포넌트 전체 재렌더링 ⚠️⚠️

**문제**: `revalidatePath("/today")` 호출 시 `/today` 페이지의 모든 서버 컴포넌트가 다시 실행됩니다.

**실행되는 작업들**:

```typescript
// 1. TodayPlanList 서버 컴포넌트 재실행
const todayPlans = await getPlansForStudent({
  studentId: userId,
  planDate: todayDate,
}); // 전체 플랜 데이터 다시 조회

// 2. calculateTodayProgress 재실행
const todayProgress = await calculateTodayProgress(
  userId,
  tenantContext?.tenantId || null,
  displayDate
); // 무거운 계산 작업 다시 실행

// 3. 진행률 맵 조회
const progressMap = await fetchProgressMap(userId); // 진행률 데이터 다시 조회
```

**영향**:

- 버튼 클릭 한 번에 수백 개의 플랜 데이터를 다시 조회
- 복잡한 진행률 계산을 다시 수행
- 네트워크 왕복 시간 증가

### 3. 여러 번의 데이터베이스 쿼리 ⚠️

**startPlan 함수 실행 시**:

```typescript
// 1. 다른 활성 세션 확인
const { data: activeSessions } = await supabase
  .from("student_study_sessions")
  .select("plan_id")
  .eq("student_id", user.userId)
  .is("ended_at", null)
  .neq("plan_id", planId);

// 2. startStudySession 내부에서
//    - 기존 세션 확인 (또 다른 쿼리)
//    - 플랜 조회 (getPlanById)
//    - 세션 생성

// 3. 플랜 actual_start_time 업데이트
const { data: planData } = await supabase
  .from("student_plan")
  .select("actual_start_time")
  .eq("id", planId)
  .maybeSingle();

await supabase
  .from("student_plan")
  .update({ actual_start_time: startTime })
  .eq("id", planId);
```

**총 쿼리 수**: 최소 5-7개의 데이터베이스 쿼리

### 4. pausePlan/resumePlan의 추가 쿼리 ⚠️

**pausePlan 함수 실행 시**:

```typescript
// 1. 활성 세션 조회
const { data: activeSessions } = await supabase
  .from("student_study_sessions")
  .select("id, paused_at, resumed_at")
  .eq("plan_id", planId)
  .is("ended_at", null);

// 2. 세션 업데이트
await supabase
  .from("student_study_sessions")
  .update({ paused_at: pauseTimestamp })
  .eq("id", activeSession.id);

// 3. 플랜 pause_count 조회
const { data: planData } = await supabase
  .from("student_plan")
  .select("pause_count")
  .eq("id", planId)
  .maybeSingle();

// 4. 플랜 pause_count 업데이트
await supabase
  .from("student_plan")
  .update({ pause_count: currentPauseCount + 1 })
  .eq("id", planId);
```

**총 쿼리 수**: 4개의 데이터베이스 쿼리 + revalidatePath로 인한 전체 페이지 재조회

## 📊 성능 영향 요약

### 버튼 클릭 시 실행되는 작업

| 단계                      | 작업                      | 예상 시간      |
| ------------------------- | ------------------------- | -------------- |
| 1. 서버 액션 실행         | 데이터베이스 쿼리 (5-7개) | 100-300ms      |
| 2. revalidatePath 호출    | 캐시 무효화               | 즉시           |
| 3. 서버 컴포넌트 재렌더링 | 전체 플랜 데이터 조회     | 200-500ms      |
| 4. 진행률 계산            | calculateTodayProgress    | 100-300ms      |
| 5. 클라이언트 업데이트    | React 리렌더링            | 50-100ms       |
| **총합**                  |                           | **450-1200ms** |

### 느린 이유

1. **불필요한 전체 페이지 재조회**: 버튼 클릭 한 번에 수백 개의 플랜 데이터를 다시 조회
2. **중복 쿼리**: 같은 데이터를 여러 번 조회
3. **무거운 계산 작업**: 진행률 계산 등 복잡한 작업을 매번 재실행
4. **네트워크 왕복**: 여러 번의 데이터베이스 쿼리로 인한 지연

## 💡 해결 방안

### 1. 중복 revalidatePath 제거 ✅ (우선순위: 높음)

```typescript
// startStudySession에서 revalidatePath 제거
export async function startStudySession(planId?: string) {
  // ... 세션 생성 로직 ...

  // ❌ 제거: startPlan에서 이미 호출함
  // revalidatePath("/today");

  return { success: true, sessionId: result.sessionId };
}
```

### 2. 부분 재검증 (Partial Revalidation) 사용 ✅ (우선순위: 높음)

Next.js 15의 `revalidateTag` 또는 더 구체적인 경로 지정:

```typescript
// ❌ 현재: 전체 페이지 재검증
revalidatePath("/today");

// ✅ 개선: 특정 데이터만 재검증
revalidatePath("/today", "page");
// 또는 React Query를 사용하여 클라이언트 캐시만 업데이트
```

### 3. Optimistic Update 강화 ✅ (우선순위: 중간)

현재 Optimistic Update가 있지만, 서버 동기화가 완료될 때까지 기다리는 문제:

```typescript
// ✅ 개선: startTransition 사용하여 백그라운드 처리
import { startTransition } from "react";

const handleStart = () => {
  // 즉시 UI 업데이트
  setOptimisticIsActive(true);

  // 서버 동기화는 백그라운드에서 처리
  startTransition(() => {
    onStart(timestamp);
  });
};
```

### 4. 데이터베이스 쿼리 최적화 ✅ (우선순위: 중간)

```typescript
// ❌ 현재: 여러 번의 쿼리
const { data: planData } = await supabase
  .from("student_plan")
  .select("pause_count")
  .eq("id", planId)
  .maybeSingle();

const currentPauseCount = planData?.pause_count || 0;
await supabase
  .from("student_plan")
  .update({ pause_count: currentPauseCount + 1 })
  .eq("id", planId);

// ✅ 개선: 한 번의 쿼리로 조회 및 업데이트
await supabase.rpc("increment_pause_count", { plan_id: planId });
```

### 5. 클라이언트 캐싱 활용 ✅ (우선순위: 낮음)

React Query를 사용하여 서버 응답을 캐싱하고, 필요한 부분만 업데이트:

```typescript
// 서버 액션 대신 React Query Mutation 사용
const { mutate } = useMutation({
  mutationFn: startPlan,
  onSuccess: () => {
    // 특정 쿼리만 무효화
    queryClient.invalidateQueries({ queryKey: ["plans", planId] });
  },
});
```

## 🎯 권장 해결 순서

1. **즉시 적용 가능** (성능 향상: 20-30%) ✅ **완료**

   - ✅ 중복 `revalidatePath` 제거
   - ✅ `startTransition` 사용하여 백그라운드 처리

2. **단기 개선** (성능 향상: 30-50%) ✅ **부분 완료**

   - ✅ 데이터베이스 쿼리 최적화 (pause_count RPC 함수 사용)
   - ⏳ 부분 재검증 적용 (추후 진행)

3. **장기 개선** (성능 향상: 50-70%) ⏳ **예정**
   - ⏳ React Query 도입
   - ⏳ 서버 컴포넌트 최적화 (Suspense, Streaming)

## 📝 결론

타이머 버튼이 느린 주요 원인:

1. ✅ **중복된 revalidatePath 호출** → 불필요한 재렌더링
2. ✅ **전체 페이지 재조회** → 수백 개의 플랜 데이터를 매번 조회
3. ✅ **여러 번의 데이터베이스 쿼리** → 네트워크 지연 누적
4. ✅ **무거운 계산 작업 재실행** → 진행률 계산 등

**가장 빠른 개선 방법**: 중복 `revalidatePath` 제거 + `startTransition` 사용

## ✅ 완료된 개선 사항

### 1. 중복 revalidatePath 제거 ✅

- `startStudySession` 함수에서 중복된 `revalidatePath("/today")` 호출 제거
- `startPlan`에서만 재검증하도록 변경

### 2. startTransition 적용 ✅

- `TimeCheckSection`의 `onStart`, `onPause`, `onResume` 핸들러에 `startTransition` 적용
- `PlanGroupCard`의 `handleGroupStart`에 `startTransition` 적용
- 서버 동기화를 백그라운드에서 처리하여 UI 반응성 향상

### 3. pause_count 업데이트 최적화 ✅

- RPC 함수 `increment_pause_count` 생성
- 2번의 쿼리(조회 + 업데이트)를 1번의 RPC 호출로 최적화
- Migration 파일: `20250114000000_create_increment_pause_count_function.sql`

### 4. actual_start_time 업데이트 최적화 ✅

- `startPlan`에서 `actual_start_time` 조회 쿼리 제거
- `UPDATE ... WHERE actual_start_time IS NULL`로 직접 업데이트
- 1번의 쿼리(조회) 제거로 성능 향상

### 5. 활성 세션 조회 최적화 ✅

- `pausePlan`과 `resumePlan`에서 활성 세션 조회 최적화
- 배열 조회 대신 `limit(1).maybeSingle()` 사용
- 불필요한 데이터 전송 감소 및 네트워크 트래픽 최적화

### 예상 성능 개선

- **즉시 적용 가능 항목**: 20-30% 성능 향상
- **쿼리 최적화**: 추가 15-25% 성능 향상
- **총 예상 개선**: 35-55% 성능 향상
