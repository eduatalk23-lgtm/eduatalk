# 캠프 모드 Step 3 제출 시 콘텐츠 검증 건너뛰기 수정

## 문제 상황

학생이 캠프 템플릿 작성 중 스케줄 미리보기(Step 2.5)에서 다음 버튼을 클릭한 후, Step 3에서 다음 버튼을 클릭할 때 다음과 같은 에러가 발생했습니다:

```
플랜 대상 콘텐츠를 최소 1개 이상 선택해주세요.
```

## 원인 분석

1. 학생이 캠프 모드에서 Step 2.5 (스케줄 미리보기)에서 다음 버튼을 클릭
2. `handleNext`가 호출되고, `currentStep === 2.5`이므로 Step 3으로 이동
3. Step 3에서 다음 버튼을 클릭하면 `isCampMode && currentStep === 3 && !isAdminContinueMode` 조건이 true가 되어 `handleSubmit()` 호출
4. `handleSubmit`에서 `createPlanGroupAction`을 호출
5. `createPlanGroupAction` 내부에서 `PlanValidator.validateCreation`을 호출하여 콘텐츠 검증을 수행
6. `PlanValidator.validateContents`에서 `contents.length === 0`이면 "플랜 대상 콘텐츠를 최소 1개 이상 선택해주세요." 에러 발생

## 문제점

캠프 모드에서 Step 3에서 바로 제출할 때, 콘텐츠가 없어도 제출할 수 있어야 합니다. 나중에 관리자가 검토 후 콘텐츠를 추가할 수 있기 때문입니다. 하지만 현재는 콘텐츠 검증을 수행하여 에러가 발생합니다.

## 해결 방법

캠프 모드에서 Step 3에서 제출할 때는 콘텐츠 검증을 건너뛰도록 수정했습니다.

### 1. `PlanValidator.validateCreation`에 옵션 추가

**파일**: `lib/validation/planValidator.ts`

**변경 내용**:
- `validateCreation` 메서드에 `options` 파라미터 추가
- `skipContentValidation` 옵션을 통해 콘텐츠 검증을 건너뛸 수 있도록 함

```typescript
static validateCreation(
  data: PlanGroupCreationData,
  options?: {
    skipContentValidation?: boolean; // 캠프 모드에서 Step 3 제출 시 콘텐츠 검증 건너뛰기
  }
): ValidationResult {
  // ...
  // 3. 콘텐츠 검증 (옵션으로 건너뛸 수 있음)
  if (!options?.skipContentValidation) {
    const contentValidation = this.validateContents(data.contents);
    errors.push(...contentValidation.errors);
    warnings.push(...contentValidation.warnings);
  }
  // ...
}
```

### 2. `_createPlanGroup`에 옵션 파라미터 추가

**파일**: `app/(student)/actions/plan-groups/create.ts`

**변경 내용**:
- `_createPlanGroup` 함수에 `options` 파라미터 추가
- `PlanValidator.validateCreation` 호출 시 옵션 전달

```typescript
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    skipContentValidation?: boolean;
  }
): Promise<{ groupId: string }> {
  // ...
  const validation = PlanValidator.validateCreation(data, options);
  // ...
}
```

### 3. `createPlanGroupAction`에 옵션 파라미터 추가

**파일**: `app/(student)/actions/plan-groups/create.ts`

**변경 내용**:
- `createPlanGroupAction`이 옵션을 받을 수 있도록 수정

```typescript
export const createPlanGroupAction = withErrorHandling(
  async (
    data: PlanGroupCreationData,
    options?: {
      skipContentValidation?: boolean;
    }
  ) => {
    return _createPlanGroup(data, options);
  }
);
```

### 4. `submitCampParticipation`에서 옵션 전달

**파일**: `app/(student)/actions/campActions.ts`

**변경 내용**:
- `createPlanGroupAction` 호출 시 `skipContentValidation: true` 옵션 전달

```typescript
const result = await createPlanGroupAction(
  {
    ...creationData,
    plan_type: "camp",
    camp_template_id: invitation.camp_template_id,
    camp_invitation_id: invitationId,
  },
  {
    skipContentValidation: true, // 캠프 모드에서 Step 3 제출 시 콘텐츠 검증 건너뛰기
  }
);
```

### 5. `PlanGroupWizard`에서 옵션 전달

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 내용**:
- 캠프 모드에서 Step 3에서 제출할 때 `skipContentValidation: true` 옵션 전달

```typescript
// 캠프 모드에서 Step 3에서 제출할 때는 콘텐츠 검증 건너뛰기
const skipContentValidation = isCampMode && currentStep === 3 && !isAdminContinueMode;
const result = await createPlanGroupAction(creationData, {
  skipContentValidation,
});
```

## 검증

### 캠프 모드 Step 3 제출 시나리오

1. 학생이 캠프 템플릿 작성 중 Step 2.5 (스케줄 미리보기)에서 다음 버튼 클릭
2. Step 3으로 이동
3. Step 3에서 다음 버튼 클릭
4. 콘텐츠가 없어도 제출 성공 ✅
5. 플랜 그룹이 생성되고, 관리자가 나중에 콘텐츠를 추가할 수 있음

### 일반 모드 제출 시나리오

1. 학생이 일반 플랜 그룹 작성 중 Step 6에서 제출
2. 콘텐츠 검증이 정상적으로 수행됨 ✅
3. 콘텐츠가 없으면 에러 발생 (의도된 동작)

### 관리자 남은 단계 진행 시나리오

1. 관리자가 캠프 플랜 그룹의 남은 단계 진행
2. `isAdminContinueMode`가 true이므로 콘텐츠 검증이 수행됨 ✅
3. 관리자가 콘텐츠를 추가한 후 제출 가능

## 관련 파일

- `lib/validation/planValidator.ts` - 콘텐츠 검증 로직
- `app/(student)/actions/plan-groups/create.ts` - 플랜 그룹 생성 액션
- `app/(student)/actions/campActions.ts` - 캠프 참여 제출 액션
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 플랜 그룹 위저드

## 완료 일자

2025-02-02

