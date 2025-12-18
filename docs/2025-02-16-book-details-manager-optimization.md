# 교재 목차 입력 필드 문제 해결 및 최적화

## 📋 작업 개요

교재 목차의 대단원/중단원 입력 시 발생하는 포커스 이동, 그룹 병합, 불필요한 리렌더링 문제를 해결하고, 중복 코드를 제거하며 React 모범 사례를 적용하여 성능을 최적화했습니다.

**작업 일시**: 2025-02-16  
**작업 파일**: `app/(student)/contents/_components/BookDetailsManager.tsx`

### 추가 개선 (2025-02-16)

입력 중 중복 체크로 인한 입력 방해 문제를 해결했습니다.
- **문제**: 기존 대단원명 "이차곡선"이 있을 때, "이차곡선의 접선"을 입력하려고 하면 "이차곡선"에서 입력이 막히는 문제
- **해결**: 입력 중(`onChange`)에는 중복 체크를 하지 않고, 입력 완료 시(`onBlur` 또는 `Enter` 키)에만 중복 체크를 수행하도록 변경

---

## 🔍 문제 분석

### 발견된 문제점

1. **단원명 겹침 시 그룹 병합**
   - 대단원명이 겹치면 두 그룹이 병합되어 중단원 목록이 합쳐짐
   - `expandedGroups`가 `majorUnit` 문자열을 키로 사용하여 발생

2. **입력 필드 포커스 손실**
   - 대단원명 입력 중 포커스가 사라지고 추가 입력 불가
   - `groupId` 생성 시 `majorUnit`을 포함하여 대단원명 변경 시 변경됨

3. **토글 상태 유지 실패**
   - `expandedGroups`가 `majorUnit` 문자열을 키로 사용하여 대단원명 변경 시 토글 상태가 유지되지 않음

4. **불필요한 리렌더링**
   - 대단원명 입력 시 모든 항목이 업데이트되어 중단원 목록이 리렌더링됨

5. **중복 코드**
   - `(대단원 없음)` 문자열과 `major_unit || "(대단원 없음)"` 패턴이 반복됨

---

## ✅ 해결 방법

### Phase 1: 상수 및 유틸리티 함수 추출

**상수 정의**
```typescript
const EMPTY_MAJOR_UNIT = "(대단원 없음)";
```

**유틸리티 함수 생성**
```typescript
const getMajorUnit = (majorUnit: string | null | undefined): string => {
  return majorUnit || EMPTY_MAJOR_UNIT;
};

const normalizeMajorUnit = (majorUnit: string): string => {
  return majorUnit || EMPTY_MAJOR_UNIT;
};
```

**효과**
- 중복된 문자열 리터럴 제거
- 일관된 대단원명 처리 로직
- 유지보수성 향상

### Phase 2: groupId 생성 로직 개선

**변경 전**
```typescript
const groupId = sortedItems[0]?.tempId || `group-${sortedItems[0]?.display_order ?? 0}-${majorUnit}`;
```

**변경 후**
```typescript
const groupId = sortedItems[0]?.tempId || `group-${sortedItems[0]?.display_order ?? 0}`;
```

**효과**
- 대단원명 변경과 무관하게 `groupId` 유지
- 그룹 병합 방지
- 입력 필드 포커스 유지

### Phase 3: expandedGroups 키 변경

**변경 전**
```typescript
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
  new Set(groupedDetails.map((g) => g.majorUnit))
);

const toggleGroup = (majorUnit: string) => {
  // ...
};
```

**변경 후**
```typescript
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
  new Set(groupedDetails.map((g) => g.groupId))
);

const toggleGroup = useCallback((groupId: string) => {
  // ...
}, []);
```

**효과**
- 대단원명 변경 시에도 토글 상태 유지
- `useCallback`으로 함수 메모이제이션

### Phase 4: 중복 대단원명 방지 로직 추가

**추가된 로직**
```typescript
const updateMajorUnitName = useCallback((oldName: string, newName: string, skipDuplicateCheck: boolean = false) => {
  const normalizedNewName = normalizeMajorUnit(newName);
  const normalizedOldName = normalizeMajorUnit(oldName);
  
  // 중복 체크: 입력 중이 아닐 때만 수행
  if (!skipDuplicateCheck) {
    const existingGroup = groupedDetails.find(
      (g) => getMajorUnit(g.majorUnit) === normalizedNewName && 
             g.majorUnit !== normalizedOldName
    );
    
    if (existingGroup) {
      alert(`"${normalizedNewName}" 대단원명이 이미 존재합니다. 다른 이름을 사용해주세요.`);
      return;
    }
  }

  // 업데이트 로직...
}, [details, groupedDetails, updateDetails]);

// 대단원명 입력 완료 시 중복 체크
const handleMajorUnitBlur = useCallback((group: GroupedDetails, currentValue: string) => {
  const normalizedValue = normalizeMajorUnit(currentValue);
  const normalizedOldName = normalizeMajorUnit(group.majorUnit);
  
  // 값이 변경되었고, 빈 값이 아닐 때만 중복 체크
  if (normalizedValue !== normalizedOldName && normalizedValue !== EMPTY_MAJOR_UNIT) {
    updateMajorUnitName(group.majorUnit, normalizedValue, false);
  }
}, [updateMajorUnitName]);
```

**효과**
- 중복된 대단원명 입력 방지
- 그룹 병합 방지
- 입력 중에는 중복 체크를 하지 않아 자연스러운 입력 가능
- 입력 완료 시에만 중복 체크하여 사용자 경험 개선

### Phase 5: 성능 최적화

**함수 메모이제이션**
- `updateDetails`, `addMajorUnit`, `addMinorUnit`, `removeItem`, `removeMajorUnit`, `updateItem`, `updateMajorUnitName`을 `useCallback`으로 래핑
- 의존성 배열 정확히 설정

**컴포넌트 분리**
```typescript
const MinorUnitList = memo(function MinorUnitList({
  items,
  updateItem,
  removeItem,
}: MinorUnitListProps) {
  // 중단원 목록 렌더링
});
```

**효과**
- 불필요한 리렌더링 방지
- 대단원명 입력 시 중단원 목록이 리렌더링되지 않음
- 성능 개선

### Phase 6: 중단원 추가 시 groupId 사용

**변경 전**
```typescript
onClick={(e) => {
  e.stopPropagation();
  addMinorUnit(group.majorUnit);
  setExpandedGroups((prev) => new Set([...prev, group.majorUnit]));
}}
```

**변경 후**
```typescript
onClick={(e) => {
  e.stopPropagation();
  addMinorUnit(group.majorUnit);
  setExpandedGroups((prev) => new Set([...prev, group.groupId]));
}}
```

**효과**
- 중단원 추가 시 토글 상태 유지
- 일관된 상태 관리

### Phase 7: 중복 코드 제거

**변경 사항**
- `(대단원 없음)` 문자열 리터럴 → `EMPTY_MAJOR_UNIT` 상수
- `major_unit || "(대단원 없음)"` → `getMajorUnit()` 유틸리티 함수
- `majorUnit === "(대단원 없음)" ? "" : majorUnit` → `normalizeMajorUnit()` 유틸리티 함수

**효과**
- 코드 중복 제거
- 유지보수성 향상
- 일관된 로직 적용

---

## 📊 주요 변경 사항

### 1. Import 추가
```typescript
import { useState, useMemo, useCallback, memo } from "react";
```

### 2. 상수 및 유틸리티 함수 추가
- `EMPTY_MAJOR_UNIT` 상수
- `getMajorUnit()` 함수
- `normalizeMajorUnit()` 함수

### 3. groupId 생성 로직 개선
- `majorUnit` 제거, `tempId` 또는 `display_order`만 사용

### 4. expandedGroups 키 변경
- `majorUnit` → `groupId`로 변경
- 모든 관련 로직 수정

### 5. 중복 체크 로직 추가
- `updateMajorUnitName` 함수에 중복 체크 및 경고 로직 추가
- `skipDuplicateCheck` 파라미터 추가하여 입력 중에는 중복 체크를 건너뜀
- `handleMajorUnitBlur` 함수 추가하여 입력 완료 시에만 중복 체크 수행

### 6. 성능 최적화
- 모든 함수를 `useCallback`으로 메모이제이션
- `MinorUnitList` 컴포넌트 분리 및 `React.memo` 적용

### 7. 중복 코드 제거
- 모든 문자열 리터럴을 상수로 교체
- 반복 패턴을 유틸리티 함수로 교체

---

## 🧪 테스트 시나리오

1. **대단원 추가 후 대단원명 입력 시 포커스 유지 확인**
   - ✅ 대단원명 입력 중 포커스가 유지됨
   - ✅ 추가 입력이 정상적으로 작동함

2. **대단원명을 기존 대단원명과 동일하게 입력 시 중복 경고 확인**
   - ✅ 중복된 대단원명 입력 시 경고 메시지 표시
   - ✅ 그룹 병합이 발생하지 않음

3. **대단원명 변경 시 토글 상태 유지 확인**
   - ✅ 대단원명 변경 시에도 토글 상태가 유지됨
   - ✅ 중단원 목록이 정상적으로 표시됨

4. **대단원명 변경 시 중단원 목록이 리렌더링되지 않는지 확인**
   - ✅ 대단원명 입력 시 중단원 목록이 리렌더링되지 않음
   - ✅ 성능 개선 확인

5. **여러 대단원 추가 후 각각의 이름을 수정해보며 포커스 유지 확인**
   - ✅ 여러 대단원 추가 및 수정 시 포커스 유지
   - ✅ 각 대단원의 토글 상태가 독립적으로 유지됨

6. **입력 중 중복 체크로 인한 입력 방해 문제 확인**
   - ✅ 기존 대단원명 "이차곡선"이 있을 때 "이차곡선의 접선" 입력 가능
   - ✅ 입력 중에는 중복 체크를 하지 않아 자연스러운 입력 가능
   - ✅ 입력 완료 시(`onBlur` 또는 `Enter` 키)에만 중복 체크 수행

---

## 📈 기대 효과

### 1. 그룹 병합 방지
- 고유한 `groupId` 사용으로 대단원명 변경 시에도 그룹이 병합되지 않음
- 중복 체크 로직으로 사전 방지

### 2. 포커스 유지
- 그룹 병합이 발생하지 않아 React 컴포넌트 재생성이 방지됨
- 입력 필드 포커스가 유지되어 사용자 경험 개선

### 3. 토글 상태 유지
- `expandedGroups`를 `groupId` 기반으로 변경하여 대단원명 변경 시에도 토글 상태 유지
- 일관된 UI 상태 관리

### 4. 성능 개선
- 불필요한 리렌더링 감소
- 함수 메모이제이션으로 최적화
- 컴포넌트 분리로 렌더링 최적화

### 5. 코드 품질 향상
- 중복 코드 제거
- 유틸리티 함수 추출로 유지보수성 향상
- React 모범 사례 적용

---

## 🔗 관련 이슈

- 교재 등록 폼 대단원 필드 포커스 이동 문제
- 대단원명 겹침 시 그룹 병합 문제
- 불필요한 리렌더링으로 인한 성능 이슈

---

## 📚 참고 자료

- [React 공식 문서 - useCallback](https://react.dev/reference/react/useCallback)
- [React 공식 문서 - useMemo](https://react.dev/reference/react/useMemo)
- [React 공식 문서 - memo](https://react.dev/reference/react/memo)
- [React 공식 문서 - Controlled Components](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)

---

**작업 완료**: 2025-02-16  
**작업자**: AI Assistant

