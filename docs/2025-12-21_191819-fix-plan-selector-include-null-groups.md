# PlanSelector null 그룹 포함 수정

## 작업 일시
2025-12-21 19:18:19

## 문제 상황

### 사용자 보고
1. 일일 뷰에서는 모든 플랜이 보임
2. 단일 뷰에서는 일일 뷰에서 보이는 모든 플랜을 볼 수 없음
3. 다른 플랜의 상세 보기 클릭 시 다른 플랜의 상세보기가 보임

### 근본 원인 분석

#### planNumber가 null인 이유
`groupPlansByPlanNumber` 함수에서:
- `is_partial === true` 또는 `is_continued === true`인 플랜만 `plan_number`로 그룹화
- 그 외의 플랜은 `individualPlans`로 분류되어 `planNumber: plan.plan_number ?? null`로 설정됨
- 즉, 분할되지 않은 플랜은 `plan_number`가 `null`일 수 있음

#### 문제점
1. **일일 뷰**: 모든 `groups`를 표시 (planNumber가 null이어도)
2. **단일 뷰**: `PlanSelector`가 `validGroups`로 필터링하여 `planNumber`가 `null`인 그룹 제외
3. **상세 보기**: 일일 뷰에서 "상세 보기" 클릭 시 `onViewDetail(group.planNumber)` 호출
   - `planNumber`가 `null`이면 단일 뷰에서 찾을 수 없음

## 해결 방법

### 핵심 변경 사항

#### 1. PlanSelector에서 모든 그룹 포함
- `validGroups` 필터링 제거
- 모든 `groups`를 드롭다운에 표시
- `planNumber`가 `null`인 그룹도 포함

```typescript
// 변경 전: validGroups로 필터링
const validGroups = groups.filter((g) => g.planNumber !== null);

// 변경 후: 모든 groups 사용
// 필터링 제거, 모든 그룹 포함
```

#### 2. currentGroup 찾기 개선
- `planNumber`로 먼저 찾고, 없으면 `plan.id`로 찾기
- `planNumber`가 `null`인 경우도 처리

```typescript
// 현재 선택된 그룹 찾기 (planNumber로 먼저 찾고, 없으면 plan.id로 찾기)
const currentGroup = selectedPlanNumber !== null
  ? groups.find((g) => g.planNumber === selectedPlanNumber)
  : groups.find((g) => g.plan.id === selectedPlanNumber?.toString());
```

#### 3. SinglePlanView에서 null 처리
- `selectedPlanNumber`가 `null`인 경우도 처리
- 첫 번째 그룹을 `displayGroup`으로 사용

```typescript
// selectedPlanNumber로 그룹 찾기 (planNumber가 null인 경우도 처리)
const selectedGroup = selectedPlanNumber !== null
  ? groups.find((g) => g.planNumber === selectedPlanNumber)
  : groups[0];

// selectedGroup이 없으면 첫 번째 그룹 사용
const displayGroup = selectedGroup || groups[0];
```

#### 4. PlanViewContainer에서 null 처리
- `planNumber`가 `null`인 그룹도 유효한 그룹으로 인식
- `useEffect`에서 `null` 처리 추가

```typescript
// planNumber가 null인 그룹도 유효한 그룹으로 인식
const isValidSelection = selectedPlanNumber === null 
  ? groups.length > 0  // null이면 그룹이 있으면 유효
  : groups.some((g) => g.planNumber === selectedPlanNumber);
```

### 주요 개선 사항

1. **모든 그룹 포함**
   - `planNumber`가 `null`인 그룹도 드롭다운에 표시
   - 일일 뷰와 단일 뷰의 일관성 유지

2. **null 처리 개선**
   - `planNumber`가 `null`인 경우도 처리
   - 첫 번째 그룹을 기본값으로 사용

3. **상세 보기 연동**
   - 일일 뷰에서 상세 보기 클릭 시 단일 뷰에서도 찾을 수 있음
   - `planNumber`가 `null`인 경우도 처리

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 모든 그룹 포함
- ✅ null 처리 개선
- ✅ 일일 뷰와 단일 뷰 일관성

## 관련 파일
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_utils/planGroupUtils.ts`

## 참고
이전 수정 사항:
- `2025-12-21_191041-fix-plan-selector-null-plan-number.md`: PlanSelector null planNumber 처리 수정
- `2025-12-21_191238-fix-plan-selector-filter-null-groups.md`: PlanSelector null 그룹 필터링 수정

이번 수정으로 `planNumber`가 `null`인 그룹도 포함하여 일일 뷰와 단일 뷰의 일관성을 유지하고, 일일 뷰에서 상세 보기 클릭 시 단일 뷰에서도 찾을 수 있도록 수정했습니다.

