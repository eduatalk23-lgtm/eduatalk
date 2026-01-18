# PlanSelector 자동 선택 기능 수정

## 작업 일시
2025-12-21 18:48:56

## 문제 상황

### 사용자 보고
단일 뷰에서 `PlanSelector`의 기능이 작동하지 않음
- `selectedPlanNumber`가 `null`인데도 첫 번째 플랜이 선택되어 보임
- 드롭다운이나 이전/다음 버튼이 제대로 작동하지 않음

### 원인 분석
1. **상태 불일치**: `selectedPlanNumber`가 `null`인데도 `PlanSelector`에서 첫 번째 그룹을 표시용으로 사용하고 있었음
2. **자동 선택 누락**: `selectedPlanNumber`가 `null`일 때 자동으로 첫 번째 그룹을 선택하는 로직이 없었음
3. **표시와 실제 상태 불일치**: `displayGroup`을 사용하여 표시는 하지만, 실제 `selectedPlanNumber`는 여전히 `null`인 상태

## 해결 방법

### 변경 사항

#### 1. SinglePlanView에 자동 선택 로직 추가
- `selectedPlanNumber`가 `null`이고 `groups`가 있으면 첫 번째 그룹을 자동으로 선택
- `useEffect`와 `useMemo`를 사용하여 최적화

```typescript
// 첫 번째 그룹의 planNumber 메모이제이션
const firstGroupPlanNumber = useMemo(() => {
  return groups[0]?.planNumber ?? null;
}, [groups]);

// selectedPlanNumber가 null이고 groups가 있으면 첫 번째 그룹 자동 선택
useEffect(() => {
  if (selectedPlanNumber === null && groups.length > 0 && firstGroupPlanNumber !== null) {
    onSelectPlan(firstGroupPlanNumber);
  }
}, [selectedPlanNumber, groups.length, firstGroupPlanNumber]);
```

#### 2. PlanSelector의 표시 로직 개선
- `currentGroup`과 `displayGroup`을 분리하여 명확하게 구분
- `selectedPlanNumber`가 `null`일 때도 올바르게 처리

```typescript
// 현재 선택된 그룹 찾기
const currentGroup = selectedPlanNumber !== null
  ? groups.find((g) => g.planNumber === selectedPlanNumber)
  : null;

// currentGroup이 없으면 첫 번째 그룹을 표시용으로 사용
const displayGroup = currentGroup || groups[0];
```

#### 3. PlanSelector props 정리
- `SinglePlanView`에서 `selectedPlanNumber ?? groups[0]?.planNumber ?? null` 대신 `selectedPlanNumber`를 직접 전달
- 자동 선택은 `useEffect`에서 처리하므로 props에서 처리할 필요 없음

### 주요 개선 사항

1. **자동 선택 기능**
   - `selectedPlanNumber`가 `null`일 때 자동으로 첫 번째 그룹 선택
   - `useMemo`를 사용하여 불필요한 재계산 방지

2. **상태 일관성**
   - 표시되는 그룹과 실제 선택된 그룹이 일치하도록 보장
   - `selectedPlanNumber`가 항상 유효한 값이 되도록 보장

3. **성능 최적화**
   - `useMemo`를 사용하여 첫 번째 그룹의 `planNumber` 메모이제이션
   - 의존성 배열 최적화로 불필요한 재실행 방지

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 자동 선택 기능 정상 작동
- ✅ 드롭다운 및 이전/다음 버튼 정상 작동
- ✅ 무한 루프 방지 (의존성 배열 최적화)

## 관련 파일
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_184106-fix-plan-selector-duplicate-key.md`: 중복 키 오류 수정
- `2025-12-21_184514-fix-single-view-plan-selection.md`: 단일 뷰 플랜 선택 기능 수정

이번 수정으로 `selectedPlanNumber`가 `null`일 때도 자동으로 첫 번째 그룹이 선택되어, 사용자가 즉시 플랜을 볼 수 있고 드롭다운이나 버튼으로 다른 플랜을 선택할 수 있습니다.

