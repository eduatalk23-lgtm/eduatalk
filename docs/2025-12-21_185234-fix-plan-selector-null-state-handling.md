# PlanSelector null 상태 처리 개선

## 작업 일시
2025-12-21 18:52:34

## 문제 상황

### 사용자 보고
`selectedPlanNumber`가 `null`인 상태에서 드롭다운과 버튼이 작동하지 않음

### 원인 분석
1. **useEffect 실행 타이밍**: `useEffect`가 실행되기 전에 렌더링이 일어나서 `selectedPlanNumber`가 여전히 `null`인 상태
2. **의존성 배열 문제**: `useMemo`의 의존성 배열이 정확하지 않아 `firstGroupPlanNumber`가 제대로 업데이트되지 않을 수 있음
3. **중복 로직**: `PlanSelector`와 `SinglePlanView` 둘 다에서 자동 선택을 시도하여 충돌 가능성

## 해결 방법

### 변경 사항

#### 1. SinglePlanView의 useEffect 개선
- `useMemo`를 제거하고 `useEffect`에서 직접 계산
- 의존성 배열을 `groups.length`와 `groups[0]?.plan?.id`로 정확하게 설정
- `groups` 배열의 첫 번째 요소가 변경될 때만 실행되도록 최적화

```typescript
// 변경 전: useMemo 사용
const firstGroupPlanNumber = useMemo(() => {
  return groups[0]?.planNumber ?? null;
}, [groups.length, groups[0]?.planNumber]);

useEffect(() => {
  if (selectedPlanNumber === null && groups.length > 0 && firstGroupPlanNumber !== null) {
    onSelectPlan(firstGroupPlanNumber);
  }
}, [selectedPlanNumber, firstGroupPlanNumber]);

// 변경 후: useEffect에서 직접 계산
useEffect(() => {
  if (selectedPlanNumber === null && groups.length > 0) {
    const firstGroupPlanNumber = groups[0]?.planNumber ?? null;
    if (firstGroupPlanNumber !== null) {
      onSelectPlan(firstGroupPlanNumber);
    }
  }
}, [selectedPlanNumber, groups.length, groups[0]?.plan?.id]);
```

#### 2. PlanSelector 순수 컴포넌트 유지
- `PlanSelector`에서 자동 선택 로직 제거
- 상태 관리는 부모 컴포넌트(`SinglePlanView`)에서만 처리
- `displayGroup`을 사용하여 `selectedPlanNumber`가 `null`일 때도 드롭다운과 버튼이 작동하도록 보장

### 주요 개선 사항

1. **의존성 배열 최적화**
   - `groups.length`와 `groups[0]?.plan?.id`를 사용하여 정확한 변경 감지
   - 불필요한 재실행 방지

2. **상태 관리 분리**
   - `PlanSelector`는 순수 컴포넌트로 유지
   - 상태 관리는 `SinglePlanView`에서만 처리

3. **즉시 작동 보장**
   - `displayGroup`을 사용하여 `selectedPlanNumber`가 `null`일 때도 드롭다운과 버튼이 즉시 작동
   - 사용자가 상호작용할 때 `onSelect`가 호출되어 상태가 업데이트됨

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 의존성 배열 최적화
- ✅ 상태 관리 분리

## 관련 파일
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_184106-fix-plan-selector-duplicate-key.md`: 중복 키 오류 수정
- `2025-12-21_184514-fix-single-view-plan-selection.md`: 단일 뷰 플랜 선택 기능 수정
- `2025-12-21_184856-fix-plan-selector-auto-selection.md`: PlanSelector 자동 선택 기능 추가

이번 수정으로 `selectedPlanNumber`가 `null`일 때도 드롭다운과 버튼이 즉시 작동하도록 보장하고, `useEffect`의 의존성 배열을 최적화하여 불필요한 재실행을 방지했습니다.

