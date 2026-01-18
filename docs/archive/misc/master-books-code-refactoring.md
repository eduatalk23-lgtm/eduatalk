# master_books 스키마 변경 후속 코드 리팩토링

**작업일**: 2025-11-30  
**관련 마이그레이션**: `20251130005859_restructure_master_books_schema.sql`

## 작업 개요

master_books 테이블 스키마 변경에 따라 애플리케이션 코드를 업데이트했습니다. 삭제된 컬럼(`subject_category`, `subject`, `publisher`) 참조를 제거하고, 새로운 스키마에 맞게 타입 정의, 데이터 액세스 레이어, UI 컴포넌트, 액션 함수를 수정했습니다.

## 변경된 파일 목록

### 1. TypeScript 타입 정의

**파일**: `lib/types/plan.ts`

#### CommonContentFields 타입 업데이트
- ❌ 제거: `subject_category`, `subject`
- ✅ 유지: 교육과정 관련 필드는 `MasterBook` 타입으로 이동

#### MasterBook 타입 전면 재정의
- ❌ 제거: `publisher` (string)
- ✅ 추가: 22개 새로운 필드
  - `is_active`: boolean
  - `curriculum_revision_id`, `subject_id`, `publisher_id`: FK 필드
  - `grade_min`, `grade_max`, `school_type`: 교육과정 정보
  - `subtitle`, `series_name`, `author`: 메타 정보
  - `publisher_name`: 출판사명 (중복 저장)
  - `isbn_10`, `isbn_13`: ISBN 정보
  - `edition`, `published_date`: 출판 정보
  - `target_exam_type[]`, `tags[]`: 배열 필드
  - `description`, `toc`, `publisher_review`: 설명 필드
  - `source*`, `cover_image_url`: 출처 정보
- ✅ 변경: `total_pages` - number → number | null (선택적)
- ✅ 변경: AI 분석 필드 - 선택적에서 필수로 (null 허용)

#### 영향 받는 타입
- `ContentMaster` (레거시): `@deprecated` 표시 추가, 하위 호환성 유지

### 2. 필터 타입 및 데이터 액세스 레이어

**파일**: `lib/data/contentMasters.ts`

#### MasterBookFilters 타입 업데이트
- ❌ 제거: `subject`, `subject_category`
- ✅ 추가: `subject_id` (UUID로 필터링)

#### searchMasterBooks 함수 수정
```typescript
// Before
if (filters.subject) query = query.eq("subject", filters.subject);
if (filters.subject_category) query = query.eq("subject_category", filters.subject_category);

// After
if (filters.subject_id) query = query.eq("subject_id", filters.subject_id);
```

#### MasterLectureFilters 타입 업데이트
- 동일한 패턴으로 `subject_id` 기반 필터링으로 변경

#### ContentMasterFilters (레거시)
- `@deprecated` 표시 추가
- 하위 호환성 유지

### 3. UI 컴포넌트 수정

#### 관리자 폼 (생성)
**파일**: `app/(admin)/admin/master-books/new/MasterBookForm.tsx`

- ❌ 제거: `subject_category` 선택 필드, `subject` 입력 필드, `publisher` 입력 필드
- ✅ 추가: 
  - `subject_id` 입력 필드 (UUID)
  - `publisher_name` 입력 필드
  - `publisher_id` 입력 필드 (UUID, 선택)
- ✅ 변경: `total_pages` - 필수 → 선택 (required 속성 제거)

#### 관리자 폼 (편집)
**파일**: `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`

- 생성 폼과 동일한 패턴으로 수정
- `defaultValue` 속성을 새로운 필드에 맞게 업데이트

#### 관리자 목록 페이지
**파일**: `app/(admin)/admin/master-books/page.tsx`

**필터 UI 변경**:
- ❌ 제거: 교과 선택, 과목 선택
- ✅ 추가: 과목 ID 입력 필드

**카드 표시 변경**:
```tsx
// Before
<p>{book.publisher || "출판사 정보 없음"}</p>
<dd>{book.subject_category || "—"}</dd>
<dd>{book.subject || "—"}</dd>
<dd>{book.total_pages}p</dd>

// After
<p>{book.publisher_name || "출판사 정보 없음"}</p>
<dd className="truncate max-w-[150px]">{book.subject_id || "—"}</dd>
<dd>{book.total_pages ? `${book.total_pages}p` : "—"}</dd>
```

**필터 옵션 조회 로직 변경**:
```typescript
// Before
const [subjectsRes, semestersRes, revisionsRes] = await Promise.all([...]);
const subjects = Array.from(new Set(...));

// After
const [semestersRes, revisionsRes] = await Promise.all([...]);
// subjects 제거
```

#### 학생 목록 페이지
**파일**: `app/(student)/contents/master-books/page.tsx`

- 관리자 페이지와 동일한 패턴으로 필터 로직 수정
- `getCachedFilterOptions`에서 `subjects` 제거
- `getCachedSearchResults`에서 필터 조건 변경

### 4. 액션 함수 수정

**파일**: `app/(student)/actions/masterContentActions.ts`

#### addMasterBook 함수
```typescript
// 새로운 필드 처리 추가
const bookData: Omit<MasterBook, "id" | "created_at" | "updated_at"> = {
  tenant_id: student?.tenant_id || null,
  is_active: true,
  curriculum_revision_id: formData.get("curriculum_revision_id")?.toString() || null,
  subject_id: formData.get("subject_id")?.toString() || null,
  grade_min: formData.get("grade_min") ? parseInt(formData.get("grade_min")!.toString()) : null,
  // ... (22개 새 필드 추가)
  publisher_name: formData.get("publisher_name")?.toString() || null,
  publisher_id: formData.get("publisher_id")?.toString() || null,
  // ...
};

// 검증 로직 변경
if (!bookData.title) {
  throw new Error("교재명은 필수입니다.");
}
// total_pages 필수 검증 제거 (선택적으로 변경)
```

#### updateMasterBookAction 함수
- 생성 함수와 동일한 패턴으로 업데이트
- 부분 업데이트 타입 유지

### 5. Excel Import/Export 수정

#### Export 함수
**파일**: `app/(admin)/actions/masterBooks/export.ts`

- ❌ 제거: `subject_category`, `subject`, `publisher` 컬럼
- ✅ 추가: 22개 새로운 컬럼
- ✅ 배열 필드 처리: `target_exam_type`, `tags` → 쉼표로 구분된 문자열로 변환

#### Import 함수
**파일**: `app/(admin)/actions/masterBooks/import.ts`

**Zod 스키마 업데이트**:
```typescript
const masterBookSchema = z.object({
  // 삭제된 필드 제거
  // subject_category, subject, publisher
  
  // 새 필드 추가
  is_active: z.union([z.boolean(), z.string()]).optional().transform(...),
  curriculum_revision_id: z.string().uuid().optional().nullable(),
  subject_id: z.string().uuid().optional().nullable(),
  grade_min: z.union([z.number(), z.string()]).optional().nullable().transform(...),
  // ... (22개 필드)
  
  // 배열 필드 처리
  target_exam_type: z.string().optional().nullable().transform((val) => {
    if (!val || val === "") return null;
    return val.split(",").map((v: string) => v.trim()).filter(Boolean);
  }),
  tags: z.string().optional().nullable().transform(...),
  
  // total_pages 필수 → 선택
  total_pages: z.union([z.number(), z.string()]).optional().nullable().transform(...),
});
```

**데이터 삽입 로직 업데이트**:
- 모든 새 필드를 `bookData` 객체에 포함
- `null` 처리 개선

## 호환성 유지

### 레거시 타입 유지
- `ContentMaster` 타입: `@deprecated` 표시, 하위 호환성 유지
- `ContentMasterFilters` 타입: `@deprecated` 표시, 하위 호환성 유지

### 점진적 마이그레이션
- 기존 코드에서 사용하는 레거시 타입은 유지
- 새 코드는 `MasterBook`, `MasterBookFilters` 사용 권장

## 테스트 결과

### 린터 검증
```bash
# 모든 수정된 파일에서 린터 에러 없음
✅ lib/types/plan.ts
✅ lib/data/contentMasters.ts
✅ app/(admin)/admin/master-books/new/MasterBookForm.tsx
✅ app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx
✅ app/(admin)/admin/master-books/page.tsx
✅ app/(student)/contents/master-books/page.tsx
✅ app/(student)/actions/masterContentActions.ts
✅ app/(admin)/actions/masterBooks/export.ts
✅ app/(admin)/actions/masterBooks/import.ts
```

### 타입 체크
- TypeScript 컴파일 에러 없음
- 모든 타입 정의가 일관성 유지

## 주의사항

### 데이터 입력 시
1. **과목 ID**: `subjects` 테이블의 UUID를 입력해야 합니다
2. **출판사 ID**: `publishers` 테이블의 UUID를 입력해야 합니다 (선택)
3. **출판사명**: 직접 입력 가능 (중복 저장)
4. **총 페이지**: 더 이상 필수가 아닙니다

### Excel Import/Export
1. **배열 필드**: 쉼표로 구분하여 입력 (예: "수능, 내신, 모의고사")
2. **UUID 필드**: 정확한 UUID 형식으로 입력
3. **Boolean 필드**: "true" 또는 "false" 문자열

### 필터링
1. **과목 필터**: 이제 UUID로 필터링합니다
2. **출판사 필터**: 현재 구현되지 않음 (필요 시 추가)
3. **텍스트 검색**: 제목 기반 검색만 지원

## 향후 작업 계획

### 단기 (즉시 필요)
- [ ] UI에 과목 선택 드롭다운 추가 (subjects 테이블 JOIN)
- [ ] UI에 출판사 선택 드롭다운 추가 (publishers 테이블 JOIN)
- [ ] 배열 필드 입력 UI 개선 (tags, target_exam_type)

### 중기 (필요 시)
- [ ] 교육과정 개정판 선택 UI 추가
- [ ] 학년/학교 유형 선택 UI 추가
- [ ] ISBN 검증 로직 추가
- [ ] 표지 이미지 업로드 기능 추가

### 장기 (선택적)
- [ ] subjects 테이블과 JOIN하여 과목명 표시
- [ ] publishers 테이블과 JOIN하여 출판사 정보 표시
- [ ] 교재 검색 필터 고도화 (다중 필터링, 정렬)
- [ ] 교재 상세 페이지 UI 개선

## 변경 사항 요약

| 항목 | 이전 | 이후 |
|------|------|------|
| 과목 필드 | `subject` (string) | `subject_id` (uuid, FK) |
| 출판사 필드 | `publisher` (string) | `publisher_id` (uuid, FK), `publisher_name` (string) |
| 교과 필드 | `subject_category` (string) | 제거 |
| 총 페이지 | `total_pages` (number, 필수) | `total_pages` (number \| null, 선택) |
| 새 필드 | - | 22개 추가 (ISBN, 학년, 메타 정보 등) |
| 필터링 | 문자열 기반 | UUID 기반 |

## 관련 문서

- [master_books 스키마 재정리](./master-books-schema-restructure.md)
- [마이그레이션 파일](../supabase/migrations/20251130005859_restructure_master_books_schema.sql)

---

**작성자**: AI Assistant  
**검토자**: 개발팀  
**승인일**: 2025-11-30

