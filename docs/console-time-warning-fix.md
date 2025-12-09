# console.time 중복 라벨 경고 수정

## 문제 상황

Next.js 개발 환경에서 다음과 같은 경고 메시지가 발생했습니다:

```
(node:43199) Warning: Label '[dashboard] render - page' already exists for console.time()
(node:43199) Warning: Label '[dashboard] data - overview' already exists for console.time()
(node:43199) Warning: Label '[todayPlans] total' already exists for console.time()
(node:43199) Warning: No such label '[todayPlans] total' for console.timeEnd()
```

## 원인 분석

1. **중복 라벨 문제**: 
   - `app/api/today/plans/route.ts`와 `lib/data/todayPlans.ts`에서 같은 라벨 `[todayPlans] total`로 `console.time`을 호출
   - API route가 `getTodayPlans` 함수를 호출하면 중첩된 타이머가 시작되어 경고 발생

2. **DashboardPage 중복 호출**:
   - Next.js 개발 모드에서 HMR(Hot Module Replacement)이나 React Strict Mode로 인해 컴포넌트가 여러 번 실행
   - 같은 라벨로 `perfTime`이 여러 번 호출되어 경고 발생

## 해결 방법

### 1. perfTime 함수 개선 (`lib/utils/perfLog.ts`)

타이머 상태를 추적하여 중복 라벨 호출을 방지하도록 개선했습니다:

- `activeTimers` Map을 사용하여 각 라벨의 활성 타이머 개수 추적
- 같은 라벨로 이미 시작된 타이머가 있으면 고유한 라벨 생성 (`${label}_${count}`)
- 타이머 종료 시 카운트 감소 및 정리

```typescript
const activeTimers = new Map<string, number>();

export function perfTime(label: string) {
  const activeCount = activeTimers.get(label) || 0;
  const uniqueLabel = activeCount > 0 
    ? `${label}_${activeCount + 1}`
    : label;
  
  activeTimers.set(label, activeCount + 1);
  // ... 타이머 시작 및 종료 로직
}
```

### 2. todayPlans.ts 수정 (`lib/data/todayPlans.ts`)

중복된 `console.time` 호출을 제거했습니다:

- 함수 시작 시 `console.time("[todayPlans] total")` 제거
- 캐시 히트 시 `console.timeEnd("[todayPlans] total")` 제거
- 함수 종료 시 `console.timeEnd("[todayPlans] total")` 제거

타이머 측정은 호출하는 쪽(API route)에서만 수행하도록 변경했습니다.

### 3. route.ts 수정 (`app/api/today/plans/route.ts`)

`console.time/timeEnd`를 `perfTime`으로 변경하여 일관성 유지:

- `perfTime` import 추가
- `console.time("[todayPlans] total")` → `const totalTimer = perfTime("[todayPlans] total")`
- `console.timeEnd("[todayPlans] total")` → `totalTimer.end()`
- 에러 처리 시에도 `totalTimer.end()` 호출 보장

## 수정된 파일

1. `lib/utils/perfLog.ts` - perfTime 함수 개선 (타이머 상태 추적)
2. `lib/data/todayPlans.ts` - 중복 console.time 제거
3. `app/api/today/plans/route.ts` - perfTime 사용으로 통일

## 결과

- 중복 라벨 경고 제거
- 타이머 측정 로직 일관성 유지
- 개발 환경에서도 깔끔한 콘솔 출력

## 참고

- `perfTime` 함수는 개발 모드(`NODE_ENV === "development"`) 또는 `NEXT_PUBLIC_PERF_DEBUG=true`일 때만 동작
- 프로덕션 환경에서는 성능 오버헤드 없음

