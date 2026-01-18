# 캠프 모드 Step 흐름 수정

## 문제 상황

1. **스케줄 미리보기 페이지가 나누어지면서 컴포넌트 스텝과 사용자 화면의 단계가 다름**
   - Step 2.5는 스케줄 미리보기 (Step3SchedulePreview)
   - Step 3은 스케줄 미리보기 화면 (Step3SchedulePreview)
   - Step 4는 콘텐츠 추가 화면 (Step3ContentSelection)

2. **스케줄 미리보기 화면에서 다음 버튼 클릭시 콘텐츠 추가 화면이 나와야하는데 에러가 나왔던 상황**
   - Step 3 (스케줄 미리보기)에서 다음 버튼을 클릭하면 Step 4 (콘텐츠 추가)로 이동해야 함
   - 하지만 `handleNext`에서 `currentStep === 3`일 때 캠프 모드면 바로 제출하도록 되어 있어서 에러 발생

3. **현재 기준으로는 컨텐츠 추가 화면이 안나오고 제출이 된 상황**
   - Step 3에서 다음 버튼을 클릭하면 바로 제출되어 Step 4 (콘텐츠 추가) 화면이 표시되지 않음

## 원인 분석

### 문제점

1. **Step 단계 매핑 혼란**
   - `WizardStep` 타입은 `1 | 2 | 3 | 4 | 5 | 6 | 7`로 정의되어 있음 (2.5가 없음)
   - `currentStep === 3`일 때 `Step3SchedulePreview`를 렌더링 (스케줄 미리보기)
   - `currentStep === 4`일 때 `Step3ContentSelection`을 렌더링 (콘텐츠 추가)

2. **잘못된 제출 조건**
   - 캠프 모드에서 Step 3 (스케줄 미리보기)에서 다음 버튼을 클릭하면 바로 제출하도록 되어 있음
   - 하지만 실제로는 Step 4 (콘텐츠 추가)로 이동한 후, Step 4에서 제출해야 함

### 오류 발생 흐름

```
Step 2 (시간 설정)
  ↓ 다음 버튼 클릭
Step 3 (스케줄 미리보기) - Step3SchedulePreview
  ↓ 다음 버튼 클릭
❌ 바로 제출 (Step 4로 이동하지 않음)
  ↓
에러 발생: "플랜 대상 콘텐츠를 최소 1개 이상 선택해주세요."
```

## 해결 방법

캠프 모드에서 Step 3 (스케줄 미리보기)에서 다음 버튼을 클릭하면 Step 4 (콘텐츠 추가)로 이동하고, Step 4에서 다음 버튼을 클릭하면 제출하도록 수정했습니다.

### 1. `handleNext` 함수 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 전**:
```typescript
// 캠프 모드일 때 Step 3에서 바로 제출 (Step 4, 5 건너뛰기)
// 단, 관리자 남은 단계 진행 모드일 때는 Step 4-5를 진행해야 하므로 제출하지 않음
if (isCampMode && currentStep === 3 && !isAdminContinueMode) {
  handleSubmit();
  return;
}
```

**변경 후**:
```typescript
// 캠프 모드일 때 Step 4에서 바로 제출 (Step 5 건너뛰기)
// 단, 관리자 남은 단계 진행 모드일 때는 Step 4-5를 진행해야 하므로 제출하지 않음
// Step 3 (스케줄 미리보기)에서는 Step 4 (콘텐츠 추가)로 이동
if (isCampMode && currentStep === 4 && !isAdminContinueMode) {
  handleSubmit();
  return;
}
```

### 2. `skipContentValidation` 조건 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 전**:
```typescript
// 캠프 모드에서 Step 3에서 제출할 때는 콘텐츠 검증 건너뛰기
const skipContentValidation = isCampMode && currentStep === 3 && !isAdminContinueMode;
```

**변경 후**:
```typescript
// 캠프 모드에서 Step 4에서 제출할 때는 콘텐츠 검증 건너뛰기 (콘텐츠가 없어도 제출 가능)
const skipContentValidation = isCampMode && currentStep === 4 && !isAdminContinueMode;
```

### 3. Step 4 처리 로직 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 전**:
```typescript
if (currentStep < 5) {
  if (currentStep === 4) {
    // Step 4에서는 데이터만 저장하고 Step 5로 이동 (플랜 생성은 Step 5에서)
    handleSubmit(false); // 플랜 생성하지 않음
  } else {
    setCurrentStep((prev) => (prev + 1) as WizardStep);
  }
}
```

**변경 후**:
```typescript
if (currentStep < 5) {
  if (currentStep === 4) {
    // 캠프 모드가 아닐 때만 Step 4에서 데이터만 저장하고 Step 5로 이동
    // 캠프 모드일 때는 위에서 이미 handleSubmit()이 호출됨
    if (!isCampMode || isAdminContinueMode) {
      // Step 4에서는 데이터만 저장하고 Step 5로 이동 (플랜 생성은 Step 5에서)
      handleSubmit(false); // 플랜 생성하지 않음
    }
  } else {
    setCurrentStep((prev) => (prev + 1) as WizardStep);
  }
}
```

## 검증

### 캠프 모드 Step 흐름

1. **Step 1 (기본 정보)** → 다음 버튼 클릭
2. **Step 2 (시간 설정)** → 다음 버튼 클릭
3. **Step 3 (스케줄 미리보기)** → 다음 버튼 클릭
4. **Step 4 (콘텐츠 추가)** → 다음 버튼 클릭
5. **제출 완료** ✅

### 일반 모드 Step 흐름

1. **Step 1 (기본 정보)** → 다음 버튼 클릭
2. **Step 2 (시간 설정)** → 다음 버튼 클릭
3. **Step 3 (스케줄 미리보기)** → 다음 버튼 클릭
4. **Step 4 (콘텐츠 추가)** → 다음 버튼 클릭
5. **Step 5 (최종 확인)** → 다음 버튼 클릭
6. **Step 6 (학습 분량 조절)** → 다음 버튼 클릭
7. **Step 7 (결과 표시)** ✅

### 관리자 남은 단계 진행 모드

1. **Step 1-3** → 일반 흐름과 동일
2. **Step 4 (콘텐츠 추가)** → 다음 버튼 클릭
3. **Step 5 (최종 확인)** → 다음 버튼 클릭
4. **Step 6 (학습 분량 조절)** → 다음 버튼 클릭
5. **Step 7 (결과 표시)** ✅

## 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 플랜 그룹 위저드 메인 컴포넌트

## 완료 일자

2025-02-02

