# 학생 콘텐츠 페이지 필터 통합 작업

## 작업 일자
2025-02-04

## 작업 목표
학생 콘텐츠 페이지(`/contents`)의 필터를 마스터 콘텐츠와 동일한 형식(계층형 ID 기반)으로 변경하고, `UnifiedContentFilter` 컴포넌트를 적용하여 모든 페이지에서 필터 구성을 통일

## 주요 변경사항

### 1. 필터 타입 변경 (텍스트 기반 → ID 기반)

#### 변경 전
- 텍스트 기반 필터: `revision`, `subject_category`, `subject`, `semester`
- URL 파라미터: `?revision=2022&subject_category=수학&subject=수학Ⅰ&semester=1학기`

#### 변경 후
- ID 기반 필터: `curriculum_revision_id`, `subject_group_id`, `subject_id`
- URL 파라미터: `?curriculum_revision_id=xxx&subject_group_id=yyy&subject_id=zzz`

### 2. 학년/학기 필터 제거

- 모든 페이지에서 학년/학기 필터 미사용
- `ContentsList.tsx`에서 학년/학기 관련 코드 제거
- 필터링 로직에서 `semester` 필터 제거
- UI 표시에서 "학년/학기" 행 제거

### 3. UnifiedContentFilter 적용

학생 콘텐츠 페이지에 `UnifiedContentFilter` 컴포넌트 적용:

- 계층형 필터: 개정교육과정 → 교과 → 과목
- 콘텐츠 타입별 필터: 출판사(교재), 플랫폼(강의)
- 검색, 난이도, 정렬 필터
- 필터 옵션은 마스터 콘텐츠와 동일한 메타데이터 사용

### 4. 필터링 로직 업데이트

#### `ContentsList.tsx`
- ID 기반 필터링으로 변경
- `curriculum_revision_id`, `subject_group_id`, `subject_id` 필드 사용
- `publisher_id`, `platform_id` 필드 사용
- 학년/학기 필터 제거

### 5. Pagination 컴포넌트 업데이트

- 필터 타입을 ID 기반으로 변경
- URL 파라미터를 ID 기반으로 업데이트

### 6. UnifiedContentFilter 개선

- `tab` 파라미터 보존 기능 추가
- basePath에 쿼리 파라미터가 포함된 경우 처리

## 수정된 파일

### 컴포넌트
- `app/(student)/contents/page.tsx`
  - `FilterOptions` → `UnifiedContentFilter` 교체
  - 필터 타입 ID 기반으로 변경
  - 필터 옵션 조회 로직 추가

- `app/(student)/contents/_components/ContentsList.tsx`
  - ID 기반 필터링 로직으로 변경
  - 학년/학기 필터 제거
  - UI 표시에서 학년/학기 행 제거

- `app/(student)/contents/_components/Pagination.tsx`
  - 필터 타입을 ID 기반으로 변경
  - URL 파라미터를 ID 기반으로 업데이트

- `components/filters/UnifiedContentFilter.tsx`
  - `tab` 파라미터 보존 기능 추가

## 데이터베이스 구조 확인

학생 콘텐츠 테이블(`books`, `lectures`)에 다음 ID 필드가 이미 존재함을 확인:

- `curriculum_revision_id` (FK → `curriculum_revisions`)
- `subject_group_id` (FK → `subject_groups`)
- `subject_id` (FK → `subjects`)
- `publisher_id` (FK → `publishers`, books 테이블만)
- `platform_id` (FK → `platforms`, lectures 테이블만)

마이그레이션 파일: `supabase/migrations/20251130230715_add_student_content_fields.sql`

## 통일된 필터 구성

모든 페이지에서 동일한 필터 구성:

1. **검색** (제목)
2. **개정교육과정** (ID 기반, 계층형)
3. **교과** (ID 기반, 계층형)
4. **과목** (ID 기반, 계층형)
5. **출판사** (교재만, ID 기반)
6. **플랫폼** (강의만, ID 기반)
7. **난이도**
8. **정렬**

## 제거된 필터

- **학년/학기**: 모든 페이지에서 제거됨

## 향후 개선 사항

1. 학생 콘텐츠에서 실제로 사용되는 난이도만 필터 옵션으로 표시
2. 학생 콘텐츠에서 실제로 사용되는 출판사/플랫폼만 필터 옵션으로 표시

## 참고

- 학생 콘텐츠 필터 옵션은 현재 마스터 콘텐츠와 동일한 메타데이터를 사용
- 필터링은 학생 콘텐츠에만 적용됨

