# 관리자 페이지 개정교육과정 선택 형식 변경

## 작업 개요

관리자 페이지의 서비스 마스터 - 교재 관리와 강의 관리의 등록/수정 페이지에서 개정교육과정 필드를 입력(input) 형식에서 선택(select) 형식으로 변경했습니다.

## 변경 사항

### 1. 교재 관리

#### 등록 페이지
- **파일**: `app/(admin)/admin/master-books/new/page.tsx`
- **변경 내용**:
  - `getActiveCurriculumRevision()` 제거
  - `getCurriculumRevisions()` 추가하여 모든 개정교육과정 목록 조회
  - `MasterBookForm`에 `curriculumRevisions` props 전달

#### 등록 폼
- **파일**: `app/(admin)/admin/master-books/new/MasterBookForm.tsx`
- **변경 내용**:
  - `curriculumRevisions` props 추가 (타입: `CurriculumRevision[]`)
  - 개정교육과정 input 필드를 select 드롭다운으로 변경
  - 개정교육과정 목록에서 선택 가능하도록 구현

#### 수정 페이지
- **파일**: `app/(admin)/admin/master-books/[id]/edit/page.tsx`
- **변경 내용**:
  - `getCurriculumRevisions()` 추가하여 모든 개정교육과정 목록 조회
  - `MasterBookEditForm`에 `curriculumRevisions` props 전달

#### 수정 폼
- **파일**: `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`
- **변경 내용**:
  - `curriculumRevisions` props 추가 (타입: `CurriculumRevision[]`)
  - 개정교육과정 input 필드를 select 드롭다운으로 변경
  - 기존 값이 있을 경우 default value로 설정

### 2. 강의 관리

#### 등록 페이지
- **파일**: `app/(admin)/admin/master-lectures/new/page.tsx`
- **변경 내용**:
  - `getCurriculumRevisions()` 추가하여 모든 개정교육과정 목록 조회
  - `MasterLectureForm`에 `curriculumRevisions` props 전달

#### 등록 폼
- **파일**: `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`
- **변경 내용**:
  - `curriculumRevisions` props 추가 (타입: `CurriculumRevision[]`)
  - 개정교육과정 input 필드를 select 드롭다운으로 변경
  - 연결된 교재 등록 섹션의 개정교육과정은 readOnly로 유지 (강의 입력값 참고)

#### 수정 페이지
- **파일**: `app/(admin)/admin/master-lectures/[id]/edit/page.tsx`
- **변경 내용**:
  - `getCurriculumRevisions()` 추가하여 모든 개정교육과정 목록 조회
  - `MasterLectureEditForm`에 `curriculumRevisions` props 전달

#### 수정 폼
- **파일**: `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`
- **변경 내용**:
  - `curriculumRevisions` props 추가 (타입: `CurriculumRevision[]`)
  - 개정교육과정 input 필드를 select 드롭다운으로 변경
  - 기존 값이 있을 경우 default value로 설정

## 구현 상세

### 데이터 조회 함수
- **함수**: `getCurriculumRevisions()` (`lib/data/contentMetadata.ts`)
- **기능**: 모든 개정교육과정 목록을 조회하여 반환
- **정렬**: 이름(name) 기준 오름차순

### 타입 정의
- **타입**: `CurriculumRevision`
- **필드**:
  - `id: string`
  - `name: string`
  - `year?: number | null`
  - `display_order?: number`
  - `is_active: boolean`
  - `created_at?: string`
  - `updated_at?: string`

### Select 드롭다운 구현
- 옵션 값: `revision.name` (개정교육과정 이름)
- 첫 번째 옵션: "선택하세요" (빈 값)
- 기본 스타일: 교과 그룹, 출판사와 동일한 스타일 적용

## 장점

1. **일관성**: 교과 그룹, 출판사와 동일한 선택 형식으로 통일
2. **데이터 정확성**: 직접 입력으로 인한 오타 방지
3. **사용자 편의성**: 드롭다운에서 쉽게 선택 가능
4. **데이터 표준화**: 기존에 등록된 개정교육과정만 사용하여 일관성 유지

## 참고 사항

- 연결된 교재 등록 섹션(강의 등록 폼)의 개정교육과정은 readOnly input으로 유지
  - 이유: 강의 입력값을 자동으로 참고하는 필드이므로
- 개정교육과정이 없을 경우 빈 배열로 처리되어 오류 없이 동작
- 기존에 입력된 개정교육과정 값이 새로운 목록에 없는 경우에도 기본값으로 표시됨

## 테스트 확인 사항

- [ ] 교재 등록 시 개정교육과정 선택 가능
- [ ] 교재 수정 시 기존 개정교육과정 값이 정확히 표시됨
- [ ] 강의 등록 시 개정교육과정 선택 가능
- [ ] 강의 수정 시 기존 개정교육과정 값이 정확히 표시됨
- [ ] 개정교육과정 목록이 올바르게 로드됨
- [ ] 빈 값 선택 시 정상적으로 저장됨

## 추가 개선 사항

### 개정교육과정 선택에 따른 교과 그룹 필터링

교재 등록/수정 페이지에서 개정교육과정을 선택하면, 해당 개정교육과정에 속한 교과 그룹만 표시되도록 개선했습니다.

#### 구현 내용
- **서버 액션 추가**: `getSubjectGroupsWithSubjectsAction` 추가 (`app/(admin)/actions/subjectActions.ts`)
- **동적 로딩**: 개정교육과정 선택 시 해당 개정교육과정의 교과 그룹을 서버에서 동적으로 조회
- **상태 관리**: 
  - `selectedRevisionId`: 선택된 개정교육과정 ID 추적
  - `subjectGroups`: 현재 선택된 개정교육과정의 교과 그룹 목록
  - `loadingGroups`: 교과 그룹 로딩 상태
- **UX 개선**:
  - 개정교육과정 미선택 시 교과 그룹 드롭다운 비활성화
  - 로딩 중 상태 표시
  - 안내 메시지 추가

#### 변경된 파일
- `app/(admin)/actions/subjectActions.ts`: `getSubjectGroupsWithSubjectsAction` 서버 액션 추가
- `app/(admin)/admin/master-books/new/MasterBookForm.tsx`: 개정교육과정 선택 시 교과 그룹 동적 로딩
- `app/(admin)/admin/master-books/new/page.tsx`: 초기 교과 그룹 데이터 로딩 제거
- `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`: 수정 페이지에도 동일 로직 적용
- `app/(admin)/admin/master-books/[id]/edit/page.tsx`: 초기 교과 그룹 데이터 로딩 제거

## 작업 일자

2024년 11월 29일

