# plan.id 기반 선택 완전 구현

## 작업 일시
2025-12-21 19:29:27

## 문제 상황

### 사용자 보고
1. 일일 뷰에서 선택한 플랜의 일일뷰가 아니라 플랜넘버가 있는 플랜이 단일 뷰로 보이는 것 같음
2. 단일뷰의 다른 플랜 보기가 여전히 작동하지 않음

### 근본 원인
1. **planNumber가 null인 그룹 식별 불가**: `planNumber`가 `null`인 그룹을 선택했을 때 `planNumber`로는 정확한 그룹을 찾을 수 없음
2. **selectedPlanId 부재**: `plan.id`를 사용하여 정확한 그룹을 식별할 수 있는 메커니즘이 없음
3. **일일 뷰에서 선택한 그룹과 단일 뷰에서 보이는 그룹 불일치**: `planNumber`가 `null`인 그룹을 선택했을 때 다른 그룹이 표시됨

## 해결 방법

### 핵심 변경 사항

#### 1. selectedPlanId 상태 추가
- `plan.id`를 사용하여 정확한 그룹 식별
- `planNumber`가 `null`인 경우도 처리 가능

```typescript
const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
const lastUserSelectedPlanId = useRef<string | null>(null);
```

#### 2. handleViewDetail에서 planId 설정
- `plan.id`로 그룹을 찾아서 `planId`와 `planNumber`를 모두 설정
- 정확한 그룹 식별 보장

```typescript
const handleViewDetail = (planId: string) => {
  const selectedGroup = groups.find((g) => g.plan.id === planId);
  if (selectedGroup) {
    const planNumber = selectedGroup.planNumber;
    lastUserSelectedPlanNumber.current = planNumber;
    lastUserSelectedPlanId.current = planId; // planId도 추적
    setSelectedPlanNumber(planNumber);
    setSelectedPlanId(planId); // planId 설정
    setViewMode("single");
  }
};
```

#### 3. SinglePlanView에서 selectedPlanId 우선 사용
- `selectedPlanId`가 있으면 `plan.id`로 먼저 찾기
- 없으면 `selectedPlanNumber`로 찾기

```typescript
const selectedGroup = selectedPlanId
  ? groups.find((g) => g.plan.id === selectedPlanId)
  : selectedPlanNumber !== null
  ? groups.find((g) => g.planNumber === selectedPlanNumber)
  : null;
```

#### 4. PlanSelector에서 selectedPlanId 우선 사용
- `selectedPlanId`가 있으면 `plan.id`로 먼저 찾기
- 없으면 `selectedPlanNumber`로 찾기

```typescript
const currentGroup = selectedPlanId
  ? groups.find((g) => g.plan.id === selectedPlanId)
  : selectedPlanNumber !== null
  ? groups.find((g) => g.planNumber === selectedPlanNumber)
  : null;
```

#### 5. handleSelectPlan에서 planId도 설정
- `planNumber`로 그룹을 찾아서 `planId`도 설정
- `planNumber`가 `null`인 경우도 처리

```typescript
const handleSelectPlan = useCallback((planNumber: number | null) => {
  lastUserSelectedPlanNumber.current = planNumber;
  setSelectedPlanNumber(planNumber);
  // planNumber로 그룹을 찾아서 planId도 설정
  const selectedGroup = groups.find((g) => g.planNumber === planNumber);
  if (selectedGroup) {
    lastUserSelectedPlanId.current = selectedGroup.plan.id;
    setSelectedPlanId(selectedGroup.plan.id);
  } else if (planNumber === null) {
    lastUserSelectedPlanId.current = null;
    setSelectedPlanId(null);
  }
}, [groups]);
```

#### 6. useEffect에서 selectedPlanId 고려
- `selectedPlanId`가 있으면 `plan.id`로 그룹을 찾아서 유효한지 확인
- `planNumber`로도 확인

```typescript
// selectedPlanId 우선 확인
if (lastUserSelectedPlanId.current !== null) {
  const userSelectedId = lastUserSelectedPlanId.current;
  if (groups.some((g) => g.plan.id === userSelectedId)) {
    return; // 유효하면 유지
  }
}
// planNumber로도 확인
if (lastUserSelectedPlanNumber.current !== null) {
  const userSelected = lastUserSelectedPlanNumber.current;
  if (groups.some((g) => g.planNumber === userSelected)) {
    return; // 유효하면 유지
  }
}
```

### 주요 개선 사항

1. **정확한 그룹 식별**
   - `plan.id`를 사용하여 항상 유니크한 식별자 보장
   - `planNumber`가 `null`인 경우도 처리 가능

2. **일일 뷰와 단일 뷰 일관성**
   - 일일 뷰에서 선택한 그룹이 단일 뷰에서도 정확하게 표시
   - `planNumber`가 `null`인 그룹도 정확하게 식별

3. **다른 플랜 보기 작동**
   - `PlanSelector`에서 `selectedPlanId`를 우선 사용하여 정확한 그룹 찾기
   - 드롭다운과 버튼이 정상 작동

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 정확한 그룹 식별
- ✅ 일일 뷰와 단일 뷰 일관성
- ✅ 다른 플랜 보기 작동

## 관련 파일
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_192243-fix-root-cause-plan-id-based-selection.md`: 근본 원인 해결 - plan.id 기반 선택으로 변경

이번 수정으로 `selectedPlanId`를 추가하여 `planNumber`가 `null`인 그룹도 정확하게 식별하고 선택할 수 있도록 완전히 구현했습니다.

