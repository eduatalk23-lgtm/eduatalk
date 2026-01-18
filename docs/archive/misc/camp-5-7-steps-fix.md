# 캠프 모드 5-7단계 문제 수정

## 작업 일시
2024년 11월

## 문제 분석

### 문제 1: 학생이 추가한 교재 정보를 정확히 불러오지 못함
- `syncCreationDataToWizardData`에서 `plan_contents` 테이블의 데이터만 사용하여 콘텐츠 정보를 변환
- 학생 교재의 제목, 과목 등 메타데이터를 조회하지 않음
- `continueCampStepsForAdmin`에서 콘텐츠 업데이트 시 학생 교재 정보를 제대로 매핑하지 못함

### 문제 2: 남은 단계 작업 진행 시 이미 추천 콘텐츠가 등록되어 있음
- `submitCampParticipation`에서 자동 추천 콘텐츠가 `plan_contents`에 저장됨
- `syncCreationDataToWizardData`에서 `is_auto_recommended` 또는 `recommendation_source` 필드로 추천 콘텐츠로 분류
- 남은 단계 진행 시 이 추천 콘텐츠가 그대로 표시됨

### 문제 3: 플랜 생성 실패
- `generatePlansFromGroup`에서 플랜이 생성되지 않아 에러 발생
- 기간, 제외일, 블록 설정이 올바르지 않거나 콘텐츠가 없을 수 있음
- 관리자 모드에서 1~4단계를 읽기 전용으로 설정했지만, 플랜 생성에 필요한 데이터가 누락될 수 있음

## 수정 내용

### 1. 학생 교재 정보 조회 개선

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

- `classifyPlanContents` 함수를 사용하여 콘텐츠 정보를 조회
- 학생 교재의 실제 정보(제목, 과목 등)를 조회하여 표시
- 콘텐츠 정보를 Map으로 변환하여 빠른 조회

```typescript
// 콘텐츠 정보 조회 및 학생/추천 구분 (제목, 과목 등 메타데이터 포함)
const { studentContents: classifiedStudentContents, recommendedContents: classifiedRecommendedContents } = 
  await classifyPlanContents(contents, studentId);

// 콘텐츠 정보를 Map으로 변환하여 빠른 조회
const contentsMap = new Map(
  [...classifiedStudentContents, ...classifiedRecommendedContents].map((c) => [c.content_id, c])
);
```

### 2. 추천 콘텐츠 중복 방지

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

- 남은 단계 진행 시 기존 추천 콘텐츠를 필터링하여 제거
- Step 4에서 새로운 추천 콘텐츠를 선택할 수 있도록 함

```typescript
contents: contents
  .filter((c) => {
    // 추천 콘텐츠 필터링: is_auto_recommended가 true이거나 recommendation_source가 있는 경우 제거
    // 남은 단계 진행 시에는 Step 4에서 새로운 추천 콘텐츠를 선택할 수 있도록 함
    return !(c.is_auto_recommended || c.recommendation_source);
  })
```

### 3. 플랜 생성 실패 해결

**파일**: `app/(admin)/actions/campTemplateActions.ts`

- `continueCampStepsForAdmin`에서 플랜 생성 전 필수 데이터 검증 강화
- 기간, 제외일, 블록 설정이 올바른지 확인
- 콘텐츠가 있는지 확인
- 템플릿 블록 세트가 있는지 확인 (캠프 모드)
- 플랜 생성 실패 시 더 구체적인 에러 메시지 제공

```typescript
// 플랜 생성 전 필수 데이터 검증
const validationErrors: string[] = [];

// 1. 기간 검증
// 2. 콘텐츠 검증
// 3. 템플릿 블록 세트 검증 (캠프 모드)

// 검증 실패 시 에러 발생
if (validationErrors.length > 0) {
  throw new AppError(
    `플랜 생성 전 검증 실패:\n${validationErrors.join("\n")}`,
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}
```

## 수정된 파일 목록

1. `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`
   - 콘텐츠 정보 조회 로직 개선 (`classifyPlanContents` 사용)
   - 추천 콘텐츠 필터링 추가

2. `app/(admin)/actions/campTemplateActions.ts`
   - 플랜 생성 전 검증 로직 추가
   - 기간, 콘텐츠, 템플릿 블록 세트 검증

## 테스트 시나리오

### 시나리오 1: 학생 교재 정보 표시
1. 학생이 교재를 추가한 캠프 플랜 그룹 생성
2. 관리자가 남은 단계 진행 페이지 접근
3. Step 3에서 학생이 추가한 교재의 제목과 과목이 정확히 표시되는지 확인

### 시나리오 2: 추천 콘텐츠 중복 방지
1. 학생이 캠프 참여 정보를 제출하여 자동 추천 콘텐츠가 등록됨
2. 관리자가 남은 단계 진행 페이지 접근
3. Step 4에서 기존 추천 콘텐츠가 표시되지 않고, 새로운 추천 콘텐츠를 선택할 수 있는지 확인

### 시나리오 3: 플랜 생성 검증
1. 관리자가 남은 단계 진행 페이지에서 Step 6 또는 Step 7로 이동
2. 필수 데이터(기간, 콘텐츠, 블록 설정)가 없으면 구체적인 에러 메시지가 표시되는지 확인
3. 모든 필수 데이터가 있으면 플랜이 정상적으로 생성되는지 확인

## 참고 사항

- `classifyPlanContents` 함수는 학생 교재와 마스터 콘텐츠를 구분하여 조회
- 추천 콘텐츠는 `is_auto_recommended` 또는 `recommendation_source` 필드로 식별
- 캠프 모드에서는 템플릿 블록 세트를 사용하므로 반드시 확인 필요

