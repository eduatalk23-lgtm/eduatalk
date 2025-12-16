<!-- cc500aeb-c2e8-458b-a751-48dedfe7cfc1 14dfd0a8-4cd1-46b6-add4-5e53277f9b70 -->
# 강의 수정 페이지 교재 등록 기능 개선 및 코드 최적화

## 목표

1. 강의 수정 페이지에서 교재 등록 후 목록 자동 새로고침
2. `BookSelector` 컴포넌트의 교재 등록 폼에 메타데이터 드롭다운 추가 (개정교육과정, 교과, 과목, 출판사)
3. 중복 코드 최적화: 메타데이터 로딩 로직을 커스텀 훅으로 추출

## 현재 상태 분석

### 문제점

1. **`LectureEditForm.tsx`**: `onCreateBook` 콜백이 없어서 교재 등록 후 목록이 새로고침되지 않음
2. **`BookSelector.tsx`**: 교재 등록 폼에 메타데이터가 하드코딩된 텍스트 입력 필드로 되어 있음 (드롭다운 없음)
3. **중복 코드**: `NewBookPage.tsx`, `BookSelector.tsx`, `LectureLinkedBookSection.tsx`에 메타데이터 로딩 로직이 중복됨

### 데이터베이스 확인

- `lectures` 테이블: `linked_book_id` 컬럼 존재 (nullable UUID, FK to books.id)
- `books` 테이블: `curriculum_revision_id`, `subject_group_id`, `subject_id`, `publisher_id` 컬럼 존재

## 구현 계획

### 1. 메타데이터 로딩 커스텀 훅 생성

**파일**: `lib/hooks/useBookMetadata.ts` (신규)

메타데이터 로딩 로직을 재사용 가능한 커스텀 훅으로 추출:

- 개정교육과정 목록
- 교과 그룹 목록 (개정교육과정 선택 시)
- 과목 목록 (교과 그룹 선택 시)
- 출판사 목록
- 선택된 ID 상태 관리
- 자동 로딩 로직 (의존성 변경 시)

### 2. BookSelector 컴포넌트 개선

**파일**: `app/(student)/contents/_components/BookSelector.tsx`

변경사항:

- `useBookMetadata` 훅 사용
- 교재 등록 폼에 메타데이터 드롭다운 추가:
  - 개정교육과정 (select)
  - 교과 (select, 개정교육과정 선택 시 활성화)
  - 과목 (select, 교과 선택 시 활성화)
  - 출판사 (select)
- 하드코딩된 텍스트 입력 필드 제거
- `handleCreateAndSelect` 함수에서 선택된 메타데이터 ID를 이름으로 변환하여 FormData에 추가

### 3. LectureEditForm 컴포넌트 수정

**파일**: `app/(student)/contents/lectures/[id]/edit/LectureEditForm.tsx`

변경사항:

- `onCreateBook` 콜백 추가
- `router.refresh()` 호출하여 교재 목록 새로고침
- `getStudentBooksAction`을 사용하여 교재 목록 상태 업데이트 (선택사항)

### 4. 코드 최적화

**파일**: `app/(student)/contents/books/new/page.tsx`

변경사항:

- `useBookMetadata` 훅 사용하여 중복 코드 제거

## 구현 세부사항

### useBookMetadata 훅 인터페이스

```typescript
type UseBookMetadataReturn = {
  // 메타데이터 목록
  revisions: Array<{ id: string; name: string }>;
  subjectGroups: SubjectGroup[];
  subjects: Subject[];
  publishers: Array<{ id: string; name: string }>;
  
  // 선택된 ID
  selectedRevisionId: string;
  selectedSubjectGroupId: string;
  selectedSubjectId: string;
  selectedPublisherId: string;
  
  // 선택 핸들러
  setSelectedRevisionId: (id: string) => void;
  setSelectedSubjectGroupId: (id: string) => void;
  setSelectedSubjectId: (id: string) => void;
  setSelectedPublisherId: (id: string) => void;
  
  // 로딩 상태
  isLoading: boolean;
  
  // FormData 변환 헬퍼
  populateFormDataWithMetadata: (formData: FormData) => void;
};
```

### BookSelector 교재 등록 폼 구조

```tsx
<form onSubmit={handleCreateAndSelect}>
  {/* 교재명 */}
  <input name="title" required />
  
  {/* 개정교육과정 */}
  <select value={selectedRevisionId} onChange={...}>
    {revisions.map(...)}
  </select>
  
  {/* 교과 */}
  <select 
    value={selectedSubjectGroupId} 
    disabled={!selectedRevisionId}
    onChange={...}
  >
    {subjectGroups.map(...)}
  </select>
  
  {/* 과목 */}
  <select 
    value={selectedSubjectId} 
    disabled={!selectedSubjectGroupId}
    onChange={...}
  >
    {subjects.map(...)}
  </select>
  
  {/* 출판사 */}
  <select value={selectedPublisherId} onChange={...}>
    {publishers.map(...)}
  </select>
  
  {/* 기타 필드 (학년/학기, 총 페이지, 난이도, 메모) */}
  {/* BookDetailsManager */}
</form>
```

## 참고사항

### 모범 사례 (React Hook Form, 2025)

- 폼 로직을 UI와 분리
- 재사용 가능한 컴포넌트 사용
- 메타데이터 로딩을 커스텀 훅으로 추출하여 중복 제거

### 데이터 흐름

```
사용자 액션
  ↓
BookSelector (교재 등록 버튼 클릭)
  ↓
useBookMetadata (메타데이터 로딩)
  ↓
교재 등록 폼 표시 (드롭다운 포함)
  ↓
handleCreateAndSelect (폼 제출)
  ↓
createBookWithoutRedirect (서버 액션)
  ↓
onCreateBook 콜백 (LectureEditForm)
  ↓
router.refresh() (교재 목록 새로고침)
```

## 테스트 체크리스트

- [ ] 강의 수정 페이지에서 교재 등록 후 목록이 자동으로 새로고침되는지 확인
- [ ] BookSelector의 교재 등록 폼에 메타데이터 드롭다운이 정상 작동하는지 확인
- [ ] 개정교육과정 선택 시 교과 목록이 로드되는지 확인
- [ ] 교과 선택 시 과목 목록이 로드되는지 확인
- [ ] 교재 등록 후 선택된 교재가 자동으로 연결되는지 확인
- [ ] NewBookPage에서도 정상 작동하는지 확인 (리팩토링 후)