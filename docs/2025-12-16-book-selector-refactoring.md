# 교재 선택 컴포넌트 리팩토링

## 작업 일자
2025-12-16

## 목표
1. BookSelector와 MasterBookSelector의 중복 코드 제거
2. form 중첩 문제 해결 (BookSelector도 div 기반으로 변경)
3. 공통 컴포넌트 추출로 유지보수성 향상
4. 타입 안전성 및 성능 최적화

## 변경 사항

### 1. 공통 컴포넌트 생성

#### BaseBookSelector (`components/forms/BaseBookSelector.tsx`)
- BookSelector와 MasterBookSelector의 공통 로직을 추출한 컴포넌트
- div + useRef 패턴 사용 (form 중첩 문제 해결)
- React.memo, useCallback, useMemo를 사용한 성능 최적화
- Props:
  - `value`: 현재 선택된 교재 ID
  - `onChange`: 교재 선택 변경 콜백
  - `books`: 교재 목록
  - `createBookAction`: 교재 생성 Server Action
  - `onCreateBook`: 새 교재 생성 후 콜백 (선택)
  - `disabled`: 비활성화 여부
  - `className`: 추가 CSS 클래스
  - `bookTypeLabel`: "교재" 또는 "마스터 교재" (기본값: "교재")

#### 공통 타입 정의 (`lib/types/bookSelector.ts`)
- `BookCreateResult`: 교재 생성 결과 타입
- `BookItem`: 교재 아이템 타입
- `BookCreateAction`: 교재 생성 액션 타입

### 2. BookSelector 리팩토링

**변경 전:**
- `<form>` 태그 사용 (부모 form과 중첩 가능)
- 약 435줄의 중복 코드

**변경 후:**
- BaseBookSelector를 래핑하는 간단한 컴포넌트
- 약 25줄로 축소
- form 중첩 문제 해결

**파일:** `app/(student)/contents/_components/BookSelector.tsx`

### 3. MasterBookSelector 리팩토링

**변경 전:**
- div + useRef 패턴 사용 (이미 해결됨)
- 약 465줄의 중복 코드

**변경 후:**
- BaseBookSelector를 래핑하는 간단한 컴포넌트
- 약 30줄로 축소

**파일:** `app/(admin)/admin/master-lectures/_components/MasterBookSelector.tsx`

### 4. 관리자 강의 등록 폼에 교재 선택 추가

**변경 사항:**
- `app/(admin)/admin/master-lectures/new/page.tsx`: masterBooks 목록 조회 추가
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`: MasterBookSelector 컴포넌트 추가
- 교재 선택 시 `linked_book_id`를 FormData에 추가

**기능:**
- 기존 교재 검색 및 선택
- 새 교재 등록 및 선택
- 교재 목록 자동 새로고침

## 성능 최적화

### React.memo
- BaseBookSelector를 React.memo로 감싸서 불필요한 리렌더링 방지

### useCallback
- `handleSelectBook`: 교재 선택 핸들러
- `handleUnselectBook`: 교재 해제 핸들러
- `handleCreateAndSelect`: 교재 생성 및 선택 핸들러

### useMemo
- `filteredBooks`: 검색 쿼리 기반 필터링된 교재 목록
- `selectedBook`: 현재 선택된 교재 정보

## 타입 안전성 개선

### 공통 타입 정의
- `BookCreateResult`: 교재 생성 결과 타입 통일
- `BookItem`: 교재 아이템 타입 통일
- `BookCreateAction`: 교재 생성 액션 타입 통일

### Server Action 타입 통일
- `createBookWithoutRedirect`와 `createMasterBookWithoutRedirect`의 반환 타입이 이미 통일되어 있음
- 공통 타입 `BookCreateResult`로 명시적 정의

## Form 중첩 문제 해결

### 문제
- BookSelector가 `<form>` 태그를 사용하여 부모 form과 중첩될 수 있음
- React Hook Form은 nested forms를 지원하지 않음

### 해결
- BaseBookSelector에서 div + useRef 패턴 사용
- FormData는 ref를 통해 수집
- 제출 버튼은 `type="button"`으로 변경하고 `onClick` 핸들러 사용

## 사용 위치

### BookSelector
- `app/(student)/contents/lectures/[id]/edit/LectureEditForm.tsx` - 학생 강의 수정 폼

### MasterBookSelector
- `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx` - 관리자 강의 수정 폼
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx` - 관리자 강의 등록 폼 (신규 추가)

## 테스트 체크리스트

- [x] 학생 강의 수정 폼에서 교재 선택/등록 테스트
- [x] 관리자 강의 수정 폼에서 교재 선택/등록 테스트
- [x] 관리자 강의 등록 폼에서 교재 선택/등록 테스트
- [x] Form 중첩 문제 해결 확인
- [x] 성능 최적화 적용 확인
- [x] 타입 안전성 확인

## 파일 변경 목록

### 신규 파일
- `components/forms/BaseBookSelector.tsx` - 공통 컴포넌트
- `lib/types/bookSelector.ts` - 공통 타입 정의
- `docs/2025-12-16-book-selector-refactoring.md` - 문서

### 수정 파일
- `app/(student)/contents/_components/BookSelector.tsx` - BaseBookSelector 사용, form → div 변경
- `app/(admin)/admin/master-lectures/_components/MasterBookSelector.tsx` - BaseBookSelector 사용
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx` - 교재 선택 기능 추가
- `app/(admin)/admin/master-lectures/new/page.tsx` - masterBooks 목록 전달 추가

## 참고 사항

### React Hook Form 모범 사례
- React Hook Form은 nested forms를 지원하지 않음
- FormProvider를 사용하거나 독립적인 form으로 분리해야 함
- 현재 구현은 div + useRef 패턴으로 해결 (권장 방식)

### 데이터베이스 스키마
- `master_lectures.linked_book_id` (uuid, nullable) - FK to master_books.id
- `lectures.linked_book_id` (uuid, nullable) - FK to books.id

### 성능 고려사항
- 교재 목록은 서버에서 초기 로드 후 클라이언트 상태로 관리
- 새 교재 생성 시 목록 새로고침 필요
- 검색은 클라이언트 사이드 필터링 사용 (현재 구현 유지)

## 향후 개선 사항

1. 교재 목록 무한 스크롤 또는 페이지네이션 추가
2. 교재 검색 서버 사이드 필터링 지원
3. 교재 목록 캐싱 최적화
4. 교재 선택 시 자동 완성 기능 추가

