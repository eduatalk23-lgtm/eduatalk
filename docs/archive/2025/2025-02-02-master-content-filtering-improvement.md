# 마스터 서비스 교재/강의 필터링 개선

## 작업 일자
2025-02-02

## 작업 개요
마스터 교재/강의 필터링을 텍스트 기반에서 테이블 기반으로 전환하고, 계층형 드롭다운 UI를 구현했습니다.

## 주요 변경 사항

### 1. 데이터 레이어 개선

#### `lib/data/contentMasters.ts`
- **필터 타입 업데이트**:
  - `MasterBookFilters`, `MasterLectureFilters`에 `curriculum_revision_id`, `subject_group_id` 추가
  - `revision`, `subject_category`, `subject` 텍스트 필드 제거
  - `ContentMasterFilters`도 동일하게 업데이트

- **검색 함수 업데이트**:
  - `searchMasterBooks`, `searchMasterLectures`에서 FK 기반 필터링으로 변경
  - `curriculum_revision_id`, `subject_group_id`, `subject_id`로 필터링

- **필터 옵션 조회 함수 추가**:
  - `getCurriculumRevisions()`: 활성화된 개정교육과정 목록 조회
  - `getSubjectGroupsForFilter(curriculumRevisionId?)`: 교과 목록 조회
  - `getSubjectsForFilter(subjectGroupId?)`: 과목 목록 조회

### 2. API 라우트 추가

- **`app/api/curriculum-revisions/route.ts`**: 개정교육과정 목록 조회
- **`app/api/subject-groups/route.ts`**: 교과 목록 조회 (개정교육과정별)
- **`app/api/subjects/route.ts`**: 과목 목록 조회 (교과별)

### 3. 계층형 드롭다운 컴포넌트

- **`app/(student)/contents/master-books/_components/HierarchicalFilter.tsx`**:
  - 개정교육과정 → 교과 → 과목 계층형 드롭다운 구현
  - 클라이언트 사이드에서 동적 로딩
  - `basePath` prop으로 재사용 가능

### 4. 학생 영역 페이지 업데이트

#### `app/(student)/contents/master-books/page.tsx`
- 필터 옵션 조회를 테이블 기반으로 변경
- `HierarchicalFilter` 컴포넌트 사용
- URL 파라미터를 `curriculum_revision_id`, `subject_group_id`, `subject_id`로 변경

#### `app/(student)/contents/master-lectures/page.tsx`
- 동일한 방식으로 개선

### 5. 관리자 영역 페이지 업데이트

#### `app/(admin)/admin/master-books/page.tsx`
- 필터 옵션 조회를 테이블 기반으로 변경
- `HierarchicalFilter` 컴포넌트 사용
- `subject_id` 텍스트 입력 필드를 드롭다운으로 변경

### 6. 플랜 그룹 생성 검색 영역 업데이트

#### `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`
- 과목 텍스트 입력을 계층형 드롭다운으로 변경
- 필터 파라미터를 ID 기반으로 변경
- 동적 로딩 로직 추가

#### `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`
- 과목 선택을 계층형 드롭다운으로 변경
- 검색 액션 파라미터 업데이트
- 동적 로딩 로직 추가

### 7. Server Actions 업데이트

#### `app/(student)/actions/contentMasterActions.ts`
- `searchContentMastersAction`의 필터 파라미터를 ID 기반으로 변경
- `searchMasterBooks`, `searchMasterLectures` 직접 호출로 변경

## 계층형 드롭다운 동작 방식

1. **개정교육과정 선택** → 해당 개정교육과정의 교과 목록 로드
2. **교과 선택** → 해당 교과의 과목 목록 로드
3. **과목 선택** → 필터링 적용

## 필터링 로직

```typescript
// 개정교육과정 필터링
if (filters.curriculum_revision_id) {
  query = query.eq("curriculum_revision_id", filters.curriculum_revision_id);
}

// 교과 필터링
if (filters.subject_group_id) {
  query = query.eq("subject_group_id", filters.subject_group_id);
}

// 과목 필터링
if (filters.subject_id) {
  query = query.eq("subject_id", filters.subject_id);
}
```

## 하위 호환성

- 기존 URL 파라미터(`revision`, `subject_category`, `subject`)는 제거됨
- 기존 북마크/링크는 동작하지 않을 수 있음 (의도된 변경)

## 테스트 포인트

1. ✅ 학생 영역 교재/강의 검색 페이지에서 계층형 필터링 동작 확인
2. ✅ 관리자 영역 교재 검색 페이지에서 필터링 동작 확인
3. ✅ 플랜 그룹 생성 시 마스터 콘텐츠 검색 동작 확인
4. ✅ 필터 옵션 로딩 및 계층 구조 표시 확인
5. ✅ 필터 조합 시 검색 결과 정확성 확인

## 참고 파일

- `lib/data/subjects.ts`: 교과/과목 조회 함수 (재사용)
- `lib/data/contentMasters.ts`: 마스터 콘텐츠 검색 함수
- `docs/교육과정-교과-과목-테이블-구조.md`: 테이블 구조 참고

