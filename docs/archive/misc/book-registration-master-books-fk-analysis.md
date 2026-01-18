# 교재 등록 및 master_books FK 연결 분석

## 📋 현재 상황 분석

### 1. 데이터베이스 스키마 설계 (ERD)

ERD 설계에는 다음과 같은 구조가 정의되어 있습니다:

```sql
-- student_books 테이블 (ERD 설계)
CREATE TABLE student_books (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  master_book_id uuid NOT NULL REFERENCES master_books(id) ON DELETE RESTRICT,
  -- ... 기타 필드
);
```

**설계 의도**: 학생 교재는 `master_books` 테이블과 FK로 연결되어야 함

### 2. 실제 구현 현황

#### 2.1. 테이블 구조
- **실제 사용 테이블**: `books` (ERD의 `student_books`가 아님)
- **FK 연결**: `books.master_content_id` 컬럼 존재 (nullable)
- **참조**: `master_books.id`를 참조하도록 설계됨

#### 2.2. 교재 등록 로직 (`app/(student)/actions/contentActions.ts`)

```typescript:21:98:app/(student)/actions/contentActions.ts
export async function addBook(formData: FormData) {
  // ...
  const result = await createBookData({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    title,
    revision: revision || null,
    semester: semester || null,
    subject_category: subjectCategory || null,
    subject: subject || null,
    publisher: publisher || null,
    difficulty_level: difficulty || null,
    total_pages: totalPages || null,
    notes: notes || null,
  });
  // ❌ master_content_id가 설정되지 않음
}
```

**문제점**: 
- `master_content_id`를 설정하지 않고 직접 `books` 테이블에 저장
- `master_books` 테이블과의 FK 연결이 이루어지지 않음

#### 2.3. 교재 상세 보기 로직 (`app/(student)/contents/books/[id]/page.tsx`)

```typescript:47:80:app/(student)/contents/books/[id]/page.tsx
// 교재 상세 정보 조회 (학생 교재 상세 정보 우선, 없으면 마스터 참조)
let bookDetails: Array<{...}> = [];

// 먼저 학생 교재 상세 정보 조회
const { data: studentDetails } = await supabase
  .from("student_book_details")
  .select("id,major_unit,minor_unit,page_number,display_order")
  .eq("book_id", id)
  .order("display_order", { ascending: true })
  .order("page_number", { ascending: true });

if (studentDetails && studentDetails.length > 0) {
  bookDetails = studentDetails.map(d => ({...}));
} else if (book.master_content_id) {
  // ✅ master_content_id가 있으면 마스터 참조
  try {
    const { details } = await getMasterBookById(book.master_content_id);
    bookDetails = details.map(d => ({...}));
  } catch (err) {
    console.error("마스터 교재 상세 정보 조회 실패:", err);
  }
}
```

**현재 동작**:
- `master_content_id`가 있으면 마스터 교재의 상세 정보를 참조
- 하지만 등록 시 `master_content_id`가 설정되지 않아 이 기능이 작동하지 않음

#### 2.4. 교재 등록 폼 (`app/(student)/contents/books/new/page.tsx`)

```typescript:85:131:app/(student)/contents/books/new/page.tsx
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);

  // 개정교육과정, 교과, 과목, 출판사 이름만 추가
  // ❌ master_content_id 선택 UI가 없음
  // ❌ master_books 테이블에서 교재를 검색/선택하는 기능이 없음
}
```

**문제점**:
- `master_books` 테이블에서 교재를 검색/선택하는 UI가 없음
- 사용자가 직접 입력한 정보만 저장됨

## 🔍 문제점 요약

### 1. 설계와 구현의 불일치
- **ERD 설계**: `student_books` 테이블이 `master_books`와 FK로 연결
- **실제 구현**: `books` 테이블 사용, `master_content_id`는 nullable이고 등록 시 설정되지 않음

### 2. 교재 등록 프로세스의 문제
- ❌ `master_books` 테이블과의 연결이 없음
- ❌ 등록 시 `master_content_id`가 설정되지 않음
- ❌ 마스터 교재 검색/선택 기능이 없음

### 3. 데이터 중복 및 일관성 문제
- 학생이 직접 입력한 교재 정보가 `books` 테이블에 저장됨
- `master_books`에 이미 존재하는 교재와 중복될 수 있음
- 마스터 교재의 상세 정보(목차, 페이지 분석 등)를 활용할 수 없음

## ✅ 올바른 구현 방식

### 1. 교재 등록 프로세스 개선

#### 옵션 A: 마스터 교재 선택 방식 (권장)
```
1. 사용자가 교재명을 입력
2. master_books 테이블에서 검색
3. 검색 결과에서 선택하거나, 없으면 새로 생성
4. books 테이블에 저장 시 master_content_id 설정
```

#### 옵션 B: 자동 매칭 방식
```
1. 사용자가 교재 정보 입력
2. master_books 테이블에서 자동 매칭 시도 (ISBN, 제목 등)
3. 매칭되면 master_content_id 설정, 없으면 NULL
```

### 2. 코드 수정 필요 사항

#### 2.1. 교재 등록 폼에 마스터 교재 검색 기능 추가
```typescript
// app/(student)/contents/books/new/page.tsx
// - master_books 검색 UI 추가
// - 검색 결과에서 선택하는 기능
// - 선택한 master_book_id를 formData에 포함
```

#### 2.2. 교재 등록 액션에 master_content_id 설정
```typescript
// app/(student)/actions/contentActions.ts
export async function addBook(formData: FormData) {
  const masterBookId = formData.get("master_book_id")?.toString() || null;
  
  const result = await createBookData({
    // ... 기존 필드
    master_content_id: masterBookId, // ✅ 추가
  });
}
```

#### 2.3. createBookData 함수 수정
```typescript
// lib/data/studentContents.ts
export async function createBook(book: {
  // ... 기존 필드
  master_content_id?: string | null; // ✅ 추가
}) {
  const payload = {
    // ... 기존 필드
    master_content_id: book.master_content_id || null, // ✅ 추가
  };
}
```

## 📝 권장 사항

### 1. 단기 개선 (현재 구조 유지)
- 교재 등록 폼에 `master_books` 검색 기능 추가
- 선택한 마스터 교재의 ID를 `master_content_id`로 저장
- 상세 보기에서 마스터 교재 정보 활용 (이미 구현됨)

### 2. 장기 개선 (스키마 정리)
- ERD 설계대로 `student_books` 테이블 사용 검토
- 또는 현재 `books` 테이블 구조를 명확히 문서화
- `master_content_id`의 역할과 사용 규칙 명확히 정의

## 🔗 관련 파일

- `app/(student)/actions/contentActions.ts` - 교재 등록 액션
- `app/(student)/contents/books/new/page.tsx` - 교재 등록 폼
- `lib/data/studentContents.ts` - 교재 데이터 생성 함수
- `app/(student)/contents/books/[id]/page.tsx` - 교재 상세 보기
- `lib/data/contentMasters.ts` - 마스터 교재 조회 함수

## 📅 작성일
2025-01-XX

