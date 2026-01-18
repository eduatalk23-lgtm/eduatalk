# 템플릿 모드 handleSubmit 호출 및 async/await 수정

## 📋 문제 상황

### 에러 1: 템플릿 모드에서 플랜 그룹 생성 시도
```
[usePlanSubmission] Submit failed Error: 템플릿 모드에서는 플랜 그룹을 생성할 수 없습니다.
at usePlanGenerator.useCallback[createOrUpdatePlanGroup] (usePlanGenerator.ts:128:15)
```

### 에러 2: 비동기 함수에서 await 사용 불가
```
./app/(student)/plan/new-group/_components/PlanGroupWizard.tsx:588:9
await isn't allowed in non-async function
```

## 🔍 원인 분석

1. **템플릿 모드에서 handleSubmit 호출**: `PlanGroupWizard.tsx`의 `handleNext`에서 Step 5, 6에서 `handleSubmit()`을 호출할 때 템플릿 모드 체크가 없었음
2. **await 누락**: `handleSubmit()`이 `async` 함수인데 `await` 없이 호출되어 에러 처리 및 순서 보장이 안 됨

## ✅ 수정 사항

### 1. `PlanGroupWizard.tsx` - handleNext 함수 수정

**변경 전**:
```typescript
// Step 5 (학습범위 점검)에서 다음 버튼 클릭 시
if (currentStep === 5) {
  handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : false);
  return;
}

// Step 6 (최종 확인)에서 다음 버튼 클릭 시
if (currentStep === 6) {
  handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : true);
  return;
}
```

**변경 후**:
```typescript
// Step 5 (학습범위 점검)에서 다음 버튼 클릭 시
if (currentStep === 5) {
  // 템플릿 모드가 아닐 때만 handleSubmit 호출
  if (!isTemplateMode) {
    await handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : false);
  }
  return;
}

// Step 6 (최종 확인)에서 다음 버튼 클릭 시
if (currentStep === 6) {
  // 템플릿 모드가 아닐 때만 handleSubmit 호출
  if (!isTemplateMode) {
    await handleSubmit(shouldSaveOnlyWithoutPlanGeneration(mode) ? false : true);
  }
  return;
}
```

**추가 수정**:
- Step 4에서 `handleSubmit()` 호출 시에도 `await` 추가
- Step 4에서 캠프 모드일 때 `handleSubmit()` 호출 시 `await` 추가

## 📊 변경 사항 요약

### 수정된 파일

1. **`app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`**
   - `handleNext` 함수에서 모든 `handleSubmit()` 호출에 `await` 추가
   - Step 5, 6에서 템플릿 모드일 때 `handleSubmit` 호출 방지

### 보호 메커니즘

1. **이중 체크**: 
   - `PlanGroupWizard.tsx`에서 템플릿 모드 체크
   - `usePlanSubmission.ts`의 `handleSubmit` 내부에서도 템플릿 모드 체크 (140-143줄)

2. **에러 방지**:
   - 템플릿 모드에서는 `createOrUpdatePlanGroup`이 호출되지 않도록 보장
   - `usePlanGenerator.ts`의 127-129줄에서 템플릿 모드일 때 에러를 던지지만, 호출 자체를 방지

## 🧪 테스트 시나리오

1. **템플릿 모드 Step 4**: `handleSaveDraft`만 호출되어야 함
2. **템플릿 모드 Step 5, 6**: `handleSubmit`이 호출되지 않아야 함
3. **캠프 모드 Step 4**: `handleSubmit`이 정상적으로 호출되어야 함
4. **일반 모드 Step 4, 5, 6**: `handleSubmit`이 정상적으로 호출되어야 함

## 📝 참고 사항

- `handleNext`는 이미 `async` 함수로 선언되어 있어 `await` 사용 가능
- `usePlanSubmission.ts`의 `handleSubmit` 내부에서도 템플릿 모드 체크가 있어 이중 보호
- 템플릿 모드는 Step 4까지만 진행되므로 Step 5, 6에서의 체크는 방어적 코딩

