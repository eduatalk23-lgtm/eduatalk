# 단일 뷰 네비게이션 완전 수정

## 작업 일시
2025-12-21 19:32:34

## 문제 상황

### 사용자 보고
- 상세 보기는 개선되었지만 단일 뷰에서 드롭다운이나 이동 버튼이 여전히 작동하지 않음

### 근본 원인
1. **PlanSelector에서 planNumber만 전달**: `handlePrevious`, `handleNext`, `onChange`에서 `planNumber`만 전달하여 `planNumber`가 `null`인 그룹을 처리할 수 없음
2. **handleSelectPlan의 한계**: `planNumber`로 그룹을 찾는데, `planNumber`가 `null`이면 찾을 수 없음
3. **planId 기반 선택 부재**: 드롭다운과 버튼에서 `plan.id`를 직접 전달할 수 있는 메커니즘이 없음

## 해결 방법

### 핵심 변경 사항

#### 1. onSelectById 추가
- `plan.id` 기반 선택을 위한 새로운 핸들러 추가
- `PlanSelector`에서 `onSelectById`가 있으면 우선 사용

```typescript
type PlanSelectorProps = {
  // ...
  onSelectById?: (planId: string) => void; // plan.id 기반 선택 (우선 사용)
};
```

#### 2. handlePrevious/handleNext에서 onSelectById 우선 사용
- `onSelectById`가 있으면 `plan.id`로 선택
- 없으면 기존처럼 `planNumber`로 선택 (하위 호환성)

```typescript
const handlePrevious = () => {
  if (currentIndex > 0 && currentIndex < groups.length) {
    const prevGroup = groups[currentIndex - 1];
    if (prevGroup) {
      // onSelectById가 있으면 planId로 선택, 없으면 planNumber로 선택
      if (onSelectById) {
        onSelectById(prevGroup.plan.id);
      } else {
        onSelect(prevGroup.planNumber);
      }
    }
  }
};
```

#### 3. onChange에서 onSelectById 우선 사용
- 드롭다운에서도 `onSelectById`가 있으면 `plan.id`로 선택

```typescript
onChange={(e) => {
  const selectedPlanId = e.target.value;
  const selectedGroup = groups.find((g) => g.plan.id === selectedPlanId);
  if (selectedGroup) {
    // onSelectById가 있으면 planId로 선택, 없으면 planNumber로 선택
    if (onSelectById) {
      onSelectById(selectedPlanId);
    } else {
      onSelect(selectedGroup.planNumber);
    }
  }
}}
```

#### 4. handleSelectPlanById 추가
- `plan.id`로 그룹을 찾아서 `planNumber`와 `planId` 모두 설정
- `planNumber`가 `null`인 경우도 처리 가능

```typescript
const handleSelectPlanById = useCallback((planId: string) => {
  // plan.id로 그룹을 찾아서 planNumber와 planId 모두 설정
  const selectedGroup = groups.find((g) => g.plan.id === planId);
  if (selectedGroup) {
    const planNumber = selectedGroup.planNumber;
    lastUserSelectedPlanNumber.current = planNumber;
    lastUserSelectedPlanId.current = planId;
    setSelectedPlanNumber(planNumber);
    setSelectedPlanId(planId);
  }
}, [groups]);
```

#### 5. SinglePlanView에서 onSelectPlanById 전달
- `PlanSelector`에 `onSelectPlanById` 전달

```typescript
<PlanSelector
  groups={groups}
  selectedPlanNumber={selectedPlanNumber}
  selectedPlanId={selectedPlanId}
  onSelect={onSelectPlan}
  onSelectById={onSelectPlanById} // plan.id 기반 선택
  sessions={sessions}
/>
```

### 주요 개선 사항

1. **plan.id 기반 선택 완전 구현**
   - 드롭다운과 버튼에서 `plan.id`를 직접 전달
   - `planNumber`가 `null`인 그룹도 정확하게 선택

2. **하위 호환성 유지**
   - `onSelectById`가 없으면 기존처럼 `planNumber`로 선택
   - 기존 코드와의 호환성 유지

3. **정확한 그룹 식별**
   - `plan.id`로 항상 유니크한 식별자 보장
   - `planNumber`가 `null`인 경우도 처리 가능

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 드롭다운 정상 작동
- ✅ 이전/다음 버튼 정상 작동
- ✅ planNumber가 null인 그룹도 정확하게 선택

## 관련 파일
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanViewContainer.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_192927-fix-plan-id-based-selection-complete.md`: plan.id 기반 선택 완전 구현

이번 수정으로 단일 뷰에서 드롭다운과 이동 버튼이 `plan.id` 기반으로 정확하게 작동하도록 완전히 수정했습니다.

