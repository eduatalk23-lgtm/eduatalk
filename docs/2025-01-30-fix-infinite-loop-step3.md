# 플랜 생성 3단계 무한 반복 에러 수정

## 문제 상황
- 학생 페이지에서 일반 모드로 플랜 생성 중 3단계에서 다음 진행 시 무한 반복 에러 발생
- Step 3 (스케줄 미리보기)에서 Step 4 (콘텐츠 선택)로 이동할 때 문제 발생

## 원인 분석

### 1. `Step3ContentSelection` 컴포넌트의 무한 루프
- `useEffect`에서 `onSaveDraft`를 의존성 배열에 포함하여 무한 루프 발생
- `onSaveDraft` 함수가 변경될 때마다 `useEffect`가 재실행되고, 저장 과정에서 상태 업데이트가 다시 트리거됨

```typescript
// 문제가 있던 코드
useEffect(() => {
  if (onSaveDraft && !isSavingDraft) {
    const timer = setTimeout(() => {
      onSaveDraft();
    }, 2000);
    return () => clearTimeout(timer);
  }
}, [data.student_contents, data.recommended_contents, onSaveDraft, isSavingDraft]);
```

### 2. 잘못된 검증 로직 위치
- `validateStep(3)`에서 콘텐츠 검증을 수행하고 있었으나, Step 3은 스케줄 미리보기 단계로 콘텐츠 검증이 불필요
- 콘텐츠 검증은 Step 4에서 수행해야 함

### 3. Step 4에서 다음 단계 이동 로직 부재
- Step 4에서 `handleSubmit(false)`를 호출하여 데이터만 저장하지만, Step 5로 이동하는 로직이 없음

## 수정 내용

### 1. `Step3ContentSelection.tsx` 수정
- `onSaveDraft`를 `useRef`로 저장하여 무한 루프 방지
- `useEffect` 의존성 배열에서 `onSaveDraft` 제거

```typescript
// 수정된 코드
const onSaveDraftRef = useRef(onSaveDraft);
useEffect(() => {
  onSaveDraftRef.current = onSaveDraft;
}, [onSaveDraft]);

useEffect(() => {
  if (!onSaveDraftRef.current || isSavingDraft) {
    return;
  }

  const timer = setTimeout(() => {
    if (!isSavingDraft && onSaveDraftRef.current) {
      onSaveDraftRef.current();
    }
  }, 2000);

  return () => clearTimeout(timer);
}, [data.student_contents, data.recommended_contents, isSavingDraft]);
```

### 2. `PlanGroupWizard.tsx` 검증 로직 수정
- `validateStep(3)`: 스케줄 미리보기는 확인만 하는 단계이므로 검증 제거
- `validateStep(4)`: 콘텐츠 검증 로직 추가 (최소 1개 이상의 콘텐츠 필요)

```typescript
if (step === 3) {
  // Step 3: 스케줄 미리보기 단계
  // 스케줄 미리보기는 확인만 하는 단계이므로 검증 불필요
}

if (step === 4) {
  // Step 4: 콘텐츠 선택 단계
  // 최소 1개 이상의 콘텐츠 필요
  const totalContents =
    wizardData.student_contents.length +
    wizardData.recommended_contents.length;
  if (totalContents === 0) {
    errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
  }
}
```

### 3. `PlanGroupWizard.tsx` Step 4 이동 로직 추가
- `handleSubmit` 함수에서 Step 4에서 호출될 때 Step 5로 이동하도록 수정

```typescript
// Step 4에서 호출된 경우 데이터만 저장하고 Step 5로 이동 (플랜 생성은 Step 6에서)
if (currentStep === 4 && !generatePlans) {
  setDraftGroupId(finalGroupId);
  setCurrentStep(5);
  toast.showSuccess("저장되었습니다.");
  return;
}
```

## 테스트 방법
1. 학생 페이지에서 일반 모드로 플랜 생성 시작
2. Step 1, Step 2를 완료하고 Step 3으로 이동
3. Step 3에서 "다음" 버튼 클릭 → Step 4로 정상 이동 확인
4. Step 4에서 콘텐츠 선택 후 "다음" 버튼 클릭 → Step 5로 정상 이동 확인
5. 무한 반복 에러가 발생하지 않는지 확인

## 관련 파일
- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

## 날짜
2025-01-30

