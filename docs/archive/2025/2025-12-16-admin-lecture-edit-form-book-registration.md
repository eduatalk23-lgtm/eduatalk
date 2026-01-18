# 관리자 페이지 강의 수정 폼 교재 등록 기능 추가

## 작업 일시
2025년 12월 16일

## 목표
관리자 페이지의 강의 수정 폼에서도 교재를 등록할 수 있도록 하고, 학생 페이지와 동일한 사용자 경험을 제공합니다.

## 문제점
1. **관리자 페이지 강의 수정 폼** (`MasterLectureEditForm.tsx`):
   - `FormSelect` 드롭다운으로만 기존 교재 선택 가능
   - 교재 등록 기능이 없음
   - `masterBooks`가 prop으로 전달되어 클라이언트에서 업데이트 불가

2. **학생 페이지와의 불일치**:
   - 학생 페이지는 `BookSelector`로 교재 등록 및 선택 가능
   - 관리자 페이지는 교재 등록 기능이 없어 사용자 경험이 일관되지 않음

## 해결 방안

### 1. 관리자용 교재 등록 액션 생성
- `createMasterBookWithoutRedirect`: redirect 없이 bookId 반환하는 액션
- `getMasterBooksListAction`: Server Action으로 교재 목록 조회

### 2. MasterBookSelector 컴포넌트 생성
- `BookSelector`를 기반으로 관리자용 교재 선택 컴포넌트 생성
- 마스터 교재 등록 및 선택 기능 제공

### 3. MasterLectureEditForm 개선
- `masterBooks`를 state로 관리하여 클라이언트에서 업데이트 가능
- `MasterBookSelector` 사용으로 교재 등록 기능 추가
- 교재 등록 후 목록 즉시 업데이트

## 구현 내용

### 수정/생성된 파일

#### 1. `app/(student)/actions/masterContentActions.ts`

**추가된 액션:**

1. **`getMasterBooksListAction`**: 마스터 교재 목록 조회 Server Action
```typescript
async function _getMasterBooksList(): Promise<Array<{ id: string; title: string }>> {
  await requireAdminOrConsultant();
  return await getMasterBooksList();
}

export const getMasterBooksListAction = withErrorHandling(_getMasterBooksList);
```

2. **`createMasterBookWithoutRedirect`**: redirect 없이 교재 생성
```typescript
export const createMasterBookWithoutRedirect = withErrorHandling(
  async (formData: FormData): Promise<{ success: true; bookId: string } | { success: false; error: string; bookId: null }> => {
    await requireAdminOrConsultant();
    // ... 교재 생성 로직
    return { success: true, bookId: book.id };
  }
);
```

#### 2. `app/(admin)/admin/master-lectures/_components/MasterBookSelector.tsx` (신규)

**주요 기능:**
- 마스터 교재 검색 및 선택
- 마스터 교재 등록 (폼 포함)
- 교재 목차 관리
- `createMasterBookWithoutRedirect` 사용

**학생용 BookSelector와의 차이점:**
- `createBookWithoutRedirect` → `createMasterBookWithoutRedirect`
- `studentBooks` → `masterBooks`
- 나머지 기능은 동일

#### 3. `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`

**주요 변경사항:**

1. **Import 추가**:
```typescript
import { updateMasterLectureAction, getMasterBooksListAction } from "@/app/(student)/actions/masterContentActions";
import { MasterBookSelector } from "../_components/MasterBookSelector";
```

2. **State 관리 변경**:
```typescript
// prop 이름을 initialMasterBooks로 변경
export function MasterLectureEditForm({
  lecture,
  episodes = [],
  masterBooks: initialMasterBooks = [],
  curriculumRevisions = [],
}: {
  // ...
}) {
  // state로 관리하여 클라이언트에서 업데이트 가능
  const [masterBooks, setMasterBooks] = useState<Array<{ id: string; title: string }>>(initialMasterBooks);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(lecture.linked_book_id || null);
```

3. **교재 목록 새로고침 함수 추가**:
```typescript
async function refreshMasterBooks() {
  try {
    const books = await getMasterBooksListAction();
    setMasterBooks(books);
    return books;
  } catch (error) {
    console.error("교재 목록 새로고침 실패:", error);
    return masterBooks;
  }
}
```

4. **FormSelect → MasterBookSelector 변경**:
```typescript
{/* 연결된 교재 */}
<div className="md:col-span-2">
  <MasterBookSelector
    value={selectedBookId}
    onChange={setSelectedBookId}
    masterBooks={masterBooks}
    onCreateBook={async (bookId) => {
      // 교재 등록 후 목록 새로고침
      const updatedBooks = await refreshMasterBooks();
      const newBook = updatedBooks.find((b) => b.id === bookId);
      if (newBook) {
        setSelectedBookId(bookId);
      } else {
        router.refresh();
        setSelectedBookId(bookId);
      }
    }}
  />
</div>
```

5. **handleSubmit에서 교재 ID 추가**:
```typescript
// 교재 ID 추가
if (selectedBookId) {
  formData.set("linked_book_id", selectedBookId);
} else {
  formData.set("linked_book_id", "");
}
```

## 효과

1. **사용자 경험 개선**: 관리자도 강의 수정 중 교재를 등록할 수 있음
2. **코드 일관성**: 학생 페이지와 관리자 페이지의 동작 방식 통일
3. **유지보수성**: 명확한 상태 관리로 코드 이해도 향상
4. **에러 처리**: 교재 목록 새로고침 실패 시 기존 목록 유지

## 테스트 항목

- [x] 교재 등록 후 목록이 즉시 업데이트되는지 확인
- [x] 새로 등록된 교재가 자동으로 선택되는지 확인
- [x] 에러 발생 시 적절한 처리 확인
- [x] 타입 안전성 확인 (린터 오류 없음)

## 참고 파일

- `app/(student)/contents/lectures/[id]/edit/LectureEditForm.tsx` - 학생 페이지 참고
- `app/(student)/contents/_components/BookSelector.tsx` - 학생용 BookSelector 참고
- `app/(student)/actions/masterContentActions.ts` - 마스터 교재 액션
- `lib/data/contentMasters.ts` - 마스터 교재 데이터 함수

