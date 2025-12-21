# PlanSelector null planNumber 처리 수정

## 작업 일시
2025-12-21 19:10:41

## 문제 상황

### 콘솔 로그 분석
```
handleNext called, selecting: null
handleSelectPlan called with: null
select onChange called, selecting: null
handleSelectPlan called with: null
```

### 근본 원인
1. **planNumber가 null인 그룹 존재**: `PlanGroup` 타입에서 `planNumber: number | null`이므로 `null`인 그룹이 있을 수 있음
2. **null 처리 누락**: `handlePrevious`, `handleNext`, `onChange`에서 `planNumber`가 `null`인 그룹을 선택하려고 함
3. **선택 실패**: `planNumber`가 `null`이면 선택이 제대로 작동하지 않음

### 문제가 있던 코드
```typescript
const handleNext = () => {
  if (currentIndex >= 0 && currentIndex < groups.length - 1) {
    const nextPlanNumber = groups[currentIndex + 1].planNumber; // null일 수 있음
    onSelect(nextPlanNumber); // null이 전달됨
  }
};
```

## 해결 방법

### 핵심 변경 사항

#### 1. handlePrevious/handleNext에서 null 건너뛰기
- `planNumber`가 `null`이 아닌 그룹만 선택
- `null`인 경우 다음/이전 유효한 그룹 찾기

```typescript
const handleNext = () => {
  if (currentIndex >= 0 && currentIndex < groups.length - 1) {
    const nextGroup = groups[currentIndex + 1];
    // planNumber가 null이 아닌 그룹만 선택
    if (nextGroup && nextGroup.planNumber !== null) {
      onSelect(nextGroup.planNumber);
    } else {
      // planNumber가 null이면 다음 유효한 그룹 찾기
      for (let i = currentIndex + 1; i < groups.length; i++) {
        if (groups[i].planNumber !== null) {
          onSelect(groups[i].planNumber);
          break;
        }
      }
    }
  }
};
```

#### 2. onChange에서 null 체크
- `planNumber`가 `null`이 아닌 경우에만 선택
- `null`인 경우 경고 로그 출력

```typescript
onChange={(e) => {
  const selectedPlanId = e.target.value;
  const selectedGroup = groups.find((g) => g.plan.id === selectedPlanId);
  if (selectedGroup) {
    // planNumber가 null이 아닌 경우에만 선택
    if (selectedGroup.planNumber !== null) {
      onSelect(selectedGroup.planNumber);
    } else {
      console.warn("select onChange called, but planNumber is null");
    }
  }
}}
```

#### 3. displayGroup 선택 개선
- `planNumber`가 `null`이 아닌 첫 번째 그룹을 표시용으로 사용

```typescript
// currentGroup이 없으면 planNumber가 null이 아닌 첫 번째 그룹을 표시용으로 사용
const displayGroup = currentGroup || groups.find((g) => g.planNumber !== null) || groups[0];
```

#### 4. 버튼 disabled 조건 개선
- 이전/다음 버튼이 `planNumber`가 `null`이 아닌 그룹이 없으면 비활성화

```typescript
disabled={currentIndex <= 0 || !groups.slice(0, currentIndex).some((g) => g.planNumber !== null)}
```

### 주요 개선 사항

1. **null 처리 추가**
   - `planNumber`가 `null`인 그룹은 건너뛰기
   - 다음/이전 유효한 그룹 찾기

2. **선택 안전성 향상**
   - `planNumber`가 `null`이 아닌 경우에만 선택
   - 경고 로그로 문제 추적

3. **표시 개선**
   - `planNumber`가 `null`이 아닌 그룹을 우선 표시
   - 버튼 disabled 조건 개선

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ null 처리 추가
- ✅ 선택 안전성 향상

## 관련 파일
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_utils/planGroupUtils.ts`

## 참고
이전 수정 사항:
- `2025-12-21_190702-fix-single-view-plan-navigation-debug.md`: 단일 뷰 플랜 이동 기능 디버깅 로그 추가

이번 수정으로 `planNumber`가 `null`인 그룹을 건너뛰고, 유효한 그룹만 선택하도록 수정했습니다. 이제 드롭다운과 버튼이 정상 작동해야 합니다.

