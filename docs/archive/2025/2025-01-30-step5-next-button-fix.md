# Step 5(최종 확인) 다음 버튼 동작 수정

**작업 일시**: 2025-01-30  
**문제**: 최종 확인 페이지(Step 5)에서 다음 버튼을 눌렀을 때 반응이 없음

## 문제 분석

### 발견된 문제

`PlanGroupWizard.tsx`의 `handleNext` 함수에서:

```typescript
const handleNext = () => {
  // Step 5에서는 완료 버튼이 Step7ScheduleResult 내부에 있으므로 여기서는 아무것도 하지 않음
  if (currentStep === 5) {
    return; // ❌ 아무것도 하지 않음
  }
  // ...
  if (currentStep < 5) {
    // Step 4까지만 처리
  }
};
```

**문제점**:

- Step 5에서 다음 버튼을 눌러도 `return`으로 아무것도 하지 않음
- 주석에는 "Step7ScheduleResult 내부에 있으므로"라고 되어 있지만, 실제로는:
  - Step 5 = Step6Simplified (최종 확인)
  - Step 6 = Step7ScheduleResult (스케줄 결과)
- Step 5에서 다음 버튼을 누르면 플랜 생성 후 Step 6으로 이동해야 함

## 수정 내용

### 1. handleNext 함수 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

```typescript
// 수정 전
const handleNext = () => {
  if (currentStep === 5) {
    return; // 아무것도 하지 않음
  }
  // ...
};

// 수정 후
const handleNext = () => {
  // ...

  // Step 5 (최종 확인)에서 다음 버튼 클릭 시 플랜 생성 및 Step 6으로 이동
  if (currentStep === 5) {
    handleSubmit(true); // 플랜 생성
    return;
  }
  // ...
};
```

### 2. handleSubmit 함수 수정

플랜 생성 후 Step 이동 로직 수정:

```typescript
// Step 5에서 호출된 경우 플랜 생성 후 Step 6으로 이동
if (currentStep === 5 && generatePlans) {
  // 플랜 생성은 아래에서 처리됨
  // Step 6으로 이동은 플랜 생성 후에 처리
}

// 플랜 생성 후 Step 이동
if (!isTemplateMode && generatePlans) {
  try {
    await generatePlansFromGroupAction(finalGroupId);
    setDraftGroupId(finalGroupId);

    // Step 5에서 호출된 경우 Step 6으로 이동, 그 외에는 Step 7로 이동
    if (currentStep === 5) {
      setCurrentStep(6);
    } else {
      setCurrentStep(7);
    }
    // ...
  }
}
```

### 3. 버튼 텍스트 수정

```typescript
// 수정 전
: currentStep === 6
  ? isEditMode
    ? "수정 및 플랜 생성"
    : "플랜 생성하기"
: "다음"

// 수정 후
: currentStep === 5
  ? isEditMode
    ? "수정 및 플랜 생성"
    : "플랜 생성하기"
: currentStep === 6
  ? isEditMode
    ? "수정 및 플랜 생성"
    : "플랜 생성하기"
: "다음"
```

## 수정된 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
  - `handleNext` 함수에서 Step 5 처리 로직 추가
  - `handleSubmit` 함수에서 Step 5일 때 Step 6으로 이동하도록 수정
  - 버튼 텍스트에 Step 5 조건 추가

## Step별 플로우 정리

### 일반 모드 (isCampMode = false, isTemplateMode = false)

| Step | 컴포넌트              | 다음 버튼 동작               | 버튼 텍스트     |
| ---- | --------------------- | ---------------------------- | --------------- |
| 1    | Step1BasicInfo        | Step 2로 이동                | "다음"          |
| 2    | Step2TimeSettings     | Step 3로 이동                | "다음"          |
| 3    | Step3SchedulePreview  | Step 4로 이동                | "다음"          |
| 4    | Step3ContentSelection | 데이터 저장 후 Step 5로 이동 | "다음"          |
| 5    | Step6Simplified       | 플랜 생성 후 Step 6으로 이동 | "플랜 생성하기" |
| 6    | Step7ScheduleResult   | -                            | -               |

### 캠프 모드 (isCampMode = true)

| Step | 컴포넌트              | 다음 버튼 동작               | 버튼 텍스트     |
| ---- | --------------------- | ---------------------------- | --------------- |
| 1    | Step1BasicInfo        | Step 2로 이동                | "다음"          |
| 2    | Step2TimeSettings     | Step 3로 이동                | "다음"          |
| 3    | Step3SchedulePreview  | 캠프 참여 제출               | "참여 제출하기" |
| 4    | Step3ContentSelection | 데이터 저장 후 Step 5로 이동 | "다음"          |
| 5    | Step6Simplified       | 플랜 생성 후 Step 6으로 이동 | "플랜 생성하기" |
| 6    | Step7ScheduleResult   | -                            | -               |

## 예상 효과

- ✅ Step 5에서 다음 버튼 클릭 시 플랜 생성 후 Step 6으로 이동
- ✅ 버튼 텍스트가 "플랜 생성하기"로 표시되어 명확함
- ✅ 사용자가 최종 확인 후 플랜을 생성할 수 있음

## 테스트 시나리오

1. **최종 확인 페이지 접근**

   - Step 5 (최종 확인)로 이동
   - 버튼 텍스트가 "플랜 생성하기"로 표시되는지 확인

2. **플랜 생성하기 버튼 클릭**

   - 버튼 클릭 시 플랜 생성 진행
   - 플랜 생성 완료 후 Step 6 (스케줄 결과)로 이동 확인
   - 성공 메시지 표시 확인

3. **에러 처리 확인**
   - 플랜 생성 실패 시 적절한 에러 메시지 표시 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
