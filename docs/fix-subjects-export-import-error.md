# Subjects Export Import 에러 수정

## 작업 일시
2025-01-XX

## 문제 상황
빌드 에러 발생:
```
Export getCurriculumRevisions doesn't exist in target module
```

`app/(admin)/actions/subjects/export.ts` 파일에서 `getCurriculumRevisions`를 `@/lib/data/subjects`에서 import하려고 했지만, 해당 함수는 `@/lib/data/contentMetadata`에 정의되어 있었습니다.

## 해결 방법

### 1. Import 경로 수정
- `getCurriculumRevisions`를 `@/lib/data/contentMetadata`에서 import하도록 변경
- 나머지 함수들(`getSubjectGroups`, `getSubjectsByGroup`, `getSubjectTypes`)은 `@/lib/data/subjects`에서 import 유지

### 2. display_order 필드 제거
- `display_order` 필드는 마이그레이션(`20250127120000_remove_display_order_from_education_tables.sql`)에서 이미 제거됨
- Excel export 시트에서 `display_order` 컬럼 제거
- 템플릿 파일에서도 `display_order` 컬럼 제거

## 수정된 파일
- `app/(admin)/actions/subjects/export.ts`

## 변경 사항

### Before
```typescript
import {
  getCurriculumRevisions,
  getSubjectGroups,
  getSubjectsByGroup,
  getSubjectTypes,
} from "@/lib/data/subjects";
```

### After
```typescript
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import {
  getSubjectGroups,
  getSubjectsByGroup,
  getSubjectTypes,
} from "@/lib/data/subjects";
```

## 참고 사항
- `getCurriculumRevisions`는 `lib/data/contentMetadata.ts`에 정의되어 있음
- `display_order` 필드는 교육과정 관련 테이블에서 모두 제거됨
  - `curriculum_revisions`
  - `subject_groups`
  - `subjects`
  - `subject_types`

## 커밋
- 커밋 해시: `52539e2`
- 커밋 메시지: "fix: subjects export에서 getCurriculumRevisions import 경로 수정 및 display_order 제거"






