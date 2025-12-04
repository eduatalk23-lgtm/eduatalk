# 캠프 템플릿 저장 로직 점검 및 수정

## 작업 일자
2025-02-03

## 문제 분석

### 1. 학생 제출 내용이 사라지는 문제
- **원인**: `continueCampStepsForAdmin`에서 `wizardData.contents`가 undefined이거나 빈 배열일 때 기존 콘텐츠를 삭제하고 빈 배열로 저장
- **위치**: `app/(admin)/actions/campTemplateActions.ts` 1885-2053줄
- **문제점**: 관리자가 특정 단계에서 저장할 때 `wizardData`에 `student_contents`가 포함되지 않으면 기존 학생 콘텐츠가 삭제됨

### 2. 학원일정 중복 생성 문제
- **원인**: 학원일정 업데이트 시 기존 일정을 모두 삭제한 후 새로 추가하는 과정에서 중복 체크 로직이 제대로 작동하지 않음
- **위치**: 
  - `app/(admin)/actions/campTemplateActions.ts` 2092-2134줄
  - `app/(student)/actions/campActions.ts` 408-428줄
  - `lib/data/planGroups.ts` `createStudentAcademySchedules` 함수

## 수정 내용

### 1. 학생 제출 콘텐츠 보존 로직 개선

**파일**: `app/(admin)/actions/campTemplateActions.ts`

#### 변경 사항
- `continueCampStepsForAdmin` 함수에서 콘텐츠 업데이트 로직 수정:
  - `wizardData.student_contents`와 `wizardData.recommended_contents`를 개별적으로 확인
  - 명시적으로 전달된 경우에만 업데이트하고, 그렇지 않으면 기존 콘텐츠 보존
  - 기존 `plan_contents` 테이블의 데이터를 먼저 조회하여 학생 콘텐츠와 추천 콘텐츠로 분류
  - `wizardData`에 없는 기존 콘텐츠는 보존

#### 구현 세부사항
```typescript
// 기존 콘텐츠 조회 및 분류
const existingStudentContents = existingPlanContents.filter(
  (c) => !c.is_auto_recommended && !c.recommendation_source
);
const existingRecommendedContents = existingPlanContents.filter(
  (c) => c.is_auto_recommended || c.recommendation_source
);

// wizardData에 student_contents가 없으면 기존 학생 콘텐츠 보존
if (!hasStudentContents && existingStudentContents.length > 0) {
  // 기존 학생 콘텐츠 보존
}

// wizardData에 recommended_contents가 없으면 기존 추천 콘텐츠 보존
if (!hasRecommendedContents && existingRecommendedContents.length > 0) {
  // 기존 추천 콘텐츠 보존
}
```

### 2. 학원일정 중복 생성 방지

**파일**: `app/(admin)/actions/campTemplateActions.ts`, `app/(student)/actions/campActions.ts`

#### 변경 사항
- `continueCampStepsForAdmin`에서 학원일정 업데이트 로직 개선:
  - 기존 학원일정을 모두 삭제하지 않고, 중복 체크 후 추가하는 방식으로 변경
  - 기존 학원일정을 조회하여 키(요일:시작시간:종료시간:학원명:과목)로 매핑
  - 새로운 학원일정 중 중복되지 않은 것만 필터링하여 추가

- `submitCampParticipation`에서 학원일정 저장 로직 개선:
  - 삭제 전에 기존 일정을 조회하여 중복 체크
  - 중복되지 않은 새로운 학원일정만 추가
  - `createStudentAcademySchedules` 함수의 중복 체크와 함께 이중 검증

#### 구현 세부사항
```typescript
// 기존 학원일정 조회 및 중복 체크
const existingSchedules = await getStudentAcademySchedules(studentId, tenantId);
const existingKeys = new Set(
  existingSchedules.map((s) => 
    `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`
  )
);

// 중복되지 않은 새로운 학원일정만 필터링
const newSchedules = creationData.academy_schedules.filter((s) => {
  const key = `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`;
  return !existingKeys.has(key);
});
```

### 3. 데이터 병합 검증 로직 추가

**파일**: `app/(admin)/actions/campTemplateActions.ts`

#### 변경 사항
- 콘텐츠 저장 후 검증 로직 추가:
  - 저장된 콘텐츠를 다시 조회하여 학생 콘텐츠와 추천 콘텐츠로 분류
  - 기존 학생 콘텐츠가 보존되었는지 확인
  - 기존 추천 콘텐츠가 보존되었는지 확인
  - 검증 결과를 로그로 출력

#### 구현 세부사항
```typescript
// 저장된 콘텐츠 조회 및 검증
const { data: savedContents } = await supabase
  .from("plan_contents")
  .select("*")
  .eq("plan_group_id", groupId);

// 기존 학생 콘텐츠 보존 검증
if (!hasStudentContents && existingStudentContents.length > 0) {
  const preservedCount = savedStudentContents.filter((saved) =>
    existingStudentContents.some(
      (existing) =>
        existing.content_type === saved.content_type &&
        existing.content_id === saved.content_id
    )
  ).length;
  
  // 검증 결과 로깅
}
```

## 테스트 시나리오

### 1. 학생 콘텐츠 보존 테스트
1. 학생이 캠프 템플릿에 콘텐츠를 제출
2. 관리자가 남은 단계 진행하기에서 Step 4(추천 콘텐츠 선택)만 수정하고 저장
3. 학생이 제출한 콘텐츠가 보존되는지 확인

### 2. 학원일정 중복 생성 방지 테스트
1. 학생이 캠프 템플릿에 학원일정을 제출
2. 관리자가 남은 단계 진행하기에서 학원일정을 수정하고 저장
3. 학원일정이 중복 생성되지 않는지 확인

### 3. 템플릿 학원일정 저장 테스트
1. 템플릿에 학원일정이 설정되어 있음
2. 학생이 캠프 템플릿을 제출
3. 템플릿 학원일정과 학생 추가 학원일정이 모두 정상적으로 저장되는지 확인

## 관련 파일

- `app/(admin)/actions/campTemplateActions.ts` - 관리자 남은 단계 진행 로직
- `app/(student)/actions/campActions.ts` - 학생 캠프 참여 제출 로직
- `lib/data/planGroups.ts` - 학원일정 생성 함수

## 참고사항

- 학원일정은 학생별 전역 관리이므로, 캠프 모드 제출 시 템플릿 일정으로 교체하는 것이 의도된 동작입니다.
- 콘텐츠는 플랜 그룹별 관리이므로, 기존 콘텐츠를 보존하는 것이 중요합니다.
- 검증 로직은 개발 환경에서 문제를 조기에 발견하기 위한 목적입니다.

