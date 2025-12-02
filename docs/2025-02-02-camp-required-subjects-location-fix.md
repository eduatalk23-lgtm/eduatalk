# 캠프 필수 교과 설정 위치 수정

## 작업 개요

캠프 모드에서 필수 교과 설정이 잘못된 위치에 표시되는 문제를 수정했습니다. 필수 교과 설정은 관리자가 캠프 템플릿을 생성할 때만 표시되고, 학생이 템플릿을 작성하는 중에는 표시되지 않도록 변경했습니다.

**작업 일시**: 2025-02-02

---

## 문제점

1. **학생이 캠프 템플릿을 작성하는 중에 필수 교과 설정 UI가 표시됨**
   - 캠프 모드에서 학생이 템플릿을 작성할 때 필수 교과 설정 섹션이 나타나고 있었음
   - 학생은 템플릿에서 설정된 필수 교과를 수정할 수 없어야 함

2. **관리자가 캠프 템플릿을 생성할 때 필수 교과 설정 UI가 없음**
   - 템플릿 모드에서 Step 4가 표시되지 않아 필수 교과 설정을 할 수 없었음
   - 관리자가 템플릿 생성 시 필수 교과를 설정할 수 있어야 함

---

## 해결 방안

### 1. Step3ContentSelection.tsx 수정

**파일**: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`

**변경 사항**:
- 필수 교과 설정 UI 표시 조건을 `isCampMode`에서 `isTemplateMode`로 변경
- `isTemplateMode` prop 추가

**변경 전**:
```typescript
{isCampMode && (
  <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 mb-6 shadow-md">
    {/* 필수 교과 설정 UI */}
  </div>
)}
```

**변경 후**:
```typescript
{isTemplateMode && (
  <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 mb-6 shadow-md">
    {/* 필수 교과 설정 UI */}
  </div>
)}
```

**영향**:
- 템플릿 모드(관리자가 템플릿 생성)일 때만 필수 교과 설정 UI가 표시됨
- 캠프 모드(학생이 템플릿 작성)일 때는 필수 교과 설정 UI가 표시되지 않음

---

### 2. Step4RecommendedContents.tsx 수정

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**변경 사항**:
- `RequiredSubjectsSection`을 캠프 모드가 아닐 때만 표시하도록 조건 추가

**변경 전**:
```typescript
<RequiredSubjectsSection
  data={data}
  // ... props
/>
```

**변경 후**:
```typescript
{!isCampMode && (
  <RequiredSubjectsSection
    data={data}
    // ... props
  />
)}
```

**영향**:
- 일반 모드(캠프 모드 아님)에서만 필수 교과 설정 UI가 표시됨
- 캠프 모드에서는 필수 교과 설정 UI가 표시되지 않음

---

### 3. PlanGroupWizard.tsx 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 사항**:
- Step 4를 템플릿 모드에서도 표시하도록 조건 변경 (`!isTemplateMode` 제거)
- `isTemplateMode` prop을 `Step3ContentSelection`에 전달

**변경 전**:
```typescript
{currentStep === 4 && !isTemplateMode && (
  <Step3ContentSelection
    data={wizardData}
    onUpdate={updateWizardData}
    contents={initialContents}
    isCampMode={isCampMode}
    isEditMode={isEditMode}
    studentId={(initialData as any)?.student_id}
    editable={!isAdminContinueMode}
  />
)}
```

**변경 후**:
```typescript
{currentStep === 4 && (
  <Step3ContentSelection
    data={wizardData}
    onUpdate={updateWizardData}
    contents={initialContents}
    isCampMode={isCampMode}
    isTemplateMode={isTemplateMode}
    isEditMode={isEditMode}
    studentId={(initialData as any)?.student_id}
    editable={!isAdminContinueMode}
  />
)}
```

**영향**:
- 템플릿 모드에서도 Step 4가 표시되어 관리자가 필수 교과 설정을 할 수 있음
- `isTemplateMode` prop이 전달되어 템플릿 모드에서만 필수 교과 설정 UI가 표시됨

---

## 검증 사항

### ✅ 완료된 검증

1. **관리자 캠프 템플릿 생성 시**
   - 템플릿 모드에서 Step 4가 표시됨
   - 필수 교과 설정 UI가 표시됨
   - 필수 교과를 추가/수정/삭제할 수 있음

2. **학생 캠프 템플릿 작성 시**
   - 캠프 모드에서 Step 4가 표시됨
   - 필수 교과 설정 UI가 표시되지 않음
   - 템플릿에서 설정된 필수 교과는 검증에만 사용됨

3. **일반 모드(캠프 모드 아님)**
   - Step4RecommendedContents에서 필수 교과 설정 UI가 표시됨
   - 필수 교과 설정이 정상 작동함

---

## 관련 파일

- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

---

## 참고 사항

- 필수 교과 설정은 템플릿 데이터의 `subject_constraints.required_subjects` 필드에 저장됨
- 학생이 캠프 템플릿을 작성할 때는 템플릿에서 설정된 필수 교과가 자동으로 적용됨
- 필수 교과 검증은 콘텐츠 선택 시 자동으로 수행됨

