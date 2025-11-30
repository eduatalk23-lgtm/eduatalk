# master_lectures 필드 추가 및 강의 상세보기 업데이트

## 작업 개요

Supabase의 `master_lectures` 테이블에 추가된 필드들을 코드에 반영하고, 강의 상세보기 페이지에 다음 항목들을 추가했습니다:

- `instructor_name` (강사) - 테이블의 `instructor` 필드
- `grade_level` (강의 대상 학년) - `grade_min`, `grade_max` 조합
- `lecture_type` (강의 유형) - `content_category` 필드
- `lecture_source_url` (출처 url) - 테이블의 `source_url` 필드

## 작업 내용

### 1. 타입 정의 업데이트

**파일**: `lib/types/plan.ts`

`MasterLecture` 타입에 다음 필드를 추가했습니다:

```typescript
// 강의 메타 정보
instructor: string | null; // 강사명
grade_min: number | null; // 최소 학년 (1-3)
grade_max: number | null; // 최대 학년 (1-3)
source_url: string | null; // 출처 URL
```

### 2. 데이터 페칭 함수 확인

**파일**: `lib/data/contentMasters.ts`

`getMasterLectureById` 함수는 이미 `select("*")`를 사용하고 있어서 모든 필드를 자동으로 가져오므로 추가 작업이 필요하지 않았습니다.

### 3. 유틸리티 함수 추가

**파일**: `lib/utils/formatGradeLevel.ts` (신규 생성)

학년 범위를 포맷팅하는 유틸리티 함수를 생성했습니다:

```typescript
export function formatGradeLevel(
  gradeMin: number | null,
  gradeMax: number | null
): string | null
```

- 두 값이 모두 없으면 `null` 반환
- 두 값이 같으면 "1학년" 형식으로 반환
- 두 값이 다르면 "1-2학년" 형식으로 반환
- 하나만 있으면 해당 학년만 반환

### 4. 강의 상세보기 페이지 업데이트

**파일**: `app/(student)/contents/master-lectures/[id]/page.tsx`

`ContentDetailTable`의 `rows` 배열에 다음 항목들을 추가했습니다:

- **강사**: `lecture.instructor`
- **강의 대상 학년**: `formatGradeLevel(lecture.grade_min, lecture.grade_max)`
- **강의 유형**: `lecture.content_category`
- **출처 URL**: `lecture.source_url` (링크로 표시, `isUrl: true` 설정)

## 변경된 파일 목록

1. `lib/types/plan.ts` - `MasterLecture` 타입에 필드 추가
2. `lib/utils/formatGradeLevel.ts` - 신규 생성, 학년 포맷팅 유틸리티
3. `app/(student)/contents/master-lectures/[id]/page.tsx` - 상세보기 페이지에 새 필드 표시 추가

## 참고사항

- `content_category`는 이미 `CommonContentFields`에 포함되어 있어 추가 작업이 필요하지 않았습니다.
- URL 필드는 `ContentDetailTable` 컴포넌트의 자동 URL 감지 기능과 `isUrl: true` 속성을 사용하여 클릭 가능한 링크로 표시됩니다.
- 학년 표시는 `grade_min`과 `grade_max`가 모두 있을 때 범위로, 하나만 있을 때는 단일 학년으로 표시됩니다.
- 빈 값(null, undefined, 빈 문자열)은 `ContentDetailTable` 컴포넌트에서 자동으로 숨겨집니다.

## 테스트 확인 사항

- 강의 상세보기 페이지에서 새로 추가된 필드들이 올바르게 표시되는지 확인
- URL 필드가 클릭 가능한 링크로 표시되는지 확인
- 학년 범위가 올바르게 포맷팅되어 표시되는지 확인
- 빈 값이 있는 필드는 표시되지 않는지 확인

