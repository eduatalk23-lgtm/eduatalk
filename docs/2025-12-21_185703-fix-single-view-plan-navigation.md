# 단일 뷰 플랜 이동 기능 근본 수정

## 작업 일시
2025-12-21 18:57:03

## 문제 상황

### 사용자 보고
단일 뷰에서 같은 날의 다른 플랜으로 이동하는 기능이 계속 작동하지 않음

### 근본 원인 분석
1. **PlanViewContainer의 useEffect 충돌**: `groups`가 변경될 때마다 `selectedPlanNumber`를 리셋하여 사용자 선택을 덮어쓰고 있었음
2. **상태 동기화 문제**: `groups`는 `useMemo`로 계산되지만 `plansData?.plans`가 변경될 때마다 재생성되어, 같은 데이터라도 참조가 달라질 수 있음
3. **자동 선택 로직 충돌**: `PlanViewContainer`와 `SinglePlanView` 둘 다에서 자동 선택을 시도하여 충돌 발생

### 문제가 있던 코드
```typescript
// PlanViewContainer.tsx
useEffect(() => {
  if (!plansData) return;
  // ...
  if (groups.length > 0) {
    setSelectedPlanNumber((prev) => {
      if (prev != null && groups.some((g) => g.planNumber === prev)) {
        return prev;
      }
      return groups[0]?.planNumber ?? null; // 항상 첫 번째로 리셋
    });
  }
}, [plansData, onDateChange, groups]); // groups가 변경될 때마다 실행
```

## 해결 방법

### 핵심 변경 사항

#### 1. 사용자 선택 추적 추가
- `useRef`를 사용하여 사용자가 마지막으로 선택한 `planNumber` 추적
- 같은 날짜 내에서 `groups`가 변경되어도 사용자 선택 유지

```typescript
// 사용자가 마지막으로 선택한 planNumber 추적 (같은 날짜 내에서 유지)
const lastUserSelectedPlanNumber = useRef<number | null>(null);
const lastPlanDate = useRef<string>(initialPlanDate || getTodayISODate());
```

#### 2. planDate 변경 감지 및 처리
- `planDate`가 변경되었을 때만 `selectedPlanNumber`를 리셋
- 같은 날짜 내에서는 사용자 선택 유지

```typescript
// groups가 변경되었을 때 selectedPlanNumber 업데이트
useEffect(() => {
  // planDate가 변경되었는지 확인
  const isPlanDateChanged = planDate !== lastPlanDate.current;
  if (isPlanDateChanged) {
    lastPlanDate.current = planDate;
    lastUserSelectedPlanNumber.current = null;
    setSelectedPlanNumber(groups[0]?.planNumber ?? null);
    return;
  }
  
  // 같은 날짜 내에서 groups가 변경된 경우
  // 사용자 선택이 유효하면 유지
  // ...
}, [groups, planDate]);
```

#### 3. 사용자 선택 핸들러 개선
- `handleSelectPlan`을 `useCallback`으로 메모이제이션
- 사용자 선택을 `lastUserSelectedPlanNumber.current`에 저장

```typescript
const handleSelectPlan = useCallback((planNumber: number | null) => {
  lastUserSelectedPlanNumber.current = planNumber; // 사용자 선택 추적
  setSelectedPlanNumber(planNumber);
}, []);
```

#### 4. SinglePlanView 자동 선택 로직 유지
- `selectedPlanNumber`가 `null`일 때만 자동 선택
- 사용자가 선택한 경우에는 개입하지 않음

### 주요 개선 사항

1. **사용자 선택 우선순위**
   - 사용자가 선택한 `planNumber`가 최우선
   - 같은 날짜 내에서 `groups`가 변경되어도 사용자 선택 유지

2. **날짜 변경 감지**
   - `planDate`가 변경되었을 때만 `selectedPlanNumber` 리셋
   - `useRef`를 사용하여 이전 날짜 추적

3. **상태 동기화 개선**
   - `groups` 변경 시 사용자 선택이 유효한지 확인
   - 유효하지 않을 때만 첫 번째 그룹으로 변경

4. **의존성 배열 최적화**
   - `groups`와 `planDate`를 의존성으로 사용
   - 불필요한 재실행 방지

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 사용자 선택 우선순위 보장
- ✅ 날짜 변경 시 올바른 리셋
- ✅ 같은 날짜 내에서 플랜 이동 정상 작동

## 관련 파일
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_184106-fix-plan-selector-duplicate-key.md`: 중복 키 오류 수정
- `2025-12-21_184514-fix-single-view-plan-selection.md`: 단일 뷰 플랜 선택 기능 수정
- `2025-12-21_184856-fix-plan-selector-auto-selection.md`: PlanSelector 자동 선택 기능 추가
- `2025-12-21_185234-fix-plan-selector-null-state-handling.md`: PlanSelector null 상태 처리 개선

이번 수정으로 단일 뷰에서 같은 날의 다른 플랜으로 이동하는 기능이 근본적으로 해결되었습니다. 사용자가 선택한 플랜이 `groups`가 변경되어도 유지되며, 날짜가 변경되었을 때만 첫 번째 플랜으로 리셋됩니다.

