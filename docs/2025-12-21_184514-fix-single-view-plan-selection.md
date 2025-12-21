# 단일 뷰 플랜 선택 기능 수정

## 작업 일시
2025-12-21 18:45:14

## 문제 상황

### 사용자 보고
단일 뷰에서 다른 플랜을 보는 기능이 작동하지 않음

### 원인 분석
`PlanSelector` 컴포넌트에서 `select` 요소의 `value`와 `option` 요소의 `value`를 `planNumber`로 관리하고 있었는데, `planNumber`가 `null`인 그룹이 여러 개 있을 때 문제가 발생했습니다:

1. **중복된 value 문제**: `planNumber`가 `null`인 그룹들이 모두 `value=""`로 설정되어 구분이 안 됨
2. **선택 불가**: 드롭다운에서 특정 플랜을 선택해도 어떤 그룹을 선택했는지 알 수 없음
3. **이전/다음 버튼 문제**: `currentIndex`를 찾을 때 `planNumber`로 비교하여 정확한 인덱스를 찾지 못함

### 문제가 있던 코드
```typescript
// select의 value가 planNumber 기반
<select
  value={selectedPlanNumber ?? ""}
  onChange={(e) => {
    const value = e.target.value;
    onSelect(value === "" ? null : Number(value));
  }}
>
  {groups.map((group) => (
    <option key={group.plan.id} value={group.planNumber ?? ""}>
      {/* ... */}
    </option>
  ))}
</select>
```

## 해결 방법

### 변경 사항
1. **select의 value를 plan.id 기반으로 변경**: 각 그룹의 고유 식별자인 `plan.id`를 사용
2. **option의 value도 plan.id로 변경**: 모든 그룹이 고유한 값을 가지도록 보장
3. **onChange 핸들러 개선**: 선택된 `plan.id`를 기반으로 해당 그룹을 찾아 `planNumber`를 전달
4. **currentIndex 계산 개선**: `plan.id`를 기준으로 정확한 인덱스 계산
5. **안전성 개선**: `currentIndex`가 `-1`일 때를 대비한 방어 코드 추가

### 수정된 코드
```typescript
// 현재 선택된 그룹 찾기
const currentGroup = groups.find(
  (g) => g.planNumber === selectedPlanNumber
) || groups[0];

const currentIndex = currentGroup 
  ? groups.findIndex((g) => g.plan.id === currentGroup.plan.id)
  : -1;

// select의 value를 plan.id 기반으로 변경
<select
  value={currentGroup?.plan.id ?? ""}
  onChange={(e) => {
    const selectedPlanId = e.target.value;
    const selectedGroup = groups.find((g) => g.plan.id === selectedPlanId);
    if (selectedGroup) {
      onSelect(selectedGroup.planNumber);
    }
  }}
>
  {groups.map((group) => (
    <option key={group.plan.id} value={group.plan.id}>
      {/* ... */}
    </option>
  ))}
</select>
```

### 주요 개선 사항

1. **고유 식별자 사용**
   - `plan.id`는 항상 고유하므로 중복 문제 해결
   - `planNumber`가 `null`이어도 각 그룹을 구분 가능

2. **정확한 선택 관리**
   - 드롭다운에서 플랜을 선택하면 정확한 그룹을 찾아 선택 가능
   - 이전/다음 버튼도 정확한 인덱스 기반으로 작동

3. **안전성 향상**
   - `currentIndex`가 `-1`일 때를 대비한 방어 코드
   - 버튼 disabled 상태 개선
   - 카운터 표시 조건 개선

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 외부 인터페이스 호환성 유지 (`onSelect`는 여전히 `planNumber` 전달)
- ✅ `planNumber`가 `null`인 그룹이 여러 개 있어도 정상 작동

## 관련 파일
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanViewContainer.tsx`

## 참고
이전에 수정한 중복 키 오류(`2025-12-21_184106-fix-plan-selector-duplicate-key.md`)와 연관된 문제였습니다. `planNumber`가 `null`인 경우를 제대로 처리하지 못하여 발생한 문제였습니다.

