# 캠프 템플릿 생성 기본 정보 입력 개선

## 작업 일시
2025-02-02

## 목표
템플릿 생성 페이지(`/admin/camp-templates/new`)에서 모든 기본 정보를 한 번에 입력받고, 수정 페이지에서는 이미 입력된 정보가 자동으로 채워져 중복 입력을 방지하도록 개선했습니다.

## 변경 사항

### 1. NewCampTemplateForm 컴포넌트 확장

**파일**: `app/(admin)/admin/camp-templates/new/NewCampTemplateForm.tsx`

#### 추가된 상태
- `description`: 템플릿 설명
- `campStartDate`: 캠프 시작일
- `campEndDate`: 캠프 종료일
- `campLocation`: 캠프 장소

#### UI 개선
- **2단 그리드 레이아웃**: `md:grid-cols-2` 적용
- **섹션 제목 추가**: "템플릿 기본 정보" 헤더 추가
- **필드 순서**:
  1. 템플릿 이름 (전체 너비)
  2. 프로그램 유형
  3. 설명 (전체 너비, textarea)
  4. 캠프 시작일
  5. 캠프 종료일 (시작일 이후만 선택 가능)
  6. 캠프 장소 (전체 너비)

#### 검증 로직
- 클라이언트 사이드에서 종료일이 시작일보다 이후인지 검증
- 필수 필드(템플릿 이름, 프로그램 유형) 검증

#### FormData 구성
- 필수 필드: `name`, `program_type`
- 선택 필드: `description`, `camp_start_date`, `camp_end_date`, `camp_location`
- 빈 값은 FormData에 추가하지 않음

### 2. createCampTemplateDraftAction 확장

**파일**: `app/(admin)/actions/campTemplateActions.ts`

#### 추가된 기능

1. **추가 필드 추출**
   - `description`: 템플릿 설명
   - `camp_start_date`: 캠프 시작일
   - `camp_end_date`: 캠프 종료일
   - `camp_location`: 캠프 장소

2. **검증 로직**
   - 날짜 형식 검증: YYYY-MM-DD 형식 확인 (정규식 사용)
   - 종료일 검증: 시작일보다 이후인지 확인
   - 캠프 장소 길이 검증: 200자 이하

3. **템플릿 생성 시 추가 필드 전달**
   - `createCampTemplate` 함수 호출 시 추가 필드들도 함께 전달
   - 빈 값은 `null`로 전달

## 주요 개선 사항

### 사용자 경험 개선
- 생성 페이지에서 한 번에 모든 기본 정보 입력 가능
- 수정 페이지에서는 이미 입력된 정보가 자동으로 채워짐
- 중복 입력 불필요

### UI 일관성
- 생성 페이지와 수정 페이지의 레이아웃 구조 동일화
- 필드 레이블, placeholder, 스타일 일관성 유지

### 검증 강화
- 클라이언트 사이드와 서버 사이드 이중 검증
- 날짜 형식 및 논리적 검증 (종료일 > 시작일)
- 입력 값 길이 제한 검증

## 변경된 파일

1. `app/(admin)/admin/camp-templates/new/NewCampTemplateForm.tsx`
   - 상태 추가 (description, campStartDate, campEndDate, campLocation)
   - UI 레이아웃 변경 (2단 그리드)
   - FormData 구성 로직 추가

2. `app/(admin)/actions/campTemplateActions.ts`
   - `createCampTemplateDraftAction` 함수 확장
   - 추가 필드 추출 및 검증 로직
   - `createCampTemplate` 호출 시 추가 필드 전달

## 영향받지 않는 파일

- `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`
  - 이미 템플릿 데이터를 로드하여 자동으로 채워짐
  - 변경 불필요

- `app/(admin)/admin/camp-templates/new/page.tsx`
  - 변경 불필요

## 테스트 확인 사항

1. 생성 페이지에서 모든 기본 정보 입력 가능
2. 선택 필드는 비워도 생성 가능
3. 날짜 검증이 올바르게 동작 (종료일 < 시작일 시 에러)
4. 생성된 템플릿의 수정 페이지에서 입력한 정보가 자동으로 채워짐
5. 생성 페이지와 수정 페이지의 UI 레이아웃이 일치함

## 참고

- 기존에 생성된 템플릿은 영향을 받지 않음
- 선택 필드는 null 값으로 저장됨
- 날짜 형식은 HTML date input의 기본 형식 (YYYY-MM-DD) 사용

