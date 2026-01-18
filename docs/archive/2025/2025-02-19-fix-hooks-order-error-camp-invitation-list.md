# React Hooks 순서 오류 수정 - CampInvitationList

## 작업 일시
2025-02-19

## 문제 상황

`CampInvitationList` 컴포넌트에서 React Hooks 순서 변경 오류가 발생했습니다.

### 오류 메시지
```
React has detected a change in the order of Hooks called by CampInvitationList. 
This will lead to bugs and errors if not fixed.
```

### 원인 분석

컴포넌트 내에서 hooks 선언 순서가 다음과 같았습니다:

1. hooks 선언 (43-101줄): `useToast`, `useQueryClient`, `useTransition`, `useState`, `useMutation`
2. **early return** (107-117줄): `loading` 체크 및 `invitations.length === 0` 체크
3. `useEffect` (250줄): 필터 동기화

문제는 `useEffect`가 early return 이후에 선언되어 있어서, 조건부로 호출되지 않을 수 있었습니다. React의 Rules of Hooks에 따르면 **모든 hooks는 항상 같은 순서로 호출되어야 하며**, 조건문이나 early return 이후에 선언되면 안 됩니다.

## 해결 방법

### 변경 사항

`useEffect`를 early return 이전으로 이동하여 모든 hooks가 항상 같은 순서로 호출되도록 수정했습니다.

**변경 전:**
```typescript
// hooks 선언
const toast = useToast();
const queryClient = useQueryClient();
// ... 기타 hooks

if (loading) {
  return <div>...</div>; // early return
}

if (invitations.length === 0) {
  return <div>...</div>; // early return
}

// ... 나머지 코드

useEffect(() => {  // ❌ early return 이후에 선언
  setSearchInput(filters.search || "");
  setStatusInput(filters.status || "");
}, [filters]);
```

**변경 후:**
```typescript
// hooks 선언
const toast = useToast();
const queryClient = useQueryClient();
// ... 기타 hooks

// 필터 변경 시 입력값 동기화 (모든 hooks는 early return 전에 선언되어야 함)
useEffect(() => {  // ✅ early return 전에 선언
  setSearchInput(filters.search || "");
  setStatusInput(filters.status || "");
}, [filters]);

if (loading) {
  return <div>...</div>; // early return
}

if (invitations.length === 0) {
  return <div>...</div>; // early return
}
```

## 수정된 파일

- `app/(admin)/admin/camp-templates/[id]/CampInvitationList.tsx`

## 검증

- ✅ 린터 오류 없음
- ✅ 모든 hooks가 early return 전에 선언됨
- ✅ hooks 호출 순서가 일관되게 유지됨

## 참고

### React Rules of Hooks

1. **Hooks는 항상 최상위 레벨에서만 호출해야 합니다**
   - 조건문, 반복문, 중첩 함수 안에서 호출하면 안 됩니다

2. **Hooks는 항상 같은 순서로 호출되어야 합니다**
   - early return 이후에 hooks를 선언하면 안 됩니다
   - 조건부로 hooks를 호출하면 안 됩니다

3. **함수 컴포넌트 내에서만 호출해야 합니다**
   - 일반 JavaScript 함수에서는 호출하면 안 됩니다

## 관련 이슈

- React Hooks 규칙 위반으로 인한 런타임 오류 해결

