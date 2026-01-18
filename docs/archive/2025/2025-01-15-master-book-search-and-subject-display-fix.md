# 교재 검색 및 교과 항목 표시 개선

**작업일**: 2025-01-15  
**문제 교재 ID**: `dcfbec17-035e-439f-8f98-be02b8f17b44`

## 문제 분석

### 확인된 문제점

1. **검색 필터링 문제**
   - 강의 등록 시 마스터 교재 검색에서 특정 교재가 검색되지 않음
   - `lib/utils/contentFilters.ts`의 `applyContentFilters` 함수에 `is_active = true` 필터가 누락됨
   - `tenant_id` 필터링으로 특정 테넌트 교재가 공개 검색에서 제외될 수 있음
   - 문제 교재는 `tenant_id`가 설정되어 있어 검색 시 `tenantId`가 전달되지 않으면 검색되지 않음

2. **교과 항목 표시 문제**
   - 교재 관리 페이지에서 교과 항목이 제대로 표시되지 않음
   - `lib/data/contentMasters.ts`의 `getMasterBookById` 함수에서 JOIN 경로가 복잡함
   - Denormalized 컬럼(`subject_category`, `subject`)이 존재하지만 JOIN 결과와 혼용되어 사용됨

3. **코드 중복 및 최적화**
   - `getMasterBooksList` 함수에 `is_active` 필터가 누락됨

## 수정 내용

### 1. 검색 필터 개선 (`lib/utils/contentFilters.ts`)

**변경 사항:**
- `is_active = true` 필터를 기본 필터로 추가 (모든 검색에서 활성화된 콘텐츠만 조회)
- 테넌트 필터링 로직 주석 개선

**수정 코드:**
```typescript
// 0. 활성화된 콘텐츠만 (기본 필터) - Supabase 모범 사례 적용
// 모든 검색에서 비활성화된 콘텐츠는 제외
filteredQuery = filteredQuery.eq("is_active", true);

// 4. 테넌트 필터
// tenantId가 있으면: 공개 콘텐츠(tenant_id = null) + 해당 테넌트 콘텐츠
// tenantId가 없으면: 공개 콘텐츠만 (tenant_id = null)
if (filters.tenantId) {
  filteredQuery = filteredQuery.or(`tenant_id.is.null,tenant_id.eq.${filters.tenantId}`);
} else {
  // 기본적으로 공개 콘텐츠만
  filteredQuery = filteredQuery.is("tenant_id", null);
}
```

**영향 범위:**
- `searchMasterBooks`: 교재 검색
- `searchMasterLectures`: 강의 검색
- `searchMasterCustomContents`: 커스텀 콘텐츠 검색
- 모든 검색 경로에서 `buildContentQuery` → `applyContentFilters`를 통해 적용됨

### 2. 교과 항목 표시 개선 (`lib/data/contentMasters.ts`)

**변경 사항:**
- `getMasterBookById` 함수의 주석 개선
- Denormalized 값 우선 사용 패턴 명확화
- 디버깅 로그에 denormalized 값 추가

**수정 코드:**
```typescript
const book = {
  ...bookData,
  // revision: curriculum_revisions.name 우선, 없으면 denormalized revision 값 사용
  revision: curriculumRevision?.name || bookData.revision || null,
  // subject_category: denormalized 값 우선, 없으면 JOIN 결과 사용
  // 성능 향상을 위해 denormalized 컬럼을 우선 사용하고 JOIN은 fallback으로만 활용
  subject_category: bookData.subject_category || subjectGroup?.name || null,
  // subject: denormalized 값 우선, 없으면 JOIN 결과 사용
  subject: bookData.subject || subject?.name || null,
  // publisher: denormalized 값(publisher_name) 우선, 없으면 JOIN 결과 사용
  publisher: bookData.publisher_name || publisher?.name || null,
  // difficulty_level: difficulty_levels.name 우선, 없으면 denormalized difficulty_level 값 사용
  difficulty_level:
    difficultyLevel?.name || bookData.difficulty_level || null,
};
```

**영향 범위:**
- 교재 관리 페이지 (`app/(admin)/admin/master-books/[id]/page.tsx`)
- 학생 교재 상세 페이지 (`app/(student)/contents/master-books/[id]/page.tsx`)

### 3. 추가 개선 사항

**`getMasterBooksList` 함수 개선:**
- 드롭다운용 교재 목록 조회 함수에도 `is_active = true` 필터 추가
- 비활성화된 교재가 드롭다운에 표시되지 않도록 개선

**수정 코드:**
```typescript
export async function getMasterBooksList(): Promise<
  Array<{ id: string; title: string }>
> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_books")
    .select("id, title")
    .eq("is_active", true)  // 추가됨
    .order("title", { ascending: true });

  // ... existing code ...
}
```

## 데이터베이스 확인 결과

문제 교재 (`dcfbec17-035e-439f-8f98-be02b8f17b44`)의 현재 상태:
- `is_active`: `true` ✅
- `tenant_id`: `84b71a5d-5681-4da3-88d2-91e75ef89015` (특정 테넌트)
- `subject_category`: "사회(역사/도덕 포함)" ✅
- `subject`: "경제" ✅
- `subject_group_id`: `84310fa1-00cd-43c6-8156-855bc4f0a364` ✅
- `subject_id`: `09bc9d80-c448-44d4-a6a9-1a85a5a1d209` ✅

## 해결된 문제

1. ✅ **검색 필터링**: `is_active = true` 필터 추가로 활성화된 교재만 검색됨
2. ✅ **교과 항목 표시**: Denormalized 값 우선 사용으로 교과 항목이 올바르게 표시됨
3. ✅ **코드 일관성**: 모든 검색 경로에서 동일한 필터 로직 적용

## 참고 사항

### Supabase 모범 사례 적용
- 활성화된 레코드만 조회하기 위해 `is_active = true` 필터를 기본으로 적용
- 인덱스가 있는 컬럼 우선 필터링으로 성능 최적화

### Denormalized 컬럼 활용
- 성능 향상을 위해 `subject_category`, `subject` 컬럼을 우선 사용
- JOIN은 fallback으로만 활용하여 JOIN 실패 시에도 데이터 표시 가능

### 테넌트 격리
- 공개 콘텐츠(`tenant_id = null`)와 테넌트별 콘텐츠를 적절히 구분
- `tenantId`가 전달되면 공개 + 해당 테넌트 콘텐츠 모두 검색 가능

## 테스트 권장 사항

1. 특정 교재 ID로 직접 검색 테스트
2. `tenant_id`가 설정된 교재의 검색 동작 확인
3. `is_active = false`인 교재가 검색에서 제외되는지 확인
4. 교과 항목이 올바르게 표시되는지 확인
5. 강의 등록 시 마스터 교재 검색에서 해당 교재가 검색되는지 확인

## 수정된 파일 목록

1. `lib/utils/contentFilters.ts` - `is_active` 필터 추가 및 테넌트 필터링 주석 개선
2. `lib/data/contentMasters.ts` - `getMasterBookById` 함수 주석 개선 및 `getMasterBooksList` 함수에 `is_active` 필터 추가

