# SettingsPage Hooks 순서 오류 수정

## 작업 일시
2024년 11월 23일

## 문제 상황
`app/(student)/settings/page.tsx`에서 React Hooks 순서 변경 오류가 발생했습니다.

### 에러 메시지
```
React has detected a change in the order of Hooks called by SettingsPage. 
This will lead to bugs and errors if not fixed.
```

### 원인
- `setupProgress` useMemo가 조건부 early return (`if (loading)`) 이후에 호출됨
- `loading`이 `true`일 때는 early return으로 `setupProgress` useMemo가 호출되지 않음
- `loading`이 `false`가 되면 `setupProgress` useMemo가 호출됨
- 이로 인해 렌더링마다 Hook 호출 순서가 변경되어 React Hooks 규칙 위반

## 해결 방법
`setupProgress` useMemo를 조건부 early return 이전으로 이동하여 항상 같은 순서로 Hook이 호출되도록 수정했습니다.

### 변경 사항
```typescript
// 변경 전: early return 이후에 useMemo 호출
if (loading) {
  return <LoadingUI />;
}

const setupProgress = useMemo(() => {
  // ...
}, [isInitialSetup, formData]);

// 변경 후: early return 이전에 useMemo 호출
const setupProgress = useMemo(() => {
  // ...
}, [isInitialSetup, formData]);

if (loading) {
  return <LoadingUI />;
}
```

## 수정 파일
- `app/(student)/settings/page.tsx`

## 참고
- React Hooks 규칙: 모든 Hook은 항상 같은 순서로 호출되어야 함
- 조건부 렌더링이 있어도 Hook 호출은 조건부가 되어서는 안 됨
- Early return 전에 모든 Hook을 호출해야 함

