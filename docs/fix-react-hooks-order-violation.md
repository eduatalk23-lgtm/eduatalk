# React Hooks 순서 위반 오류 수정

## 문제

`Step6FinalReview.tsx` 컴포넌트에서 React Hooks 규칙 위반 오류가 발생했습니다.

### 오류 내용

```
React has detected a change in the order of Hooks called by Step6FinalReview.
This will lead to bugs and errors if not fixed.
```

### 원인

940-1304번째 줄에 있는 IIFE (즉시 실행 함수) 내부에서 조건부로 `useMemo` Hook을 호출하여 Hooks 순서가 변경되었습니다.

**문제 코드 구조:**
```typescript
{(() => {
  const scheduleSummaryState = useMemo(...); // 항상 호출
  if (조건) return null; // 조건부 early return
  const learningVolumeSummary = useMemo(...); // 조건부 호출 ❌
  return <JSX>;
})()}
```

## 해결 방법

### 1. Hook을 컴포넌트 최상위로 이동

- `scheduleSummaryState` useMemo를 컴포넌트 최상위로 이동
- `learningVolumeSummary` useMemo를 컴포넌트 최상위로 이동
- 두 Hook 모두 항상 호출되도록 보장

### 2. IIFE 제거 및 조건부 렌더링 분리

- IIFE를 제거하고 일반 JSX 조건부 렌더링으로 변경
- `scheduleSummaryState.type`에 따른 조건부 렌더링은 Hook 호출 후에 처리
- `learningVolumeSummary` 계산 결과는 항상 메모이제이션되지만, 렌더링은 조건부로 처리

### 3. 변경 사항

**변경 전:**
```typescript
{(() => {
  const state = useMemo(...);
  if (조건) return null;
  const summary = useMemo(...); // 조건부 호출 ❌
  return <JSX>;
})()}
```

**변경 후:**
```typescript
// 컴포넌트 최상위
const scheduleSummaryState = useMemo(...);
const learningVolumeSummary = useMemo(...);

// 렌더링 부분
{scheduleSummaryState?.type === 'loading' && <LoadingUI />}
{scheduleSummaryState?.type === 'ready' && learningVolumeSummary && <SummaryUI data={learningVolumeSummary} />}
```

## 수정된 파일

- `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`
  - 940-1304번째 줄의 IIFE 제거
  - Hook을 컴포넌트 최상위로 이동 (890번째 줄 이후)
  - 조건부 렌더링 로직을 Hook 호출 후로 이동

## 결과

- 모든 Hook이 컴포넌트 최상위에서 항상 같은 순서로 호출됨
- React Hooks 규칙 준수
- 기존 로직과 동일한 결과 보장
- Lint 오류 없음

## 참고

- [React Hooks 규칙](https://react.dev/link/rules-of-hooks)
- Hooks는 항상 같은 순서로 호출되어야 하며, 조건문, 반복문, 중첩 함수 내부에서 호출하면 안 됩니다.

