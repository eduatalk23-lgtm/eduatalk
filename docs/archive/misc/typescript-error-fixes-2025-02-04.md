# TypeScript 오류 수정 작업 (2025-02-04)

## 작업 개요
터미널에 표시된 101개의 TypeScript 컴파일 오류 중 실제 프로젝트 오류 49개를 수정했습니다. (serena 폴더의 Vue 관련 오류 52개는 제외)

## 완료된 작업

### 1. 타입 Export 추가 ✅
- `lib/types/plan/index.ts`에 `MasterBookWithJoins`, `MasterLectureWithJoins`, `PlanContentWithDetails` 추가

### 2. PlanStatus 타입 통합 ✅
- `lib/types/plan/domain.ts`에 통합 타입 정의 추가: `"draft" | "saved" | "active" | "paused" | "pending" | "in_progress" | "completed" | "cancelled"`
- `lib/utils/planStatusUtils.ts`에서 통합 타입 import하여 사용
- `lib/plan/statusManager.ts`에 `pending`, `in_progress` 상태 추가
- 관련 파일들에서 null 체크 및 타입 매핑 추가

### 3. 변수 누락 수정 ✅
- `useContentDetailsBatch.ts`: `abortControllerRef` 추가 및 cleanup 함수 추가
- `Step7ScheduleResult.tsx`: `error` 변수 타입 수정

### 4. 타입 불일치 수정 ✅
- `subtitleColorClass`: `DayView.tsx`에서 사용하지 않는 속성 제거
- `publisher`: `master-books/page.tsx`에서 `publisher_name` 사용하도록 수정
- `SelectedContent`: `useRecommendedContents.ts`에서 `"custom"` 타입 허용하도록 수정
- `scheduler_options`: null을 undefined로 변환
- `status`: null 체크 및 기본값 설정
- `plans` 배열: `plan_date`를 `string | null`로 수정
- `time_settings`: null을 undefined로 변환
- `contentMasters.ts`: `getMasterBookById` 반환 타입에 null 허용
- `planGroups.ts`: `PlanContentWithDetails` 타입 단언 수정
- `studentPlans.ts`: Supabase 쿼리 결과 타입 수정
- `scoreQueries.ts`, `scoreDetails.ts`: JOIN 결과 타입 변환 추가
- `schools.ts`: `UniversityWithCampus` 타입 단언 수정
- `internalAnalysis.ts`: JOIN 결과 타입 변환 추가
- `calendarPageHelpers.ts`: `PlanWithContent` 타입 변환 수정

### 5. PostgrestFilterBuilder 제네릭 타입 수정 ✅
- `contentFilters.ts`: 제네릭 타입 인자 7개로 수정 및 제약 조건 추가
- `contentSort.ts`: 제네릭 타입 인자 7개로 수정
- `contentMasters.ts`: `ContentSortOption` import 추가 및 타입 변환

## 남은 작업

일부 타입 오류가 남아있을 수 있습니다. 주요 작업은 완료되었으며, 남은 오류들은 대부분 타입 단언이나 제네릭 타입 관련 문제입니다.

## 수정된 파일 목록

1. `lib/types/plan/index.ts`
2. `lib/types/plan/domain.ts`
3. `lib/utils/planStatusUtils.ts`
4. `lib/plan/statusManager.ts`
5. `app/(student)/actions/plan-groups/reschedule.ts`
6. `app/(student)/plan/new-group/_components/_features/content-selection/hooks/useContentDetailsBatch.ts`
7. `app/(student)/plan/new-group/_components/_features/scheduling/Step7ScheduleResult.tsx`
8. `app/(student)/plan/calendar/_components/DayView.tsx`
9. `app/(student)/contents/master-books/page.tsx`
10. `app/(student)/plan/new-group/_components/_features/content-selection/hooks/useRecommendedContents.ts`
11. `app/(student)/actions/plan-groups/previewPlansRefactored.ts`
12. `app/(student)/actions/plan-groups/plans.ts`
13. `lib/data/contentMasters.ts`
14. `lib/utils/planGroupAdapters.ts`
15. `lib/data/planGroups.ts`
16. `lib/data/studentPlans.ts`
17. `lib/data/scoreQueries.ts`
18. `lib/data/scoreDetails.ts`
19. `lib/data/schools.ts`
20. `lib/scores/internalAnalysis.ts`
21. `lib/utils/calendarPageHelpers.ts`
22. `lib/utils/contentFilters.ts`
23. `lib/utils/contentSort.ts`
24. `lib/hooks/usePlans.ts`

## 참고사항

- PlanStatus 타입 통합으로 인해 기존 코드와의 호환성을 유지하기 위해 타입 매핑 함수를 사용했습니다.
- Supabase JOIN 결과는 배열로 반환될 수 있으므로, 타입 변환 시 배열의 첫 번째 요소를 사용하도록 수정했습니다.
- PostgrestFilterBuilder의 제네릭 타입 인자가 7개로 변경되어 모든 인자를 명시적으로 제공해야 합니다.

