# 작업 일지: 플랜 일시정지 중복 호출 문제 수정

## 날짜
2025-01-13

## 문제 상황
터미널 로그에서 다음과 같은 문제가 발견되었습니다:

1. **중복 호출**: 같은 플랜에 대해 일시정지가 여러 번 호출됨
2. **활성 세션 조회 불일치**: 첫 번째 호출에서는 세션이 발견되지만, 두 번째 호출에서는 세션이 없음
3. **plan_id 불일치**: 다른 플랜의 활성 세션이 발견됨

### 로그 예시
```
[pausePlan] 플랜 3481603b-8ace-432f-9c79-47dd6af31298 일시정지 시도
[pausePlan] 활성 세션 조회 결과: 세션 ID: 8b743e6b-96d9-4307-952d-04660edb792c (총 1개)
[pausePlan] 플랜 3481603b-8ace-432f-9c79-47dd6af31298 일시정지 시도
[pausePlan] 활성 세션 조회 결과: 세션 없음
[pausePlan] plan_id 없는 활성 세션 확인: { id: 'fd2f2bcc-62cc-47e6-8509-f507fc694dcc', plan_id: '1122ca9f-441c-418c-97c7-4a45a273c881' }
```

## 원인 분석

1. **중복 호출 문제**:
   - `PlanGroupCard`의 `handleGroupPause`에서 여러 플랜을 동시에 일시정지하는데, 같은 플랜이 중복으로 포함될 수 있음
   - `isLoading` 상태가 제대로 관리되지 않아 빠른 연속 클릭이 가능
   - 여러 컴포넌트에서 동시에 `pausePlan`을 호출할 수 있음

2. **세션 조회 불일치**:
   - 첫 번째 호출에서 세션이 일시정지되어 `paused_at`이 설정됨
   - 두 번째 호출 시점에 세션이 종료되었거나 다른 상태로 변경됨
   - `plan_id`가 없는 세션을 확인하는 로직에서 다른 플랜의 세션이 발견됨

## 해결 방법

### 1. `pausePlan` 함수 개선

- 세션 조회 로직 개선: 일시정지된 세션도 포함하여 조회
- 에러 메시지 개선: "이미 일시정지된 상태입니다" 메시지 추가
- 로깅 개선: 더 상세한 디버깅 정보 제공

```typescript
// 이미 일시정지된 상태인지 확인
if (activeSession.paused_at && !activeSession.resumed_at) {
  console.log(`[pausePlan] 이미 일시정지된 상태입니다. 세션 ID: ${activeSession.id}`);
  return { success: false, error: "이미 일시정지된 상태입니다." };
}
```

### 2. `PlanGroupCard`의 `handleGroupPause` 개선

- 중복 호출 방지: `isLoading` 상태 확인
- 중복 플랜 필터링: `Array.from(new Set(...))` 사용
- 에러 처리 개선: "이미 일시정지된 상태입니다" 에러는 무시

```typescript
const handleGroupPause = async () => {
  // 이미 로딩 중이면 중복 호출 방지
  if (isLoading) {
    console.log("[PlanGroupCard] 이미 일시정지 처리 중입니다.");
    return;
  }

  // 중복 제거 및 이미 일시정지된 플랜 제외
  const activePlanIds = Array.from(
    new Set(
      group.plans
        .filter(
          (plan) =>
            plan.actual_start_time &&
            !plan.actual_end_time &&
            (!sessions.get(plan.id)?.isPaused)
        )
        .map((plan) => plan.id)
    )
  );
  
  // "이미 일시정지된 상태입니다" 에러는 무시
  const criticalErrors = failedResults.filter(
    (r) => r.error && !r.error.includes("이미 일시정지된 상태입니다")
  );
}
```

### 3. 다른 컴포넌트에도 중복 호출 방지 추가

- `PlanItem`: `isLoading` 또는 `isPaused` 상태 확인
- `PlanTimerCard`: `isLoading` 또는 `isPaused` 상태 확인
- `ActiveLearningWidget`: `isLoading` 또는 `isPaused` 상태 확인

```typescript
const handlePause = async () => {
  // 이미 로딩 중이거나 일시정지된 상태면 중복 호출 방지
  if (isLoading || isPaused) {
    return;
  }
  // ...
};
```

## 📝 변경 사항

### 파일
- `app/(student)/today/actions/todayActions.ts`
  - `pausePlan` 함수의 세션 조회 로직 개선
  - 에러 메시지 및 로깅 개선

- `app/(student)/today/_components/PlanGroupCard.tsx`
  - `handleGroupPause`에서 중복 호출 방지 추가
  - 중복 플랜 필터링 강화
  - 에러 처리 개선

- `app/(student)/today/_components/PlanItem.tsx`
  - `handlePause`에서 중복 호출 방지 추가

- `app/(student)/today/_components/PlanTimerCard.tsx`
  - `handlePause`에서 중복 호출 방지 추가

- `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`
  - `handlePause`에서 중복 호출 방지 추가

## 🎯 효과

### 중복 호출 방지
- `isLoading` 상태를 확인하여 동시에 여러 번 호출되는 것을 방지
- 이미 일시정지된 상태인지 확인하여 불필요한 호출 방지

### 에러 처리 개선
- "이미 일시정지된 상태입니다" 에러는 무시하여 사용자 경험 개선
- 더 상세한 로깅으로 디버깅 용이

### 세션 조회 로직 개선
- 일시정지된 세션도 포함하여 조회하여 상태 확인 정확도 향상
- `plan_id` 불일치 문제에 대한 경고 로그 추가

## 📅 작업 일자
2025-01-13

