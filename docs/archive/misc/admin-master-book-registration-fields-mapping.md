# 관리자 교재 등록 페이지 필드 및 저장 필드 관계 정리

## 📋 개요

관리자가 `master_books` 테이블에 교재를 등록할 때 사용하는 페이지의 입력 필드와 실제 저장되는 데이터베이스 필드의 매핑 관계를 정리합니다.

---

## 🎯 페이지 구성

### 파일 위치
- **폼 컴포넌트**: `app/(admin)/admin/master-books/new/MasterBookForm.tsx`
- **액션**: `app/(student)/actions/masterContentActions.ts` → `addMasterBook()`
- **데이터 레이어**: `lib/data/contentMasters.ts` → `createMasterBook()`, `createBookDetail()`

---

## 📝 입력 필드 → 저장 필드 매핑

### 1. master_books 테이블 저장 필드

| 페이지 입력 필드 | FormData Key | 저장 테이블 컬럼 | FK 연결 | 비고 |
|----------------|--------------|-----------------|---------|------|
| **교재명** | `title` | `master_books.title` | - | 필수 |
| **개정교육과정** | `revision` (이름)<br>`curriculum_revision_id` (ID) | `master_books.revision`<br>`master_books.curriculum_revision_id` | `curriculum_revisions.id` | hidden input으로 ID 전송 |
| **학년/학기** | `semester` | `master_books.semester` | - | 예: "고3-1" |
| **교과 그룹** | (선택용, 저장 안 함) | - | - | 과목 선택을 위한 UI |
| **과목** | `subject_id` | `master_books.subject_id` | `subjects.id` | FK 연결 |
| **출판사** | `publisher_id`<br>`publisher_name` | `master_books.publisher_id`<br>`master_books.publisher_name` | `publishers.id` | ID는 FK, 이름은 텍스트 |
| **학교 유형** | `school_type` | `master_books.school_type` | - | MIDDLE/HIGH/OTHER |
| **최소 학년** | `grade_min` | `master_books.grade_min` | - | 1-3 |
| **최대 학년** | `grade_max` | `master_books.grade_max` | - | 1-3 |
| **총 페이지** | `total_pages` | `master_books.total_pages` | - | 숫자 |
| **난이도** | `difficulty_level` | `master_books.difficulty_level` | - | 개념/기본/심화 |
| **대상 시험 유형** | `target_exam_type` (체크박스 배열) | `master_books.target_exam_type` | - | text[] 배열 |
| **태그** | `tags` (쉼표 구분 문자열) | `master_books.tags` | - | text[] 배열로 변환 |
| **메모** | `notes` | `master_books.notes` | - | 텍스트 |

### 2. 자동 설정 필드

| 필드 | 값 | 비고 |
|------|-----|------|
| `tenant_id` | 현재 사용자의 tenant_id | `students` 테이블에서 조회 |
| `is_active` | `true` | 기본값 |
| `pdf_url` | `null` | 추후 업로드 |
| `ocr_data` | `null` | 추후 처리 |
| `page_analysis` | `null` | 추후 분석 |
| `overall_difficulty` | `null` | 추후 계산 |

### 3. 폼에 없지만 저장 가능한 필드

다음 필드들은 폼에는 없지만 `addMasterBook` 액션에서 처리 가능합니다:

| FormData Key | 저장 테이블 컬럼 | 비고 |
|--------------|-----------------|------|
| `subtitle` | `master_books.subtitle` | 부제목 |
| `series_name` | `master_books.series_name` | 시리즈명 |
| `author` | `master_books.author` | 저자 |
| `isbn_10` | `master_books.isbn_10` | ISBN-10 |
| `isbn_13` | `master_books.isbn_13` | ISBN-13 (UNIQUE) |
| `edition` | `master_books.edition` | 판본 |
| `published_date` | `master_books.published_date` | 출판일 |
| `description` | `master_books.description` | 설명 |
| `toc` | `master_books.toc` | 목차 |
| `publisher_review` | `master_books.publisher_review` | 출판사 리뷰 |
| `source` | `master_books.source` | 출처 |
| `source_product_code` | `master_books.source_product_code` | 출처 상품 코드 |
| `source_url` | `master_books.source_url` | 출처 URL |
| `cover_image_url` | `master_books.cover_image_url` | 표지 이미지 URL |
| `content_category` | `master_books.content_category` | 콘텐츠 카테고리 |

---

## 📚 book_details 테이블 저장 (교재 상세 정보)

### 입력 방식
- **컴포넌트**: `BookDetailsManager` (`app/(student)/contents/_components/BookDetailsManager.tsx`)
- **FormData Key**: `details` (JSON 문자열)

### 저장 필드 매핑

| FormData 구조 | 저장 테이블 컬럼 | FK 연결 | 비고 |
|--------------|-----------------|---------|------|
| `details[].major_unit` | `book_details.major_unit` | - | 대단원 |
| `details[].minor_unit` | `book_details.minor_unit` | - | 소단원 |
| `details[].page_number` | `book_details.page_number` | - | 페이지 번호 |
| `details[].display_order` | `book_details.display_order` | - | 표시 순서 |
| (자동 설정) | `book_details.book_id` | `master_books.id` | FK 연결 |

### 저장 프로세스

```typescript
// 1. master_books 테이블에 교재 저장
const book = await createMasterBook(bookData);

// 2. details JSON 파싱
const details = JSON.parse(formData.get("details"));

// 3. 각 상세 정보를 book_details 테이블에 저장
for (const detail of details) {
  await createBookDetail({
    book_id: book.id,  // ✅ master_books.id FK 연결
    major_unit: detail.major_unit || null,
    minor_unit: detail.minor_unit || null,
    page_number: detail.page_number,
    display_order: detail.display_order,
  });
}
```

---

## 🔗 FK 연결 관계

### 1. master_books 테이블의 FK

```
master_books
├── tenant_id → tenants.id (ON DELETE RESTRICT)
├── curriculum_revision_id → curriculum_revisions.id
├── subject_id → subjects.id
└── publisher_id → publishers.id
```

### 2. book_details 테이블의 FK

```
book_details
└── book_id → master_books.id (ON DELETE CASCADE)
```

**중요**: `book_details.book_id`는 `master_books.id`를 참조합니다.

---

## 📊 데이터 흐름

### 등록 프로세스

```
1. 사용자 입력 (MasterBookForm)
   ↓
2. FormData 생성
   - 직접 입력 필드
   - BookDetailsManager에서 생성된 details JSON
   ↓
3. addMasterBook(formData) 액션 호출
   ↓
4. 데이터 변환 및 검증
   - 배열 필드 처리 (target_exam_type, tags)
   - FK ID 추출 (curriculum_revision_id, subject_id, publisher_id)
   ↓
5. createMasterBook(bookData) 호출
   - master_books 테이블에 INSERT
   - 생성된 book.id 반환
   ↓
6. createBookDetail() 반복 호출
   - book_details 테이블에 각 상세 정보 INSERT
   - book_id = book.id (FK 연결)
   ↓
7. 완료 및 리다이렉트
```

### 상세 보기 프로세스

```
1. getMasterBookById(bookId) 호출
   ↓
2. master_books 테이블 조회
   - FK JOIN으로 관련 정보 조회
     * curriculum_revisions (개정교육과정 이름)
     * subjects (과목 이름)
     * publishers (출판사 이름)
   ↓
3. book_details 테이블 조회
   - book_id = master_books.id로 필터링
   - display_order로 정렬
   ↓
4. 통합 데이터 반환
```

---

## 🔍 코드 참조

### 주요 함수

#### 1. addMasterBook (액션)
```typescript:21:119:app/(student)/actions/masterContentActions.ts
export async function addMasterBook(formData: FormData) {
  // FormData에서 필드 추출
  const bookData = {
    curriculum_revision_id: formData.get("curriculum_revision_id")?.toString() || null,
    subject_id: formData.get("subject_id")?.toString() || null,
    publisher_id: formData.get("publisher_id")?.toString() || null,
    // ... 기타 필드
  };
  
  // master_books 테이블에 저장
  const book = await createMasterBook(bookData);
  
  // book_details 테이블에 상세 정보 저장
  const detailsJson = formData.get("details")?.toString();
  if (detailsJson) {
    const details = JSON.parse(detailsJson);
    for (const detail of details) {
      await createBookDetail({
        book_id: book.id,  // ✅ FK 연결
        // ... 상세 정보
      });
    }
  }
}
```

#### 2. createBookDetail (데이터 레이어)
```typescript:1029:1052:lib/data/contentMasters.ts
export async function createBookDetail(
  data: Omit<BookDetail, "id" | "created_at">
): Promise<BookDetail> {
  const { data: detail, error } = await supabase
    .from("book_details")
    .insert({
      book_id: data.book_id,  // ✅ master_books.id FK
      major_unit: data.major_unit,
      minor_unit: data.minor_unit,
      page_number: data.page_number,
      display_order: data.display_order,
    })
    .select()
    .single();
  
  return detail as BookDetail;
}
```

---

## ✅ 요약

### 저장 구조

1. **master_books 테이블**
   - 교재 기본 정보 저장
   - FK: `curriculum_revision_id`, `subject_id`, `publisher_id`, `tenant_id`

2. **book_details 테이블**
   - 교재 상세 정보 (목차, 페이지 정보) 저장
   - FK: `book_id` → `master_books.id`

### 핵심 포인트

- ✅ **FK 연결**: `book_details.book_id`는 `master_books.id`를 참조
- ✅ **계층 구조**: master_books (1) → book_details (N)
- ✅ **데이터 일관성**: master_books 삭제 시 book_details도 CASCADE 삭제
- ✅ **상세 정보**: BookDetailsManager 컴포넌트에서 관리, JSON으로 전송

---

## 📅 작성일
2025-01-XX

