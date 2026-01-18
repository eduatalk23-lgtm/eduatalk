# ContentSelector 표시 구조 개선

## 📋 작업 개요

`ContentSelector`에서 중복되고 불명확한 정보 표시를 개선하여, 콘텐츠명, 개정교육과정, 교과, 과목을 명확하게 구분하여 표시하도록 수정했습니다.

## 🎯 목표

1. 콘텐츠명, 개정교육과정, 교과, 과목을 명확하게 구분하여 표시
2. 중복된 subtitle 정보 제거
3. 정보를 배지 형태로 구조화하여 가독성 향상

## 🔧 변경 사항

### 1. 타입 정의 업데이트

#### `lib/data/planContents.ts`
- `ContentItem` 타입에 `curriculum_revision_name` 필드 추가

#### `lib/types/content-selection.ts`
- `StudentContentsPanelProps`의 `contents` 타입에 `curriculum_revision_name` 필드 추가

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`
- `ContentItem` 타입에 `curriculum_revision_name` 필드 추가

### 2. 데이터 조회 로직 개선

#### `lib/data/planContents.ts`

**새로운 함수 추가:**
- `fetchCurriculumRevisionNamesBatch`: 여러 `curriculum_revision_id`를 배치로 조회하여 개정교육과정명 맵 반환

**수정된 함수:**
- `fetchStudentBooks`: `curriculum_revision_id` 조회 추가, 배치로 `curriculum_revision_name` 조회, `subtitle` 제거
- `fetchStudentLectures`: `curriculum_revision_id` 조회 추가, 배치로 `curriculum_revision_name` 조회, `subtitle` 제거
- `fetchStudentCustomContents`: `curriculum_revision_id` 조회 추가, 배치로 `curriculum_revision_name` 조회, `subtitle` 제거

**개선 사항:**
- `curriculum_revision_id`를 통해 개정교육과정명을 배치로 조회하여 성능 최적화
- `subtitle` 필드는 더 이상 사용하지 않음 (null로 설정)

### 3. UI 컴포넌트 업데이트

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`

**표시 구조 개선:**
- 콘텐츠명 (title): 메인 제목으로 표시
- 개정교육과정 (curriculum_revision_name): 보라색 배지 (`bg-purple-100 text-purple-800`)
- 교과 (subject_group_name): 파란색 배지 (`bg-blue-100 text-blue-800`)
- 과목 (subject): 회색 배지 (`bg-gray-100 text-gray-700`)

**제거된 요소:**
- `subtitle` 표시 제거 (중복 정보 제거)

**검색 기능 개선:**
- 검색 필터링에 `curriculum_revision_name`, `subject_group_name`, `subject` 포함
- `subtitle` 검색 제거

## 📊 표시 구조

### Before
```
유형+내신 고쟁이 공통수학 1(2025)
국내도서 > 중/고등참고서 > 고등학교 과목별 > 고등문제집 > 공통수학/대수
국내도서 > 중/고등참고서 > 고등학교 과목별 > 고등문제집 > 공통수학/대수
```

### After
```
유형+내신 고쟁이 공통수학 1(2025)
[2022개정교육과정] [수학] [공통수학]
```

## ✅ 검증 사항

- [x] 콘텐츠명이 명확하게 표시되는가?
- [x] 개정교육과정, 교과, 과목이 배지로 구분되어 표시되는가?
- [x] 중복된 subtitle 정보가 제거되었는가?
- [x] 검색 기능이 개정교육과정, 교과, 과목을 포함하는가?
- [x] 데이터 조회 시 성능 문제가 없는가? (배치 조회 사용)

## 📝 수정된 파일

1. `lib/data/planContents.ts` - 데이터 조회 로직 및 타입 정의
2. `lib/types/content-selection.ts` - 타입 정의
3. `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx` - UI 컴포넌트

## 🎨 배지 색상 체계

- **개정교육과정**: 보라색 (`bg-purple-100 text-purple-800`)
- **교과**: 파란색 (`bg-blue-100 text-blue-800`)
- **과목**: 회색 (`bg-gray-100 text-gray-700`)

## 🚀 향후 개선 사항

1. **캐싱**: 개정교육과정명 조회 결과를 캐싱하여 성능 개선
2. **필터링**: 개정교육과정, 교과, 과목별로 콘텐츠 필터링 기능 추가
3. **정렬**: 개정교육과정, 교과, 과목별로 정렬 기능 추가

