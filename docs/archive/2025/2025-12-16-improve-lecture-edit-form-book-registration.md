# 강의 수정 폼 교재 등록/연결 기능 개선

## 작업 일시
2025-12-16

## 개요
강의 수정 폼에서 교재 등록 후 연결 기능의 복잡한 로직을 단순화하고, BaseBookSelector의 호출 순서 문제를 해결했습니다.

## 문제점

### 1. BaseBookSelector 호출 순서 문제
- `onChange`를 먼저 호출하여 목록에 없을 때 UI 표시 문제 발생
- `onCreateBook`이 나중에 호출되어 목록 새로고침이 늦게 발생

### 2. 강의 수정 폼의 복잡한 로직
- `find` 체크 및 `router.refresh()` 등 불필요한 로직 포함
- 강의 등록 폼과 동작이 달라 일관성 부족

### 3. 중복 코드
- `refreshMasterBooks` 함수가 두 폼에 동일하게 중복됨

## 해결 방안

### 1. BaseBookSelector 개선
**파일**: `components/forms/BaseBookSelector.tsx`

**변경사항**:
- `onCreateBook`을 먼저 `await`로 실행하여 목록 새로고침 후 선택 보장
- `onCreateBook`이 없을 때만 `onChange` 호출
- 상태 초기화를 먼저 수행

**변경 전**:
```typescript
onChange(result.bookId);
// ... 상태 초기화 ...
if (onCreateBook) {
  onCreateBook(result.bookId);
}
```

**변경 후**:
```typescript
// 상태 초기화
setBookDetails([]);
setSelectedRevisionId("");
// ...

// onCreateBook을 먼저 await하여 목록 새로고침 후 선택
if (onCreateBook) {
  await onCreateBook(result.bookId);
} else {
  // onCreateBook이 없으면 직접 onChange 호출
  onChange(result.bookId);
}
```

### 2. 강의 수정 폼 단순화
**파일**: `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`

**변경사항**:
- `onCreateBook` 콜백을 강의 등록 폼과 동일하게 단순화
- 불필요한 `find` 체크 및 `router.refresh()` 제거
- `refreshMasterBooks()` 후 바로 `setSelectedBookId` 호출

**변경 전**:
```typescript
onCreateBook={async (bookId) => {
  const updatedBooks = await refreshMasterBooks();
  const newBook = updatedBooks.find((b) => b.id === bookId);
  if (newBook) {
    setSelectedBookId(bookId);
  } else {
    router.refresh();
    setSelectedBookId(bookId);
  }
}}
```

**변경 후**:
```typescript
onCreateBook={async (bookId) => {
  // 새 교재 생성 후 목록 새로고침
  await refreshMasterBooks();
  setSelectedBookId(bookId);
}}
```

### 3. 중복 코드 제거
**파일**: `lib/hooks/useMasterBooksRefresh.ts` (신규 생성)

**변경사항**:
- `refreshMasterBooks` 로직을 커스텀 훅으로 추출
- 두 폼에서 공통으로 사용

**훅 구현**:
```typescript
export function useMasterBooksRefresh(
  initialBooks: Array<{ id: string; title: string }>
) {
  const [masterBooks, setMasterBooks] = useState(initialBooks);
  
  const refreshMasterBooks = useCallback(async () => {
    try {
      const books = await getMasterBooksListAction();
      setMasterBooks(books);
      return books;
    } catch (error) {
      console.error("교재 목록 새로고침 실패:", error);
      return masterBooks;
    }
  }, [masterBooks]);
  
  return { masterBooks, refreshMasterBooks };
}
```

**사용 예시**:
```typescript
const { masterBooks, refreshMasterBooks } = useMasterBooksRefresh(initialMasterBooks);
```

## 수정된 파일

### 수정 파일
- `components/forms/BaseBookSelector.tsx`
- `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`

### 생성 파일
- `lib/hooks/useMasterBooksRefresh.ts`

## 데이터 흐름

```
사용자: "새 교재 등록" 클릭
  ↓
BaseBookSelector: handleCreateAndSelect 실행
  ↓
createBookAction: 교재 생성 (DB 저장)
  ↓
onCreateBook 콜백 호출 (await)
  ↓
refreshMasterBooks: 목록 새로고침
  ↓
setSelectedBookId: 선택 상태 업데이트
  ↓
UI: 새 교재 표시 및 선택됨
  ↓
사용자: "변경사항 저장" 클릭
  ↓
handleSubmit: selectedBookId를 FormData에 추가
  ↓
updateMasterLectureAction: DB에 연결 저장
```

## 테스트 시나리오

1. ✅ 새 교재 등록 후 자동 선택 확인
2. ✅ 교재 등록 중 버튼 비활성화 확인
3. ✅ 교재 등록 후 목록에 표시 확인
4. ✅ "변경사항 저장" 후 연결 저장 확인
5. ✅ 강의 등록 폼과 동일한 동작 확인

## 개선 효과

1. **코드 일관성**: 강의 등록 폼과 수정 폼의 동작이 동일해짐
2. **코드 재사용성**: 중복 코드를 훅으로 추출하여 재사용 가능
3. **안정성**: 호출 순서 문제 해결로 UI 표시 문제 개선
4. **유지보수성**: 단순화된 로직으로 이해하기 쉬워짐

