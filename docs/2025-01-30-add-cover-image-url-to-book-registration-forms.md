# 교재 등록 폼 표지 이미지 URL 필드 추가

## 작업 개요

교재 등록 폼(관리자/학생)에 표지 이미지 URL 필드를 추가하고, 관련 액션 함수에 처리 로직을 구현했습니다.

## 작업 내용

### 1. 관리자 교재 등록 폼 수정

**파일**: `app/(admin)/admin/master-books/new/MasterBookForm.tsx`

- 표지 이미지 URL 필드 추가
- 출처 URL 필드 다음에 배치하여 논리적 그룹화
- 수정 폼과 동일한 패턴 적용

```tsx
{/* 표지 이미지 URL */}
<UrlField
  label="표지 이미지 URL"
  name="cover_image_url"
  placeholder="https://example.com/image.jpg"
  hint="교재 표지 이미지의 URL을 입력하세요"
  className="md:col-span-2"
/>
```

### 2. 학생 교재 등록 폼 수정

**파일**: `app/(student)/contents/books/new/page.tsx`

- `UrlField` 컴포넌트 import 추가
- 표지 이미지 URL 필드 추가
- 난이도 필드 다음에 배치

### 3. 학생용 액션 함수 수정

**파일**: `app/(student)/actions/contentActions.ts`

- `addBook` 함수에 `cover_image_url` 처리 추가
- `createBookWithoutRedirect` 함수에 `cover_image_url` 처리 추가
- `updateBook` 함수에 `cover_image_url` 처리 추가

### 4. 데이터 레이어 수정

**파일**: `lib/data/studentContents.ts`

- `Book` 타입에 `cover_image_url` 필드 추가
- `createBook` 함수의 파라미터 타입에 `cover_image_url` 추가
- `createBook` 함수의 payload에 `cover_image_url` 포함
- `updateBook` 함수에 `cover_image_url` 업데이트 로직 추가

## 변경 사항 요약

### 추가된 필드
- 관리자 교재 등록 폼: 표지 이미지 URL 입력 필드
- 학생 교재 등록 폼: 표지 이미지 URL 입력 필드

### 수정된 함수
- `addBook`: `cover_image_url` 파싱 및 전달
- `createBookWithoutRedirect`: `cover_image_url` 파싱 및 전달
- `updateBook`: `cover_image_url` 파싱 및 전달
- `createBook` (data layer): `cover_image_url` 처리
- `updateBook` (data layer): `cover_image_url` 업데이트

### 타입 변경
- `Book` 타입에 `cover_image_url?: string | null` 추가

## 데이터 흐름

```
폼 입력 (cover_image_url) 
  → FormData 
  → 액션 함수 (파싱) 
  → 데이터 레이어 함수 
  → 데이터베이스 (books 테이블)
```

## 일관성 개선

- 등록 폼과 수정 폼 간 필드 구성 일치
- 관리자 폼과 학생 폼 간 동일한 패턴 적용
- URL 필드 처리 로직 통합

## 참고 사항

- `master_books` 테이블의 `cover_image_url` 필드는 이미 `parseMasterBookFormData`에서 처리 중
- 학생용 `books` 테이블에도 `cover_image_url` 필드가 존재하여 동일하게 처리 가능
- 빈 문자열은 `null`로 변환되어 저장됨

## 테스트 항목

- [ ] 관리자 교재 등록 시 이미지 URL 저장 확인
- [ ] 학생 교재 등록 시 이미지 URL 저장 확인
- [ ] 빈 문자열 처리 확인 (null로 변환)
- [ ] 교재 수정 시 이미지 URL 업데이트 확인

