# 강의 등록/수정 시 교재 추가 기능 구현

## 작업 일시
2025-12-16

## 작업 개요
강의 등록 및 수정 페이지에서 교재를 연결할 수 있는 기능을 추가했습니다.

## 구현 내용

### 1. 데이터 레이어 수정
- **파일**: `lib/data/studentContents.ts`
- **변경사항**: `createLecture` 함수에 `linked_book_id` 파라미터 추가
- **상세**: 강의 생성 시 교재 ID를 연결할 수 있도록 타입 및 로직 추가

### 2. BookSelector 공통 컴포넌트 생성
- **파일**: `app/(student)/contents/_components/BookSelector.tsx`
- **기능**:
  - 기존 교재 목록에서 선택
  - 교재 검색 기능
  - 새 교재 등록 및 즉시 선택
  - 선택된 교재 표시 및 해제
- **Props**:
  - `value`: 현재 선택된 교재 ID
  - `onChange`: 교재 선택 변경 콜백
  - `studentBooks`: 학생의 교재 목록
  - `onCreateBook`: 새 교재 생성 후 콜백 (선택사항)
  - `disabled`: 비활성화 여부
  - `className`: 추가 CSS 클래스

### 3. 강의 수정 페이지 수정
- **파일**: 
  - `app/(student)/contents/lectures/[id]/edit/page.tsx`
  - `app/(student)/contents/lectures/[id]/edit/LectureEditForm.tsx`
- **변경사항**:
  - 서버 컴포넌트에서 교재 목록 및 연결된 교재 조회
  - `BookSelector` 컴포넌트 통합
  - 폼 제출 시 `linked_book_id` 포함

### 4. 강의 등록 페이지 수정
- **파일**: `app/(student)/contents/lectures/new/page.tsx`
- **변경사항**:
  - 클라이언트에서 교재 목록 조회 (서버 액션 사용)
  - `BookSelector` 컴포넌트 통합
  - 폼 제출 시 `linked_book_id` 포함

### 5. 서버 액션 추가
- **파일**: `app/(student)/actions/contentMetadataActions.ts`
- **추가 함수**: `getStudentBooksAction`
- **기능**: 학생의 교재 목록을 조회하는 서버 액션

### 6. 액션 함수 수정
- **파일**: `app/(student)/actions/contentActions.ts`
- **변경사항**:
  - `addLecture`: `linked_book_id` 처리 추가
  - `updateLecture`: `linked_book_id` 처리 활성화 (기존 주석 처리 해제)

## 주요 특징

1. **재사용 가능한 컴포넌트**: `BookSelector`는 강의 등록/수정 페이지뿐만 아니라 다른 곳에서도 사용 가능
2. **통합된 UX**: 교재 검색, 등록, 선택을 하나의 컴포넌트에서 처리
3. **타입 안전성**: TypeScript 타입 정의 완료
4. **다크모드 지원**: Tailwind CSS 다크모드 클래스 적용

## 테스트 항목

- [ ] 강의 등록 시 교재 연결 테스트
- [ ] 강의 수정 시 교재 변경 테스트
- [ ] 교재 해제 테스트
- [ ] 새 교재 등록 후 즉시 연결 테스트
- [ ] 교재 검색 기능 테스트

## 관련 파일

### 신규 생성
- `app/(student)/contents/_components/BookSelector.tsx`

### 수정
- `lib/data/studentContents.ts`
- `app/(student)/contents/lectures/new/page.tsx`
- `app/(student)/contents/lectures/[id]/edit/page.tsx`
- `app/(student)/contents/lectures/[id]/edit/LectureEditForm.tsx`
- `app/(student)/actions/contentActions.ts`
- `app/(student)/actions/contentMetadataActions.ts`

## 참고사항

- 기존 강의 상세 페이지의 `LectureLinkedBookSection` 기능은 그대로 유지됩니다.
- `BookSelector` 컴포넌트는 제어 컴포넌트 패턴을 사용하여 부모 컴포넌트에서 상태를 관리합니다.
- 교재 목록이 많을 경우 검색 기능을 통해 빠르게 찾을 수 있습니다.

