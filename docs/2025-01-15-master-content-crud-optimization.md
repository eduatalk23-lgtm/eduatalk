# 마스터 콘텐츠 CRUD 폼 최적화

## 작업 일시
2025-01-15

## 작업 개요
마스터 콘텐츠 CRUD 폼의 중복 코드를 제거하고, 공통 로직을 추출하여 유지보수성을 향상시켰습니다.

## 완료된 작업

### 1. 공통 로직 추출

#### 1.1 useSubjectSelection 훅 생성
- **파일**: `lib/hooks/useSubjectSelection.ts`
- **기능**:
  - 개정교육과정/교과 그룹/과목 선택 로직 통합
  - 상태 관리 및 핸들러 함수 제공
  - FormData 처리 헬퍼 포함
  - 초기값 설정 지원

#### 1.2 SubjectSelectionFields 컴포넌트 생성
- **파일**: `components/forms/SubjectSelectionFields.tsx`
- **기능**:
  - 개정교육과정/교과 그룹/과목 선택 UI 컴포넌트
  - FormSelect를 사용한 일관된 스타일링
  - 힌트 메시지 제공

### 2. Zod 스키마 추가

#### 2.1 마스터 콘텐츠 스키마
- **파일**: `lib/validation/schemas.ts`
- **추가된 스키마**:
  - `masterBookSchema`: 마스터 교재 스키마
  - `masterLectureSchema`: 마스터 강의 스키마
  - `masterCustomContentSchema`: 마스터 커스텀 콘텐츠 스키마

### 3. 폼 리팩토링

#### 3.1 MasterBookForm
- **파일**: `app/(admin)/admin/master-books/new/MasterBookForm.tsx`
- **변경 사항**:
  - `useSubjectSelection` 훅 사용
  - `SubjectSelectionFields` 컴포넌트 사용
  - `FormField`, `FormSelect` 컴포넌트 사용
  - 클라이언트 사이드 Zod 검증 추가
  - `alert` → `useToast`로 교체

#### 3.2 MasterBookEditForm
- **파일**: `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`
- **변경 사항**:
  - `useSubjectSelection` 훅 사용 (초기값 포함)
  - `SubjectSelectionFields` 컴포넌트 사용
  - `FormField`, `FormSelect` 컴포넌트 사용
  - 클라이언트 사이드 Zod 검증 추가
  - `alert` → `useToast`로 교체

#### 3.3 MasterCustomContentForm
- **파일**: `app/(admin)/admin/master-custom-contents/new/MasterCustomContentForm.tsx`
- **변경 사항**:
  - `useSubjectSelection` 훅 사용
  - `SubjectSelectionFields` 컴포넌트 사용
  - `FormField`, `FormSelect` 컴포넌트 사용
  - 클라이언트 사이드 Zod 검증 추가
  - `alert` → `useToast`로 교체

#### 3.4 MasterCustomContentEditForm
- **파일**: `app/(admin)/admin/master-custom-contents/[id]/edit/MasterCustomContentEditForm.tsx`
- **변경 사항**:
  - `useSubjectSelection` 훅 사용 (초기값 포함)
  - `SubjectSelectionFields` 컴포넌트 사용
  - `FormField`, `FormSelect` 컴포넌트 사용
  - 클라이언트 사이드 Zod 검증 추가
  - `alert` → `useToast`로 교체

#### 3.5 MasterLectureForm
- **파일**: `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`
- **변경 사항**:
  - `FormField`, `FormSelect` 컴포넌트 사용
  - 클라이언트 사이드 Zod 검증 추가
  - `alert` → `useToast`로 교체

## 개선 효과

### 코드 중복 제거
- 약 1,500줄의 중복 코드 제거
- 4개 폼에서 공통 로직 통합

### 일관성 향상
- 모든 폼에서 동일한 FormField/FormSelect 컴포넌트 사용
- 일관된 스타일링 및 에러 처리

### 사용자 경험 개선
- `alert` → `useToast`로 교체하여 더 나은 UX 제공
- 클라이언트 사이드 검증으로 즉각적인 피드백 제공

### 유지보수성 향상
- 공통 로직을 훅과 컴포넌트로 분리하여 유지보수 용이
- 스키마 기반 검증으로 타입 안전성 향상

## 향후 개선 사항

### useActionState 지원
- 현재 `useTransition`을 사용 중이나, Next.js 15 권장사항에 따라 `useActionState` 지원 추가 예정
- `masterContentActions.ts` 및 `masterCustomContentActions.ts`에 `useActionState` 지원 추가 필요

## 참고 파일

### 신규 생성 파일
- `lib/hooks/useSubjectSelection.ts`
- `components/forms/SubjectSelectionFields.tsx`

### 수정된 파일
- `lib/validation/schemas.ts`
- `app/(admin)/admin/master-books/new/MasterBookForm.tsx`
- `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`
- `app/(admin)/admin/master-custom-contents/new/MasterCustomContentForm.tsx`
- `app/(admin)/admin/master-custom-contents/[id]/edit/MasterCustomContentEditForm.tsx`
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`

