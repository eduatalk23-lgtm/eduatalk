# 단일 뷰 플랜 이동 기능 디버깅

## 작업 일시
2025-12-21 19:07:02

## 문제 상황

### 사용자 보고
드롭다운 클릭 시, 이전/다음 버튼 클릭 시 모두 반응이 없음

### 디버깅 접근
1. **콘솔 로그 추가**: `onSelect` 호출 여부 확인
2. **useEffect 실행 방지**: `groupsKey`가 실제로 변경되었을 때만 실행
3. **사용자 선택 보호 강화**: 사용자 선택이 유효하면 절대 덮어쓰지 않음

## 해결 방법

### 핵심 변경 사항

#### 1. 디버깅 로그 추가
- `handleSelectPlan`에 콘솔 로그 추가
- `PlanSelector`의 `handlePrevious`, `handleNext`, `onChange`에 콘솔 로그 추가
- `useEffect`에 콘솔 로그 추가

```typescript
const handleSelectPlan = useCallback((planNumber: number | null) => {
  console.log("handleSelectPlan called with:", planNumber);
  lastUserSelectedPlanNumber.current = planNumber;
  setSelectedPlanNumber(planNumber);
}, []);

const handlePrevious = () => {
  if (currentIndex > 0 && currentIndex < groups.length) {
    const prevPlanNumber = groups[currentIndex - 1].planNumber;
    console.log("handlePrevious called, selecting:", prevPlanNumber);
    onSelect(prevPlanNumber);
  }
};
```

#### 2. groupsKey 변경 감지 개선
- `prevGroupsKey`를 사용하여 실제 변경만 감지
- 변경되지 않았으면 `useEffect` 실행하지 않음

```typescript
const prevGroupsKey = useRef<string>("");

useEffect(() => {
  // groupsKey가 실제로 변경되었는지 확인
  if (groupsKey === prevGroupsKey.current) {
    return; // 변경되지 않았으면 실행하지 않음
  }
  prevGroupsKey.current = groupsKey;
  // ...
}, [groupsKey, planDate]);
```

#### 3. 사용자 선택 보호 강화
- 사용자 선택이 유효하면 절대 덮어쓰지 않음
- 콘솔 로그로 사용자 선택 상태 확인

```typescript
// 사용자 선택이 있으면 절대 덮어쓰지 않음
if (lastUserSelectedPlanNumber.current !== null) {
  const userSelected = lastUserSelectedPlanNumber.current;
  if (groups.some((g) => g.planNumber === userSelected)) {
    console.log("User selection is valid, keeping it:", userSelected);
    return; // 사용자 선택이 유효하면 아무것도 하지 않음
  }
}
```

### 주요 개선 사항

1. **디버깅 로그 추가**
   - 모든 핸들러에 콘솔 로그 추가
   - `useEffect` 실행 시 로그 추가
   - 사용자 선택 상태 확인

2. **실제 변경만 감지**
   - `prevGroupsKey`를 사용하여 실제 변경만 감지
   - 불필요한 `useEffect` 실행 방지

3. **사용자 선택 보호**
   - 사용자 선택이 유효하면 절대 덮어쓰지 않음
   - 콘솔 로그로 상태 확인

## 검증 방법
브라우저 콘솔에서 다음 로그를 확인:
1. `handleSelectPlan called with: [planNumber]` - 핸들러 호출 확인
2. `handlePrevious called, selecting: [planNumber]` - 이전 버튼 클릭 확인
3. `handleNext called, selecting: [planNumber]` - 다음 버튼 클릭 확인
4. `select onChange called, selecting: [planNumber]` - 드롭다운 변경 확인
5. `useEffect triggered, groupsKey changed` - useEffect 실행 확인
6. `User selection is valid, keeping it: [planNumber]` - 사용자 선택 보호 확인

## 관련 파일
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_185703-fix-single-view-plan-navigation.md`: 단일 뷰 플랜 이동 기능 근본 수정
- `2025-12-21_190011-fix-single-view-plan-navigation-v2.md`: 단일 뷰 플랜 이동 기능 재수정
- `2025-12-21_190340-fix-single-view-plan-navigation-v3.md`: 단일 뷰 플랜 이동 기능 최종 수정

이번 수정으로 디버깅 로그를 추가하여 문제를 추적할 수 있도록 했습니다. 브라우저 콘솔에서 로그를 확인하여 어느 단계에서 문제가 발생하는지 파악할 수 있습니다.

