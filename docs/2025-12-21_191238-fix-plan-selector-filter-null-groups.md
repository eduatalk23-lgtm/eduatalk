# PlanSelector null 그룹 필터링 수정

## 작업 일시
2025-12-21 19:12:38

## 문제 상황

### 콘솔 로그 분석
```
select onChange called, but planNumber is null for group: 7a3f5e2d-4054-440a-8d71-a1634835a5a6
select onChange called, but planNumber is null for group: 682a7a55-5222-4d55-b73f-604c2ab501eb
```

### 근본 원인
1. **드롭다운에 null 그룹 표시**: `planNumber`가 `null`인 그룹이 드롭다운에 표시됨
2. **사용자가 null 그룹 선택 가능**: 드롭다운에서 `null` 그룹을 선택할 수 있음
3. **선택 실패**: `null` 그룹을 선택하면 경고만 발생하고 선택이 실패함

### 문제가 있던 코드
```typescript
// 모든 groups를 드롭다운에 표시
{groups.map((group) => (
  <option key={group.plan.id} value={group.plan.id}>
    {contentTitle} ({sequence}) - {status}
  </option>
))}
```

## 해결 방법

### 핵심 변경 사항

#### 1. 유효한 그룹만 필터링
- `planNumber`가 `null`이 아닌 그룹만 필터링하여 사용
- 모든 로직에서 `validGroups` 사용

```typescript
// planNumber가 null이 아닌 그룹만 필터링
const validGroups = groups.filter((g) => g.planNumber !== null);
```

#### 2. 드롭다운에 유효한 그룹만 표시
- `validGroups`만 드롭다운에 표시
- `null` 그룹은 드롭다운에서 완전히 제외

```typescript
{validGroups.map((group) => (
  <option key={group.plan.id} value={group.plan.id}>
    {contentTitle} ({sequence}) - {status}
  </option>
))}
```

#### 3. currentIndex 계산 개선
- `validGroups` 기준으로 인덱스 계산
- `null` 그룹을 고려하지 않음

```typescript
const currentIndex = displayGroup 
  ? validGroups.findIndex((g) => g.plan.id === displayGroup.plan.id)
  : -1;
```

#### 4. handlePrevious/handleNext 단순화
- `validGroups`만 사용하므로 `null` 체크 불필요
- 로직 단순화

```typescript
const handleNext = () => {
  if (currentIndex >= 0 && currentIndex < validGroups.length - 1) {
    const nextGroup = validGroups[currentIndex + 1];
    if (nextGroup && nextGroup.planNumber !== null) {
      onSelect(nextGroup.planNumber);
    }
  }
};
```

#### 5. onChange 단순화
- `validGroups`만 사용하므로 `null` 체크 불필요
- 경고 로그 제거

```typescript
onChange={(e) => {
  const selectedPlanId = e.target.value;
  const selectedGroup = validGroups.find((g) => g.plan.id === selectedPlanId);
  if (selectedGroup && selectedGroup.planNumber !== null) {
    onSelect(selectedGroup.planNumber);
  }
}}
```

#### 6. 버튼 disabled 조건 단순화
- `validGroups` 기준으로 단순화
- 복잡한 조건 제거

```typescript
disabled={currentIndex <= 0}  // 이전 버튼
disabled={currentIndex < 0 || currentIndex >= validGroups.length - 1}  // 다음 버튼
```

### 주요 개선 사항

1. **완전한 필터링**
   - `planNumber`가 `null`인 그룹을 완전히 제외
   - 드롭다운, 버튼, 인덱스 계산 모두 `validGroups` 사용

2. **로직 단순화**
   - `null` 체크 로직 제거
   - 복잡한 조건문 제거
   - 코드 가독성 향상

3. **사용자 경험 개선**
   - `null` 그룹을 선택할 수 없음
   - 경고 로그 제거
   - 명확한 동작

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ null 그룹 완전 제외
- ✅ 로직 단순화
- ✅ 경고 로그 제거

## 관련 파일
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_utils/planGroupUtils.ts`

## 참고
이전 수정 사항:
- `2025-12-21_191041-fix-plan-selector-null-plan-number.md`: PlanSelector null planNumber 처리 수정

이번 수정으로 `planNumber`가 `null`인 그룹을 완전히 필터링하여 드롭다운에서 제외하고, 모든 로직에서 유효한 그룹만 사용하도록 수정했습니다. 이제 `null` 그룹을 선택할 수 없으며, 경고 로그도 발생하지 않습니다.

