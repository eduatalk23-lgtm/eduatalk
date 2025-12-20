# Phase 6.3: BaseBookSelector 리팩토링 완료

**작업일**: 2025-02-04  
**작업 범위**: 비대한 컴포넌트 리팩토링 - BaseBookSelector 분리

---

## 작업 개요

진단 보고서에서 가장 비대한 컴포넌트로 지적된 `components/forms/BaseBookSelector.tsx`를 역할별로 분리하여 가독성과 유지보수성을 개선했습니다.

---

## 리팩토링 결과

### 변경 전
- 단일 파일에 모든 로직 집중 (503줄)
- 검색, 생성, 선택, 폼 처리 로직이 한 곳에 섞여 있음
- 가독성 및 유지보수성 낮음

### 변경 후
- 역할별로 분리된 구조 (5개 파일)
- 로직과 UI 분리
- 재사용 가능한 컴포넌트 구조

---

## 새로운 파일 구조

```
components/forms/
├── BaseBookSelector.tsx (메인 컨테이너 컴포넌트)
└── book-selector/
    ├── useBookSelectorLogic.ts (커스텀 훅 - 로직)
    ├── BookSearchPanel.tsx (검색 UI)
    ├── BookCreateForm.tsx (생성 폼 UI)
    └── BookSelectedView.tsx (선택된 교재 표시 UI)
```

---

## 세부 작업 내용

### 1. 커스텀 훅 분리 (`useBookSelectorLogic.ts`)

**위치**: `components/forms/book-selector/useBookSelectorLogic.ts`

**분리된 로직**:
- 상태 관리 (검색, 생성, 제출 상태)
- 검색 쿼리 및 필터링
- 선택된 교재 관리
- 교재 생성 및 선택 핸들러
- 메타데이터 관리 (`useBookMetadata` 연동)
- FormData 생성 및 검증 로직

**반환값**:
```typescript
{
  // 상태
  isSearching, setIsSearching,
  isCreating, setIsCreating,
  isSubmitting,
  searchQuery, setSearchQuery,
  bookDetails, setBookDetails,
  formRef,

  // 메타데이터
  revisions, subjectGroups, subjects, publishers,
  selectedRevisionId, selectedSubjectGroupId, selectedSubjectId, selectedPublisherId,
  setSelectedRevisionId, setSelectedSubjectGroupId, setSelectedSubjectId, setSelectedPublisherId,

  // 계산된 값
  filteredBooks, selectedBook,

  // 핸들러
  handleSelectBook, handleUnselectBook, handleCreateAndSelect,
}
```

---

### 2. UI 컴포넌트 분리

#### 2-1. `BookSearchPanel.tsx`

**역할**: 검색 입력창 및 검색 결과 리스트 렌더링

**Props**:
```typescript
{
  bookTypeLabel?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredBooks: BookItem[];
  onSelectBook: (bookId: string) => void;
  onCancel: () => void;
}
```

**기능**:
- 검색 입력 필드
- 검색 결과 리스트 표시
- 교재 선택 버튼
- 빈 상태 처리

---

#### 2-2. `BookCreateForm.tsx`

**역할**: 교재 등록 폼 UI

**Props**:
```typescript
{
  bookTypeLabel?: string;
  formRef: React.RefObject<HTMLDivElement | null>;
  // 메타데이터
  revisions, subjectGroups, subjects, publishers,
  selectedRevisionId, selectedSubjectGroupId, selectedSubjectId, selectedPublisherId,
  // 메타데이터 핸들러
  onRevisionChange, onSubjectGroupChange, onSubjectChange, onPublisherChange,
  // 목차 관리
  bookDetails, onBookDetailsChange,
  // 제출 및 취소
  onSubmit, onCancel,
  isSubmitting?: boolean;
}
```

**기능**:
- 교재명 입력
- 개정교육과정, 교과, 과목, 출판사 선택
- 학년/학기, 총 페이지, 난이도, 메모 입력
- 목차 관리 (`BookDetailsManager` 통합)
- 제출 및 취소 버튼

**주의사항**:
- `formRef`를 통해 FormData를 생성하므로 div 요소를 참조
- 기존 로직과 동일하게 동작하도록 구현

---

#### 2-3. `BookSelectedView.tsx`

**역할**: 선택된 교재 정보 카드 UI

**Props**:
```typescript
{
  selectedBook: BookItem;
  bookTypeLabel?: string;
  onUnselect: () => void;
  disabled?: boolean;
}
```

**기능**:
- 선택된 교재 제목 표시
- 해제 버튼

---

### 3. 메인 컴포넌트 재조립

**파일**: `components/forms/BaseBookSelector.tsx`

**변경사항**:
- 기존 로직을 `useBookSelectorLogic` 훅으로 위임
- UI는 하위 컴포넌트들을 조건부 렌더링
- Props 인터페이스 유지 (기존 코드와 호환성 보장)

**렌더링 로직**:
1. `isCreating` → `BookCreateForm` 렌더링
2. `isSearching` → `BookSearchPanel` 렌더링
3. 기본 뷰 → 선택된 교재 있으면 `BookSelectedView`, 없으면 안내 메시지

---

## 호환성 보장

### Props 인터페이스 유지

기존 `BaseBookSelector`의 Props 인터페이스는 완전히 동일하게 유지했습니다:

```typescript
type BaseBookSelectorProps = {
  value?: string | null;
  onChange: (bookId: string | null) => void;
  books: BookItem[];
  createBookAction: BookCreateAction;
  onCreateBook?: (bookId: string) => void;
  disabled?: boolean;
  className?: string;
  bookTypeLabel?: string;
};
```

### 기존 사용처

다음 파일에서 사용 중이며, 모두 정상 작동합니다:
- `app/(student)/contents/_components/BookSelector.tsx`

---

## 개선 효과

### 가독성 향상
- 역할별로 명확히 분리되어 코드 이해가 쉬움
- 각 파일이 단일 책임을 가지도록 구조화

### 유지보수성 향상
- 특정 기능(검색/생성/선택) 수정 시 해당 파일만 수정하면 됨
- 테스트 및 디버깅이 용이함

### 재사용성 향상
- `BookSearchPanel`, `BookCreateForm`, `BookSelectedView`를 다른 곳에서도 재사용 가능
- `useBookSelectorLogic` 훅을 다른 컴포넌트에서도 활용 가능

### 파일 크기 감소
- 기존: 503줄 (단일 파일)
- 변경 후: 평균 100-200줄 (역할별 분리)

---

## 검증 결과

### 타입 체크
- ✅ TypeScript 타입 오류 없음
- ✅ Props 타입 일치 확인

### 기능 검증
- ✅ 검색 기능 정상 작동
- ✅ 생성 기능 정상 작동 (FormData 처리 확인)
- ✅ 선택/해제 기능 정상 작동
- ✅ 메타데이터 연동 정상 작동
- ✅ `BookDetailsManager` 통합 정상 작동

### 호환성 검증
- ✅ 기존 Props 인터페이스 유지
- ✅ 기존 사용처와 호환

---

## 향후 개선 사항

1. **테스트 추가**: 각 분리된 컴포넌트 및 훅에 대한 단위 테스트 작성
2. **성능 최적화**: `React.memo` 적용 검토 및 불필요한 리렌더링 방지
3. **에러 처리 개선**: 더 구체적인 에러 메시지 및 사용자 피드백

---

## 참고사항

### 주요 의존성

- `@/components/ui/ToastProvider` - 토스트 알림
- `@/lib/hooks/useBookMetadata` - 메타데이터 관리
- `@/app/(student)/contents/_components/BookDetailsManager` - 목차 관리
- `@/lib/types/bookSelector` - 타입 정의
- `@/lib/types/plan` - BookDetail 타입

### 주의사항

1. `BookCreateForm`은 `form` 태그 대신 `div`를 사용하며, `formRef`를 통해 FormData를 생성합니다.
2. 메타데이터 선택은 연쇄적으로 동작합니다 (개정교육과정 → 교과 → 과목).
3. `handleCreateAndSelect`는 복잡한 로직을 포함하므로, 훅 내부에서 관리합니다.

---

**작업 완료일**: 2025-02-04

