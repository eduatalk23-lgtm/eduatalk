# 마스터 콘텐츠 검색 필터 재구성

## 작업 일시
2025-02-02

## 목표
마스터 콘텐츠 검색 필터를 재구성하여 정확한 테이블 연계 기반 필터만 사용하도록 변경했습니다. 학년/학기 필터는 제거하고, 출판사와 플랫폼 필터를 추가했습니다. 제목 검색은 유지합니다.

## 주요 변경 사항

### 1. 필터 타입 수정

#### `lib/data/contentMasters.ts`

**MasterBookFilters 타입 변경:**
- ❌ 제거: `semester?: string`
- ✅ 추가: `publisher_id?: string`
- ✅ 유지: `search?: string`

**MasterLectureFilters 타입 변경:**
- ❌ 제거: `semester?: string`
- ✅ 추가: `platform_id?: string`
- ✅ 유지: `search?: string`

**ContentMasterFilters 타입 변경:**
- ❌ 제거: `semester?: string`
- ✅ 추가: `publisher_id?: string` (교재용)
- ✅ 추가: `platform_id?: string` (강의용)

### 2. 검색 함수 수정

#### `searchMasterBooks()` 함수
- `semester` 필터 제거
- `publisher_id` 필터 추가
- `search` 필터 유지

#### `searchMasterLectures()` 함수
- `semester` 필터 제거
- `platform_id` 필터 추가
- `search` 필터 유지

### 3. 필터 옵션 조회 함수 추가

#### `getPublishersForFilter()` 함수 (신규)
- 활성화된 출판사만 조회
- `is_active = true` 필터 적용
- `display_order`, `name` 순으로 정렬

#### `getPlatformsForFilter()` 함수 (신규)
- 활성화된 플랫폼만 조회
- `is_active = true` 필터 적용
- `display_order`, `name` 순으로 정렬

#### `getSemesterList()` 함수
- `@deprecated` 태그 추가
- 하위 호환성을 위해 유지

### 4. API 엔드포인트 추가

#### `app/api/publishers/route.ts` (신규)
- GET: 출판사 목록 조회
- 활성화된 출판사만 반환

#### `app/api/platforms/route.ts` (신규)
- GET: 플랫폼 목록 조회
- 활성화된 플랫폼만 반환

### 5. HierarchicalFilter 컴포넌트 수정

#### `app/(student)/contents/master-books/_components/HierarchicalFilter.tsx`

**Props 변경:**
- ❌ 제거: `semesters: string[]`, `initialSemester?: string`
- ✅ 추가: `publishers?: Publisher[]` (교재용)
- ✅ 추가: `platforms?: Platform[]` (강의용)
- ✅ 추가: `initialPublisherId?: string` (교재용)
- ✅ 추가: `initialPlatformId?: string` (강의용)
- ✅ 추가: `contentType?: "book" | "lecture"` (교재/강의 구분)
- ✅ 유지: `searchQuery?: string`

**UI 변경:**
- 학년/학기 필터 제거
- 출판사 필터 추가 (교재용, `contentType === "book"`일 때만 표시)
- 플랫폼 필터 추가 (강의용, `contentType === "lecture"`일 때만 표시)
- 제목 검색 필드 유지

### 6. 학생 마스터 콘텐츠 페이지 수정

#### `app/(student)/contents/master-books/page.tsx`
- 필터 옵션 조회에서 학기 제거, 출판사 추가
- 검색 필터에서 `semester` 제거, `publisher_id` 추가
- HierarchicalFilter에 `publishers`, `contentType="book"` 전달

#### `app/(student)/contents/master-lectures/page.tsx`
- 필터 옵션 조회에서 학기 제거, 플랫폼 추가
- 검색 필터에서 `semester` 제거, `platform_id` 추가
- HierarchicalFilter에 `platforms`, `contentType="lecture"` 전달

### 7. 관리자 마스터 콘텐츠 페이지 수정

#### `app/(admin)/admin/master-books/page.tsx`
- HierarchicalFilter 사용으로 통일
- 필터 옵션 조회에서 학기 제거, 출판사 추가
- 검색 필터에서 `semester` 제거, `publisher_id` 추가

#### `app/(admin)/admin/master-lectures/page.tsx`
- HierarchicalFilter 사용으로 통일 (기존 폼 제거)
- 필터 옵션 조회에서 학기 제거, 플랫폼 추가
- 검색 필터에서 `semester` 제거, `platform_id` 추가

### 8. 플랜 그룹 생성 검색 컴포넌트 수정

#### `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`
- 제목 검색 필드 유지
- 출판사 필터 추가 (교재용)
- 플랫폼 필터 추가 (강의용)
- `searchContentMastersAction`에 `publisher_id` 또는 `platform_id` 전달

### 9. Server Actions 수정

#### `app/(student)/actions/contentMasterActions.ts`
- `_searchContentMasters()` 함수에서 `semester` 제거
- `publisher_id` 추가 (교재용)
- `platform_id` 추가 (강의용)

## 필터 구조

### 교재 검색 필터
1. 개정교육과정 (curriculum_revision_id)
2. 교과 (subject_group_id)
3. 과목 (subject_id)
4. 출판사 (publisher_id) - **신규**
5. 제목 검색 (search) - **유지**

### 강의 검색 필터
1. 개정교육과정 (curriculum_revision_id)
2. 교과 (subject_group_id)
3. 과목 (subject_id)
4. 플랫폼 (platform_id) - **신규**
5. 제목 검색 (search) - **유지**

## 데이터베이스 연계

모든 필터는 정확한 테이블 연계를 기반으로 합니다:

- **개정교육과정**: `curriculum_revisions` 테이블 (FK: `curriculum_revision_id`)
- **교과**: `subject_groups` 테이블 (FK: `subject_group_id`)
- **과목**: `subjects` 테이블 (FK: `subject_id`)
- **출판사**: `publishers` 테이블 (FK: `publisher_id`) - **신규**
- **플랫폼**: `platforms` 테이블 (FK: `platform_id`) - **신규**

## 하위 호환성

- 기존 URL 쿼리 파라미터 `semester`는 무시됩니다 (에러 없이 처리)
- `search` 파라미터는 계속 유지됩니다
- `getSemesterList()` 함수는 deprecated 처리되었지만 하위 호환성을 위해 유지됩니다

## 영향받는 페이지

1. 학생 마스터 교재 검색: `/contents/master-books`
2. 학생 마스터 강의 검색: `/contents/master-lectures`
3. 관리자 마스터 교재 목록: `/admin/master-books`
4. 관리자 마스터 강의 목록: `/admin/master-lectures`
5. 플랜 그룹 생성 - 콘텐츠 검색: `/plan/new-group` (Step 3)

## 테스트 체크리스트

- [ ] 학생 마스터 교재 검색에서 출판사 필터 동작 확인
- [ ] 학생 마스터 강의 검색에서 플랫폼 필터 동작 확인
- [ ] 관리자 마스터 교재 목록에서 출판사 필터 동작 확인
- [ ] 관리자 마스터 강의 목록에서 플랫폼 필터 동작 확인
- [ ] 플랜 그룹 생성에서 출판사/플랫폼 필터 동작 확인
- [ ] 제목 검색이 정상 동작하는지 확인
- [ ] 기존 URL 쿼리 파라미터 `semester`가 무시되는지 확인

