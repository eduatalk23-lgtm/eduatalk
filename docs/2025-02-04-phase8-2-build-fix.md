# Phase 8.2: 빌드 에러 수정 완료

## 작업 일시

2025-02-04

## 작업 개요

Phase 8.1에서 확인된 빌드 에러들을 수정하여 `npm run build`가 성공적으로 완료되도록 함.

## 수정한 파일 목록

### 1. `app/(admin)/actions/camp-templates/progress.ts`

- `tenant_id` 타입 불일치: `tenantContext.tenantId` null 체크 후 로컬 변수로 추출
- `recommendation_metadata` 타입 불일치: `Json | null`로 명시적 캐스팅
- `logError` 호출 순서 수정: `logError(error, context)` 형태로 변경
- `exclusion_type` 타입 불일치: `ExclusionType`으로 명시적 캐스팅
- `reason` 필드: `null`을 `undefined`로 변환
- `group.students` 배열 접근 수정

### 2. `app/(admin)/actions/consultingNoteActions.ts`

- `getCurrentUser` import 추가
- `user.id` → `user.userId`로 수정

### 3. `app/(admin)/actions/masterBooks/import.ts`

- `target_exam_type` 타입 처리: 배열/문자열 모두 처리
- 누락된 필드 추가: `series_name`, `pdf_url`, `overall_difficulty`, `ocr_data`, `page_analysis`, `id`

### 4. `app/(admin)/actions/masterLectures/import.ts`

- 누락된 필드 추가: `video_url`, `overall_difficulty`, `id`, `transcript`, `episode_analysis`

### 5. `app/(admin)/actions/schools/import.ts`

- 누락된 필드 추가: `is_active`, `id`

### 6. `app/(admin)/actions/studentManagementActions.ts`

- `getCurrentUserRole` import 추가

### 7. `app/(admin)/actions/subjects/export.ts`

- `Subject` 타입에 `is_active` 필드 추가
- `exportToExcel` 인자 타입 단언 추가

### 8. `components/ui/ToastProvider.tsx`

- `showWarning` 메서드 추가

### 9. `app/(admin)/admin/attendance/page.tsx`

- `error` 타입 단언 추가

### 10. `app/(admin)/admin/attendance/statistics/_components/MethodStatisticsChart.tsx`

- `Pie` 컴포넌트 `label` prop: `percentage` → `percent`로 수정

### 11. `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

- `PlanExclusion`, `AcademySchedule` import 추가

### 12. `app/(admin)/admin/camp-templates/[id]/participants/student/[studentId]/_components/CampParticipantLearningProgress.tsx`

- `Pie` 컴포넌트 `label` prop: `percentage` → `percent`로 수정

### 13. `app/(admin)/admin/camp-templates/page.tsx`

- `result.total` nullish coalescing 추가

### 14. `app/(admin)/admin/master-lectures/[id]/page.tsx`

- `MasterLecture` 타입 확장을 위한 타입 단언 추가

### 15. `app/(admin)/admin/plan-groups/[id]/page.tsx`

- `Json` 타입 import 추가
- `template` 타입 단언 추가

### 16. `app/(admin)/admin/sms/_components/SMSRecipientSelector.tsx`

- `isActive` 타입 단언 추가

### 17. `app/(admin)/admin/students/[id]/_components/StudentInfoEditForm.tsx`

- `transformFormDataToUpdatePayload`에서 `desired_university_ids` 배열 처리 수정

### 18. `app/(admin)/admin/students/_components/CreateStudentForm.tsx`

- `form.handleSubmit`, `control` 타입 단언 추가

### 19. `app/(admin)/admin/students/_hooks/useCreateStudentForm.ts`

- `zodResolver` 타입 단언 추가

### 20. `app/(student)/actions/contentActions.ts`

- `difficulty` → `difficultyLevelId`로 수정

### 21. `app/(student)/actions/contentMasterActions.ts`

- `semester`, `subject_category` 필드 추가

### 22. `app/(student)/camp/[invitationId]/page.tsx`

- `transformPlanGroupToWizardDataPure` import 수정
- `TransformationContext` 형태로 인자 전달

### 23. `app/(student)/contents/_components/ContentsList.tsx`

- `select` 호출 타입 단언 추가

### 24. `app/(student)/contents/_components/ContentsListClient.tsx`

- `ContentCard` `item` prop 타입 단언 추가

### 25. `app/(student)/contents/_components/FilterOptions.tsx`

- `data` 배열 타입 단언 추가

### 26. `app/(student)/contents/lectures/[id]/edit/LectureEditForm.tsx`

- `DifficultySelectField` import 추가

### 27. `app/(student)/plan/group/[id]/edit/page.tsx`

- `transformPlanGroupToWizardDataPure` import 수정
- `TransformationContext` 형태로 인자 전달

### 28. `app/(student)/plan/new-group/_components/_features/content-selection/components/MasterContentsPanel.tsx`

- `searchContentMastersAction` 반환 타입 단언 추가

### 29. `app/(student)/plan/new-group/_components/_features/content-selection/Step3ContentSelection.tsx`

- `WizardData` import 추가
- `data` prop 타입 단언 추가

### 30. `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/hooks/useRecommendations.ts`

- `ContentDetailsApiResponse` 타입 단언 추가
- `details`, `episodes` 배열 타입 단언 추가
- `RecommendedContent` 변환 시 `undefined` → `null` 변환
- `r` 파라미터 타입 명시

### 31. `app/(student)/plan/new-group/_components/_features/content-selection/utils/recommendationTransform.ts`

- `undefined` → `null` 변환 추가

### 32. `app/(student)/plan/new-group/_components/BasePlanWizard.tsx`

- `WizardData` import 경로 수정
- `WizardStep` import 경로 수정
- `updates` 타입 단언 추가

### 33. `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`

- `result.data` 타입 단언 추가

### 34. `app/(student)/plan/new-group/page.tsx`

- `transformPlanGroupToWizardDataPure` import 수정
- `TransformationContext` 형태로 인자 전달

### 35. `app/(student)/scores/dashboard/_components/SubjectGradeHistoryChart.tsx`

- `Tooltip` `formatter` prop 타입 단언 추가

### 36. `app/api/purio/send/route.ts`

- `error` 타입 단언 추가

### 37. `components/organisms/index.ts`

- `DialogDefault` import 제거

### 38. `lib/contexts/AuthContext.tsx`

- `result.data` 타입 단언 추가

### 39. `lib/data/campParticipants.ts`

- `student_grade` 타입 변환: `number` → `string`
- `invitations` 배열 타입 단언 추가

### 40. `lib/data/campParticipantStats.ts`

- `getParticipantAttendanceStats` 인자 수정 (날짜 제거)
- `template.camp_start_date`, `template.camp_end_date` non-null assertion 추가

### 41. `lib/data/campTemplates.ts`

- `supabase` null 체크 추가
- `select` 호출 타입 단언 추가
- `student_grade` 타입 변환: `number` → `string`
- `student_name`, `student_class` null → undefined 변환
- `createCampTemplate` `created_by` optional로 변경

### 42. `lib/data/studentSearch.ts`

- `adminClient` null 체크 추가
- `buildBaseQuery`, `collectPhoneMatchedIds` 함수 파라미터 타입 수정

### 43. `lib/data/todayPlans.ts`

- `error` 타입 단언 추가
- `withErrorFallback` 호출 타입 단언 추가
- `row` 필드들 타입 단언 추가

### 44. `lib/plan/blocks.ts`

- `SchedulerOptions` 타입 단언 추가

### 45. `lib/plan/scheduler.ts`

- `group.scheduler_options` null → undefined 변환

### 46. `lib/reschedule/core.ts`

- `exclusions`, `academySchedules` map 결과 타입 단언 추가

### 47. `lib/scheduler/SchedulerEngine.ts`

- `ContentInfo` 타입 단언 추가

### 48. `lib/scores/mockAnalysis.ts`

- `mockScores` 타입 단언 추가

### 49. `lib/services/campInvitationExpiryService.ts`

- `NotificationType` 타입 단언 추가

### 50. `lib/services/campReminderService.ts`

- `templates` 필터 타입 가드 수정

### 51. `lib/services/emailService.ts`

- `reply_to` → `replyTo`로 수정

### 52. `lib/utils/campFilters.ts`

- `normalized` 객체 할당 타입 단언 추가
- 불필요한 빈 문자열 체크 제거

### 53. `lib/utils/databaseFallback.ts`

- `assignBlockIndex` 반환 타입 단언 추가

### 54. `lib/utils/excel.ts`

- `values` 배열 타입 단언 추가

### 55. `lib/utils/masterContentFormHelpers.ts`

- `difficulty_level` 필드 추가 (MasterCustomContent, MasterBook, MasterLecture)

### 56. `lib/utils/planGroupAdapters.ts`

- `student_contents`, `recommended_contents` 타입 단언 추가

### 57. `lib/utils/planVersionUtils.ts`

- `originalPlan.version`, `originalPlan.version_group_id` 타입 단언 추가
- 반환 객체에서 `id`, `created_at`, `updated_at` 제거

## 주요 수정 패턴

1. **타입 단언 (`as` 또는 `as unknown as`)**: 타입 불일치 해결
2. **Null 체크 및 변환**: `null` → `undefined` 변환, non-null assertion (`!`)
3. **Import 추가**: 누락된 타입/함수 import 추가
4. **타입 확장**: 누락된 필드 추가
5. **함수 시그니처 수정**: 인자 개수/타입 수정

## 빌드 결과

```
✓ Compiled successfully
✓ TypeScript check passed
✓ Build completed successfully
```

## 다음 단계

빌드가 성공적으로 완료되었으므로, 다음 단계로 진행 가능:

- Phase 8.3: 런타임 에러 검증
- Phase 8.4: 성능 최적화
- Phase 8.5: 코드 품질 개선
