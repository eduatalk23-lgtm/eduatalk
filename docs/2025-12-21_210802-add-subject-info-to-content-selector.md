# ContentSelector와 ContentCard에 교과/과목 정보 표시 추가

## 📋 작업 개요

`ContentSelector`와 `ContentCard` 컴포넌트에서 교과(교과 그룹)와 과목 정보가 표시되지 않던 문제를 해결했습니다. 이제 콘텐츠 선택 화면에서 교과/과목 정보를 확인할 수 있습니다.

## 🎯 목표

1. `ContentSelector`에서 교과/과목 정보 표시
2. `ContentCard`에서 교과/과목 정보 표시 (이미 구현되어 있었으나 데이터가 전달되지 않음)
3. 데이터 조회 시 교과/과목 정보 포함

## 🔧 변경 사항

### 1. 타입 정의 업데이트

#### `lib/data/planContents.ts`
- `ContentItem` 타입에 `subject`, `subject_group_name` 필드 추가

#### `lib/types/content-selection.ts`
- `StudentContentsPanelProps`의 `contents` 타입에 `subject`, `subject_group_name` 필드 추가

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`
- `ContentItem` 타입에 `subject`, `subject_group_name` 필드 추가

### 2. 데이터 조회 로직 개선

#### `lib/data/planContents.ts`

**수정된 함수:**
- `fetchStudentBooks`: `subject_id` 조회 추가, 배치로 `subject_group_name` 조회
- `fetchStudentLectures`: `subject_id` 조회 추가, 배치로 `subject_group_name` 조회
- `fetchStudentCustomContents`: `subject`, `subject_id` 조회 추가, 배치로 `subject_group_name` 조회

**개선 사항:**
- `subject_id`를 통해 교과명을 배치로 조회하여 성능 최적화
- `fetchSubjectGroupNamesBatch` 함수를 사용하여 N+1 쿼리 문제 해결

#### `lib/data/contentMetadata.ts`
- `fetchSubjectGroupNamesBatch` 함수를 export하여 다른 파일에서 사용 가능하도록 수정

### 3. UI 컴포넌트 업데이트

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`
- 교과명을 파란색 배지로 표시 (과목명보다 먼저 표시)
- 교과명 스타일: `bg-blue-100 text-blue-800 font-medium`
- 과목명 스타일: `bg-gray-100 text-gray-700`
- 교과/과목 정보가 있을 때만 표시

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx`
- 이미 교과/과목 정보를 표시하는 코드가 있었음
- 데이터가 전달되면 자동으로 표시됨

## 📊 데이터 흐름

```
1. fetchAllStudentContents()
   ↓
2. fetchStudentBooks/Lectures/CustomContents()
   ↓
3. subject_id 추출 → fetchSubjectGroupNamesBatch()
   ↓
4. ContentItem 반환 (subject, subject_group_name 포함)
   ↓
5. ContentSelector에 전달
   ↓
6. UI에 교과/과목 정보 표시
```

## ✅ 검증 사항

- [x] `ContentSelector`에서 교과/과목 정보가 표시되는가?
- [x] `ContentCard`에서 교과/과목 정보가 표시되는가?
- [x] 데이터 조회 시 성능 문제가 없는가? (배치 조회 사용)
- [x] 타입 정의가 올바른가?

## 📝 수정된 파일

1. `lib/data/planContents.ts` - 데이터 조회 로직
2. `lib/data/contentMetadata.ts` - 함수 export
3. `lib/types/content-selection.ts` - 타입 정의
4. `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx` - UI 컴포넌트

## 🚀 향후 개선 사항

1. **캐싱**: 교과명 조회 결과를 캐싱하여 성능 개선
2. **에러 처리**: 교과명 조회 실패 시 사용자에게 알림
3. **필터링**: 교과/과목별로 콘텐츠 필터링 기능 추가

