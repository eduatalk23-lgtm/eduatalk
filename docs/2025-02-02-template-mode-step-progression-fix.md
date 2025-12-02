# 템플릿 모드 Step 진행 로직 수정

## 작업 개요

템플릿 모드에서 Step 2에서 바로 제출하는 로직을 수정하여 Step 3, 4를 거쳐 Step 4에서 템플릿 저장하도록 변경했습니다. 이를 통해 관리자가 필수 교과 설정을 할 수 있게 되었습니다.

**작업 일시**: 2025-02-02

---

## 문제점

템플릿 모드에서 Step 2에서 다음 버튼을 누르면 바로 제출되어 Step 3, 4로 진행할 수 없었습니다. 필수 교과 설정이 있는 Step 4에 도달할 수 없어 관리자가 템플릿 생성 시 필수 교과를 설정할 수 없었습니다.

---

## 해결 방안

### 1. PlanGroupWizard.tsx - handleNext 함수 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 사항**:
- 템플릿 모드에서 Step 2에서 바로 제출하는 로직을 Step 4에서 제출하도록 변경
- 템플릿 모드에서 Step 2 → Step 3 → Step 4로 진행할 수 있도록 수정

**변경 전** (580줄):
```typescript
// 템플릿 모드일 때 Step 2에서 바로 제출 (Step 3, 4, 5 건너뛰기)
if (isTemplateMode && currentStep === 2) {
  handleSubmit();
  return;
}
```

**변경 후**:
```typescript
// 템플릿 모드일 때 Step 4에서 템플릿 저장
if (isTemplateMode && currentStep === 4) {
  handleSubmit();
  return;
}
```

**추가 변경**:
- Step 4에서 템플릿 모드나 캠프 모드가 아닐 때만 Step 5로 이동하도록 조건 추가

**영향**:
- 템플릿 모드에서 Step 2 → Step 3 → Step 4로 정상 진행됨
- Step 4에서 템플릿 저장 가능
- 필수 교과 설정 UI에 접근 가능

---

### 2. PlanGroupWizard.tsx - 다음 버튼 텍스트 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 사항**:
- 템플릿 모드에서 Step 3의 "템플릿 저장하기" 버튼을 Step 4로 이동

**변경 전** (1342줄):
```typescript
{isPending
  ? "저장 중..."
  : currentStep === 3 && isTemplateMode
  ? "템플릿 저장하기"
  : ...
}
```

**변경 후**:
```typescript
{isPending
  ? "저장 중..."
  : currentStep === 4 && isTemplateMode
  ? "템플릿 저장하기"
  : ...
}
```

**영향**:
- 템플릿 모드에서 Step 4에서 "템플릿 저장하기" 버튼이 표시됨
- 사용자가 템플릿 저장 시점을 명확히 알 수 있음

---

### 3. PlanGroupWizard.tsx - 진행률 계산 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 사항**:
- 템플릿 모드에서 Step 4를 진행률 계산에 포함하도록 변경 (기존에는 Step 4, 5, 6, 7 제외)

**변경 전** (289줄, 297줄):
```typescript
// 템플릿 모드일 때 Step 4, 5, 6, 7 제외 (1, 2, 3만)
if (isTemplateMode && (step === 4 || step === 5 || step === 6 || step === 7)) {
  continue;
}
const currentStepWeight = (isTemplateMode && (currentStep === 4 || currentStep === 5 || currentStep === 6 || currentStep === 7)) ? 0 : stepWeights[currentStep];
```

**변경 후**:
```typescript
// 템플릿 모드일 때 Step 5, 6, 7 제외 (1, 2, 3, 4만)
if (isTemplateMode && (step === 5 || step === 6 || step === 7)) {
  continue;
}
const currentStepWeight = (isTemplateMode && (currentStep === 5 || currentStep === 6 || currentStep === 7)) ? 0 : stepWeights[currentStep];
```

**영향**:
- 템플릿 모드에서 Step 4가 진행률 계산에 포함됨
- 진행률 표시가 더 정확해짐

---

## Step 진행 흐름

### 템플릿 모드 (수정 후)
- Step 1 (기본 정보) → Step 2 (시간 설정) → Step 3 (스케줄 미리보기) → Step 4 (콘텐츠 선택 + 필수 교과 설정) → 템플릿 저장

### 일반 모드
- Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 7

### 캠프 모드
- Step 1 → Step 2 → Step 3 → Step 4 (참여 제출)

---

## 검증 사항

### ✅ 완료된 검증

1. **템플릿 모드 Step 진행**
   - Step 2에서 다음 버튼을 누르면 Step 3으로 진행됨
   - Step 3에서 다음 버튼을 누르면 Step 4로 진행됨
   - Step 4에서 "템플릿 저장하기" 버튼이 표시됨

2. **필수 교과 설정 접근**
   - 템플릿 모드에서 Step 4에 도달할 수 있음
   - Step 4에서 필수 교과 설정 UI가 표시됨
   - 필수 교과를 추가/수정/삭제할 수 있음

3. **템플릿 저장**
   - Step 4에서 "템플릿 저장하기" 버튼 클릭 시 템플릿이 정상 저장됨
   - 필수 교과 설정이 템플릿 데이터에 포함됨

4. **진행률 표시**
   - 템플릿 모드에서 Step 4가 진행률에 포함됨
   - 진행률이 정확하게 표시됨

---

## 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

---

## 참고 사항

- 템플릿 모드에서 Step 4의 검증 로직은 기존과 동일하게 유지됨 (Step 1, 2, 3만 검증)
- 템플릿 모드에서 Step 4는 선택사항이므로 콘텐츠가 없어도 템플릿 저장 가능
- 필수 교과 설정은 템플릿 데이터의 `subject_constraints.required_subjects` 필드에 저장됨

