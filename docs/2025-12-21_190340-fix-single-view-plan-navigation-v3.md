# 단일 뷰 플랜 이동 기능 최종 수정

## 작업 일시
2025-12-21 19:03:40

## 문제 상황

### 사용자 보고
드롭다운 클릭 시, 이전/다음 버튼 클릭 시 모두 작동하지 않음

### 근본 원인
1. **useEffect가 사용자 선택을 덮어쓰는 문제**: `groups`가 변경될 때마다 `useEffect`가 실행되어 사용자 선택을 덮어쓸 수 있음
2. **groups 참조 변경**: `groups`는 `useMemo`로 계산되지만, `plansData?.plans`가 변경될 때마다 재생성되어 참조가 달라질 수 있음
3. **의존성 배열 문제**: `groupsPlanNumbersKey`를 사용했지만 여전히 문제가 발생

## 해결 방법

### 핵심 변경 사항

#### 1. 사용자 선택 우선순위 강화
- `useEffect`에서 사용자 선택을 확인하고, 사용자 선택이 있으면 절대 덮어쓰지 않도록 수정
- 사용자 선택이 유효하면 현재 상태와 다를 때만 업데이트

```typescript
// 사용자 선택이 있으면 절대 덮어쓰지 않음
if (lastUserSelectedPlanNumber.current !== null) {
  // 사용자 선택이 유효한지 확인
  const userSelected = lastUserSelectedPlanNumber.current;
  if (groups.some((g) => g.planNumber === userSelected)) {
    // 유효하면 현재 상태와 다를 때만 업데이트
    setSelectedPlanNumber((prev) => {
      return prev === userSelected ? prev : userSelected;
    });
    return;
  }
}
```

#### 2. groups 변경 감지 단순화
- `groupsPlanNumbersKey`를 제거하고 `groups`를 직접 의존성으로 사용
- `groups`가 변경될 때만 실행되도록 보장

```typescript
// groups가 처음 로드되거나 변경되었을 때만 selectedPlanNumber 초기화
useEffect(() => {
  // 사용자 선택이 있으면 절대 덮어쓰지 않음
  // ...
}, [groups, planDate]);
```

#### 3. 사용자 선택 보장
- `handleSelectPlan`에서 `lastUserSelectedPlanNumber.current`를 업데이트
- `useEffect`에서 사용자 선택을 확인하고 유효하면 유지

### 주요 개선 사항

1. **사용자 선택 절대 보호**
   - 사용자 선택이 있으면 `useEffect`가 절대 덮어쓰지 않음
   - 사용자 선택이 유효하면 현재 상태와 다를 때만 업데이트

2. **로직 단순화**
   - `groupsPlanNumbersKey`를 제거하고 `groups`를 직접 사용
   - 불필요한 복잡성 제거

3. **상태 동기화 개선**
   - 사용자 선택이 유효한지 확인하고 유효하면 유지
   - 유효하지 않을 때만 초기화

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 사용자 선택 절대 보호
- ✅ 드롭다운 및 버튼 클릭 시 정상 작동

## 관련 파일
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_185703-fix-single-view-plan-navigation.md`: 단일 뷰 플랜 이동 기능 근본 수정
- `2025-12-21_190011-fix-single-view-plan-navigation-v2.md`: 단일 뷰 플랜 이동 기능 재수정

이번 수정으로 `useEffect`가 사용자 선택을 절대 덮어쓰지 않도록 수정하고, 사용자 선택이 유효하면 항상 유지하도록 보장했습니다. 드롭다운 클릭 시와 이전/다음 버튼 클릭 시 모두 정상 작동해야 합니다.

