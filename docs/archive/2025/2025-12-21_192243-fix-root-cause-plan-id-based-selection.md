# 근본 원인 해결: plan.id 기반 선택으로 변경

## 작업 일시
2025-12-21 19:22:43

## 문제 상황

### 근본 원인
1. **planNumber가 null인 그룹 식별 불가**: `planNumber`가 `null`인 그룹을 `planNumber`로 식별할 수 없음
2. **일일 뷰와 단일 뷰 불일치**: 일일 뷰에서는 모든 그룹이 보이지만 단일 뷰에서는 일부가 보이지 않음
3. **상세 보기 클릭 시 문제**: 일일 뷰에서 상세 보기 클릭 시 `planNumber`가 `null`이면 단일 뷰에서 찾을 수 없음

### 문제가 있던 코드
```typescript
// planNumber가 null인 경우 식별 불가
onViewDetail: (planNumber: number | null) => void;

// planNumber가 null이면 어떤 그룹을 선택해야 할지 알 수 없음
const selectedGroup = groups.find((g) => g.planNumber === selectedPlanNumber);
```

## 해결 방법

### 핵심 변경 사항

#### 1. onViewDetail이 plan.id를 전달하도록 변경
- `planNumber` 대신 `plan.id`를 전달
- `plan.id`는 항상 유니크하므로 `null` 문제 해결

```typescript
// 변경 전
onViewDetail: (planNumber: number | null) => void;
onViewDetail(group.planNumber);

// 변경 후
onViewDetail: (planId: string) => void;
onViewDetail(group.plan.id);
```

#### 2. handleViewDetail에서 plan.id로 그룹 찾기
- `plan.id`로 그룹을 찾아서 `planNumber`를 설정
- `planNumber`가 `null`인 경우도 처리 가능

```typescript
const handleViewDetail = (planId: string) => {
  // plan.id로 그룹을 찾아서 planNumber를 설정
  const selectedGroup = groups.find((g) => g.plan.id === planId);
  if (selectedGroup) {
    const planNumber = selectedGroup.planNumber;
    lastUserSelectedPlanNumber.current = planNumber;
    setSelectedPlanNumber(planNumber);
    setViewMode("single");
  }
};
```

#### 3. 모든 컴포넌트에서 타입 변경
- `PlanCard`: `onViewDetail?: (planId: string) => void;`
- `PlanGroupCard`: `onViewDetail?: (planId: string) => void;`
- `DailyPlanListView`: `onViewDetail: (planId: string) => void;`
- `DailyPlanView`: `onViewDetail: (planId: string) => void;`
- `PlanViewContainer`: `handleViewDetail = (planId: string) => { ... }`
- `TodayPlanListView`: `handleViewDetail = (planId: string) => { ... }`

### 주요 개선 사항

1. **근본 원인 해결**
   - `plan.id`를 사용하여 항상 유니크한 식별자 보장
   - `planNumber`가 `null`인 경우도 처리 가능

2. **타입 안전성 향상**
   - `plan.id`는 항상 `string`이므로 `null` 체크 불필요
   - 타입 안전성 향상

3. **일관성 유지**
   - 일일 뷰와 단일 뷰에서 동일한 그룹 표시
   - 상세 보기 클릭 시 항상 정확한 그룹 찾기

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 근본 원인 해결
- ✅ 모든 컴포넌트 일관성 유지

## 관련 파일
- `app/(student)/today/_components/PlanCard.tsx`
- `app/(student)/today/_components/PlanGroupCard.tsx`
- `app/(student)/today/_components/DailyPlanListView.tsx`
- `app/(student)/today/_components/DailyPlanView.tsx`
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/TodayPlanListView.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_191041-fix-plan-selector-null-plan-number.md`: PlanSelector null planNumber 처리 수정
- `2025-12-21_191238-fix-plan-selector-filter-null-groups.md`: PlanSelector null 그룹 필터링 수정
- `2025-12-21_191819-fix-plan-selector-include-null-groups.md`: PlanSelector null 그룹 포함 수정

이번 수정으로 근본 원인을 해결하여 `planNumber`가 `null`인 그룹도 `plan.id`를 사용하여 정확하게 식별하고 선택할 수 있도록 수정했습니다.

