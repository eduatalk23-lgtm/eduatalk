# 캠프 학생 콘텐츠 상세 정보 ID 저장 기능

## 개요

학생이 캠프 템플릿 작성 시 추가한 콘텐츠의 상세 정보(페이지/회차 단위) ID를 저장하여, 관리자 페이지에서 범위 조절 시 상세 정보를 선택한 상태로 복원할 수 있도록 개선했습니다.

## 변경 사항

### 1. 데이터베이스 스키마 변경

**마이그레이션**: `supabase/migrations/20250101000000_add_detail_ids_to_plan_contents.sql`

- `plan_contents` 테이블에 `start_detail_id`, `end_detail_id` 필드 추가
- `book_details.id` 또는 `lecture_episodes.id` 참조
- nullable 필드 (상세 정보가 없는 콘텐츠는 null)

### 2. 타입 정의 업데이트

**파일**: `lib/types/plan.ts`

- `PlanContent` 타입에 `start_detail_id`, `end_detail_id` 필드 추가
- `PlanContentInput` 타입에 `start_detail_id`, `end_detail_id` 필드 추가

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

- `WizardData` 타입의 `student_contents`, `recommended_contents`에 `start_detail_id`, `end_detail_id` 필드 추가

### 3. 학생 페이지 (Step3Contents)

**파일**: `app/(student)/plan/new-group/_components/Step3Contents.tsx`

- 콘텐츠 추가 시 `startDetailId`, `endDetailId` 값을 함께 저장
- 상세 정보가 있는 콘텐츠만 detail_id 저장

### 4. 최종 확인 페이지 (Step6FinalReview)

**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`

- 범위 수정 시 저장된 `start_detail_id`, `end_detail_id`를 사용하여 상세 정보 선택 상태 복원
- 저장된 detail_id가 없으면 현재 범위로 찾기 (하위 호환성)
- 범위 저장 시 detail_id도 함께 저장

### 5. 데이터 변환 함수 업데이트

**파일**: `lib/data/planGroups.ts`

- `createPlanContents`: detail_id 저장 로직 추가
- `getPlanContents`: detail_id 조회 로직 추가

**파일**: `lib/utils/planGroupDataSync.ts`

- `syncWizardDataToCreationData`: detail_id 포함
- `syncCreationDataToWizardData`: detail_id 포함

**파일**: `lib/utils/planGroupTransform.ts`

- `transformPlanGroupToWizardData`: detail_id 포함

## 사용 흐름

### 학생 페이지

1. Step 3에서 학생 추가 콘텐츠 선택
2. 상세 정보(페이지/회차)에서 시작/끝 범위 선택
3. `start_detail_id`, `end_detail_id`와 함께 저장

### 관리자 페이지

1. Step 6에서 범위 수정 버튼 클릭
2. 저장된 `start_detail_id`, `end_detail_id`로 상세 정보 선택 상태 복원
3. 범위 수정 후 저장 시 detail_id도 함께 저장

## 하위 호환성

- 기존 데이터는 `start_detail_id`, `end_detail_id`가 null
- null인 경우 현재 범위(`start_range`, `end_range`)로 상세 정보를 찾아서 선택 (하위 호환성)
- 상세 정보가 없는 콘텐츠는 detail_id가 null (정상)

## 참고 사항

- `book_details` 테이블: 교재 상세 정보 (페이지 단위)
- `lecture_episodes` 테이블: 강의 상세 정보 (회차 단위)
- 상세 정보가 없는 콘텐츠는 detail_id가 null로 저장됨

