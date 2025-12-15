# CategoryNav useEffect 의존성 배열 최적화

**작성 일자**: 2025-01-XX  
**수정 파일**: `components/navigation/global/CategoryNav.tsx`

---

## 문제 분석

### 발견된 문제점

1. **useEffect 의존성 배열 문제**
   - `getActiveCategoryInfo` 함수를 의존성으로 사용하여 불필요한 재실행 발생
   - 함수 참조가 변경될 때마다 `useEffect`가 재실행되어 성능 저하

2. **중복 코드**
   - `getActiveCategoryInfo`와 초기 상태 설정에서 동일한 로직 반복
   - `isCategoryActive` 함수에서 캠프 모드 체크 로직 중복

3. **최적화 기회**
   - `useCallback` 대신 `useMemo` 사용으로 값 직접 계산 가능
   - 의존성 배열을 실제 값으로 명확화

---

## 수정 내용

### 1. getActiveCategoryInfo를 useMemo로 변경

**변경 전**:
```typescript
const getActiveCategoryInfo = useCallback((): ActiveCategoryInfo | null => {
  let active = resolveActiveCategory(safePathname, role);
  // ...
  return active;
}, [safePathname, role, campMode, categories]);
```

**변경 후**:
```typescript
const activeCategoryInfo = useMemo((): ActiveCategoryInfo | null => {
  let active = resolveActiveCategory(safePathname, role);
  // ...
  return active;
}, [safePathname, role, campMode, categories]);
```

**효과**: 함수 참조 대신 값을 직접 계산하여 불필요한 재실행 방지

### 2. useEffect 의존성 배열 수정

**변경 전**:
```typescript
useEffect(() => {
  const active = getActiveCategoryInfo();
  if (active) {
    setExpandedCategories((prev) => {
      if (prev.has(active.category.id)) return prev;
      return new Set([...prev, active.category.id]);
    });
  }
}, [getActiveCategoryInfo]); // 함수 참조를 의존성으로 사용
```

**변경 후**:
```typescript
useEffect(() => {
  if (activeCategoryInfo) {
    setExpandedCategories((prev) => {
      if (prev.has(activeCategoryInfo.category.id)) return prev;
      return new Set([...prev, activeCategoryInfo.category.id]);
    });
  }
}, [activeCategoryInfo]); // 실제 값을 의존성으로 사용
```

**효과**: 의존성 배열이 실제 값으로 명확해져 불필요한 재실행 방지

### 3. 초기 상태 설정 개선

**변경 전**:
```typescript
const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
  const active = getActiveCategoryInfo();
  return new Set(active ? [active.category.id] : [categories[0]?.id].filter(Boolean));
});
```

**변경 후**:
```typescript
const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
  // 초기 렌더링 시 직접 계산 (SSR 안전)
  let active = resolveActiveCategory(safePathname, role);
  const initialCampMode = isCampMode(pathname, searchParams);
  if (initialCampMode && role === "student") {
    const campCategory = categories.find((cat) => cat.id === "camp");
    if (campCategory) {
      active = {
        category: campCategory,
        activeItem: campCategory.items[0] || null,
        isCategoryActive: true,
      };
    }
  }
  return new Set(active ? [active.category.id] : [categories[0]?.id].filter(Boolean));
});
```

**효과**: 초기화 함수 내부에서 직접 계산하여 SSR 안전성 보장

### 4. 중복 코드 제거 (isCategoryActive)

**변경 전**:
```typescript
const isCategoryActive = (category: NavigationCategory): boolean => {
  // 캠프 모드인 경우 "캠프 참여" 카테고리만 활성화
  if (campMode && role === "student") {
    return category.id === "camp";
  }
  return isCategoryPath(safePathname, category);
};
```

**변경 후**:
```typescript
const isCategoryActive = (category: NavigationCategory): boolean => {
  // activeCategoryInfo를 활용하여 중복 제거
  if (activeCategoryInfo) {
    return activeCategoryInfo.category.id === category.id;
  }
  return isCategoryPath(safePathname, category);
};
```

**효과**: 캠프 모드 체크 로직 중복 제거, `activeCategoryInfo` 재사용

### 5. import 문 정리

**변경 전**:
```typescript
import { useState, useEffect, useMemo, useCallback } from "react";
```

**변경 후**:
```typescript
import { useState, useEffect, useMemo } from "react";
```

**효과**: 사용하지 않는 `useCallback` 제거

---

## 최적화 효과

### 성능 개선
- ✅ 함수 참조 변경으로 인한 불필요한 재실행 방지
- ✅ `useMemo`로 값 직접 계산하여 계산 비용 최소화
- ✅ 의존성 배열이 실제 값으로 명확해져 React 최적화 활용

### 코드 품질 개선
- ✅ 중복 코드 제거로 유지보수성 향상
- ✅ 의존성 배열이 실제 값으로 명확해져 가독성 향상
- ✅ SSR 안전성 보장

### 유지보수성 향상
- ✅ 단일 책임 원칙 준수 (활성 카테고리 정보 계산 로직 통합)
- ✅ 코드 중복 제거로 버그 발생 가능성 감소

---

## 테스트 시나리오

다음 시나리오에서 정상 동작 확인:

1. ✅ 페이지 이동 시 메뉴 활성화 상태 확인
2. ✅ 캠프 모드 전환 시 메뉴 활성화 상태 확인
3. ✅ 쿼리 파라미터 변경 시 메뉴 활성화 상태 확인
4. ✅ 초기 로딩 시 메뉴 활성화 상태 확인
5. ✅ 카테고리 확장/축소 동작 확인

---

## 참고 자료

- [React useMemo 문서](https://react.dev/reference/react/useMemo)
- [React useEffect 최적화 가이드](https://react.dev/reference/react/useEffect#optimizing-dependencies)

---

**수정 완료 일시**: 2025-01-XX

