# 교재 등록 폼 대단원 필드 포커스 이동 문제 수정

## 📋 문제 상황

교재 등록 폼(`BookDetailsManager`)에서 대단원 필드에 입력할 때 포커스가 이동되는 문제가 발생했습니다.

## 🔍 원인 분석

### 문제점

1. **React Key 변경으로 인한 컴포넌트 재생성**
   - 대단원 그룹의 `key`가 `group.majorUnit`로 설정되어 있었습니다.
   - 사용자가 대단원명을 입력하면 `majorUnit` 값이 변경됩니다.
   - React는 `key`가 변경된 것을 감지하고 컴포넌트를 완전히 재생성합니다.
   - 이로 인해 입력 필드가 새로 생성되면서 포커스가 사라집니다.

```tsx
// ❌ 문제가 있던 코드
<div key={group.majorUnit}>  // 대단원명이 변경되면 key도 변경됨
  <input
    type="text"
    value={group.majorUnit}
    onChange={(e) => updateMajorUnitName(group.majorUnit, e.target.value)}
  />
</div>
```

## ✅ 해결 방법

### 1. 고유 ID 기반 Key 사용

각 그룹에 고유한 `groupId`를 부여하고, 이를 `key`로 사용하도록 변경했습니다.

```tsx
// ✅ 수정된 코드
type GroupedDetails = {
  majorUnit: string;
  items: DetailItem[];
  groupId: string; // 고유 ID 추가
};
```

### 2. groupId 생성 로직

```tsx
const sortedGroups: GroupedDetails[] = Array.from(groups.entries())
  .map(([majorUnit, items]) => {
    const sortedItems = items.sort(/* ... */);
    // 그룹 고유 ID 생성 (첫 번째 항목의 tempId 또는 display_order 기반)
    const groupId = sortedItems[0]?.tempId || `group-${sortedItems[0]?.display_order ?? 0}-${majorUnit}`;
    return {
      majorUnit,
      items: sortedItems,
      groupId,
    };
  })
```

### 3. Key 변경

```tsx
// ✅ 수정된 코드
<div key={group.groupId}>  // 고유 ID를 key로 사용
  <input
    type="text"
    key={`input-${group.groupId}`}  // 입력 필드에도 고유 key 부여
    value={group.majorUnit === "(대단원 없음)" ? "" : group.majorUnit}
    onChange={(e) => {
      const newName = e.target.value || "(대단원 없음)";
      updateMajorUnitName(group.majorUnit, newName);
    }}
    onKeyDown={(e) => e.stopPropagation()}  // 키보드 이벤트 전파 방지 추가
  />
</div>
```

## 📝 수정 내용

### 변경된 파일

- `app/(student)/contents/_components/BookDetailsManager.tsx`

### 주요 변경 사항

1. **`GroupedDetails` 타입에 `groupId` 필드 추가**
   - 각 그룹에 고유한 식별자 부여

2. **`groupedDetails` 생성 시 `groupId` 할당**
   - 첫 번째 항목의 `tempId`를 우선 사용
   - 없으면 `display_order`와 `majorUnit`을 조합하여 생성

3. **컴포넌트 `key`를 `group.majorUnit`에서 `group.groupId`로 변경**
   - 대단원명이 변경되어도 같은 컴포넌트로 인식

4. **입력 필드에 고유 `key` 추가**
   - `key={`input-${group.groupId}`}`로 설정하여 포커스 유지

5. **`onKeyDown` 이벤트 핸들러 추가**
   - 키보드 이벤트 전파 방지

## 🧪 테스트 방법

1. 교재 등록 페이지로 이동
2. "+ 대단원 추가" 버튼 클릭
3. 대단원명 입력 필드에 포커스
4. 대단원명을 입력하면서 포커스가 유지되는지 확인
5. 여러 대단원을 추가하고 각각의 이름을 수정해보며 포커스 유지 확인

## ✅ 기대 효과

- 대단원명 입력 중 포커스가 유지되어 사용자 경험 개선
- React의 컴포넌트 재사용 최적화
- 입력 필드의 안정성 향상

## 📚 참고 사항

- `groupId`는 첫 번째 항목의 `tempId`를 우선 사용하므로, 항목이 삭제되거나 순서가 변경되어도 그룹의 고유성을 유지합니다.
- 대단원명이 변경되어도 `groupId`는 유지되므로 React가 같은 컴포넌트로 인식합니다.

---

**작업 일시**: 2025-02-05  
**작업자**: AI Assistant  
**관련 이슈**: 교재 등록 폼 대단원 필드 포커스 이동 문제

