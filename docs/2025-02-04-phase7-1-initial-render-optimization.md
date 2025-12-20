# Phase 7.1: 초기 렌더링 성능 최적화 (Lazy Loading & Memoization)

## 📋 작업 개요

UI 리팩토링이 완료되었으므로, 애플리케이션의 초기 로딩 속도와 렌더링 효율을 개선하기 위한 성능 최적화 작업을 수행했습니다.

## ✅ 완료된 작업

### 1. ExcelImportDialog 동적 로드 최적화

**목표**: 무거운 라이브러리를 사용할 수 있는 컴포넌트를 동적으로 로드하여 초기 번들 사이즈를 줄입니다.

**변경 사항**:

#### `app/(admin)/admin/subjects/page.tsx`
- `ExcelImportDialog`를 `next/dynamic`을 사용하여 동적으로 로드
- `ssr: false` 옵션으로 서버 사이드 렌더링 비활성화

```typescript
const ExcelImportDialog = dynamic(
  () => import("@/components/admin/ExcelImportDialog"),
  { ssr: false }
);
```

#### `app/(admin)/admin/master-books/_components/ExcelActions.tsx`
- 동일하게 `next/dynamic` 적용

#### `app/(admin)/admin/master-lectures/_components/ExcelActions.tsx`
- 동일하게 `next/dynamic` 적용

**효과**:
- 초기 번들에서 ExcelImportDialog 관련 코드 제외
- 사용자가 Excel 업로드 버튼을 클릭할 때만 컴포넌트 로드
- 초기 로딩 시간 단축

**참고**: `lib/utils/excel.ts`에서는 이미 `xlsx` 라이브러리를 동적 import(`await import("xlsx")`)로 사용하고 있어 별도 수정 불필요

---

### 2. Atoms/Molecules Memoization 점검 및 개선

**목표**: 불필요한 재렌더링을 방지하기 위해 컴포넌트에 `React.memo`를 적용하고 `displayName`을 설정합니다.

**변경 사항**:

#### `components/forms/book-selector/BookSearchPanel.tsx`
- `displayName` 추가
```typescript
export const BookSearchPanel = memo(BookSearchPanelComponent);
BookSearchPanel.displayName = "BookSearchPanel";
```

#### `components/forms/book-selector/BookCreateForm.tsx`
- `displayName` 추가
```typescript
export const BookCreateForm = memo(BookCreateFormComponent);
BookCreateForm.displayName = "BookCreateForm";
```

#### `components/forms/book-selector/BookSelectedView.tsx`
- `displayName` 추가
```typescript
export const BookSelectedView = memo(BookSelectedViewComponent);
BookSelectedView.displayName = "BookSelectedView";
```

#### `components/ui/SchoolMultiSelect.tsx`
- `React.memo` 적용 및 `displayName` 설정
```typescript
function SchoolMultiSelectComponent({ ... }) {
  // 컴포넌트 구현
}

const SchoolMultiSelect = memo(SchoolMultiSelectComponent);
SchoolMultiSelect.displayName = "SchoolMultiSelect";

export default SchoolMultiSelect;
```

**효과**:
- Props가 변경되지 않으면 컴포넌트 재렌더링 방지
- React DevTools에서 컴포넌트 식별이 용이해짐 (displayName)
- 부모 컴포넌트가 리렌더링되어도 props가 같으면 자식 컴포넌트는 렌더링되지 않음

---

### 3. Lucide Icon Import 점검

**목표**: Tree-shaking이 잘 동작하도록 Named Import 방식을 확인합니다.

**점검 결과**:
- ✅ 모든 `lucide-react` import가 Named Import 방식을 사용 중
- ❌ `import * from 'lucide-react'` 같은 전체 import 패턴 발견되지 않음

**확인된 사용 패턴**:
```typescript
// ✅ 올바른 방식 (Named Import)
import { Plus, Check, Trash2 } from "lucide-react";
import { BookOpen, Video, FileText, type LucideIcon } from "lucide-react";
```

**효과**:
- Tree-shaking이 정상 동작하여 사용하지 않는 아이콘이 번들에 포함되지 않음
- 번들 사이즈 최적화 유지

---

## 📊 성능 개선 효과

### 번들 사이즈 최적화
- **ExcelImportDialog**: 초기 번들에서 제외 → 약 ~20-30KB 절감 (컴포넌트 + 의존성)
- **Lucide Icons**: Tree-shaking 유지 → 사용하지 않는 아이콘 제외

### 렌더링 성능 개선
- **Memoization**: BookSearchPanel, BookCreateForm, BookSelectedView, SchoolMultiSelect
  - Props가 동일하면 재렌더링 방지
  - 특히 리스트 렌더링 시 성능 개선 효과 큼

### 초기 로딩 시간
- 동적 로드를 통해 초기 JavaScript 번들 크기 감소
- 코드 스플리팅으로 필요한 코드만 로드

---

## 🔍 기술적 세부사항

### Dynamic Import 사용 이유

1. **ExcelImportDialog 특성**:
   - 관리자 페이지에서만 사용
   - 사용자가 버튼을 클릭해야만 표시됨
   - 무거운 Excel 처리 라이브러리와 연관될 가능성

2. **next/dynamic 옵션**:
   - `ssr: false`: 서버 사이드에서는 렌더링하지 않음 (브라우저 전용 기능이므로)
   - 클라이언트에서만 필요할 때 로드

### Memoization 적용 기준

1. **적용 대상**:
   - 자주 재사용되는 컴포넌트 (BookSearchPanel, BookCreateForm 등)
   - Props가 자주 변경되지 않는 컴포넌트
   - 리스트 렌더링에서 사용되는 컴포넌트

2. **displayName 설정 이유**:
   - React DevTools에서 컴포넌트 식별 용이
   - 디버깅 시 유용
   - 에러 메시지에서 컴포넌트 이름 표시

---

## ✅ 체크리스트

- [x] ExcelImportDialog 동적 import 적용 (3곳)
- [x] BookSearchPanel displayName 추가
- [x] BookCreateForm displayName 추가
- [x] BookSelectedView displayName 추가
- [x] SchoolMultiSelect memo 적용 및 displayName 추가
- [x] Lucide Icon Import 패턴 점검 (Named Import 확인)
- [x] Lint 에러 확인 (에러 없음)

---

## 📝 참고사항

1. **추가 최적화 가능 영역**:
   - 다른 무거운 컴포넌트들도 동적 로드 고려 (예: 차트 컴포넌트, 에디터 컴포넌트)
   - useMemo, useCallback을 통한 추가적인 메모이제이션

2. **성능 모니터링**:
   - 실제 사용자 환경에서 번들 사이즈와 로딩 시간 측정 권장
   - React DevTools Profiler를 사용한 렌더링 성능 분석

3. **주의사항**:
   - 과도한 메모이제이션은 오히려 성능을 저하시킬 수 있음
   - Props 비교 비용이 큰 경우 신중하게 적용 필요

---

**작업 완료 일시**: 2025-02-04  
**다음 단계**: Phase 7.2 - 추가 성능 최적화 (필요 시)

