# Step4(콘텐츠 추가) 자동 저장 로직 확인

## 📋 확인 일시

2025-01-30

## ⚠️ 업데이트 (2025-01-30)

**자동 저장 기능 제거됨**: 반복 루프 문제로 인해 Step3ContentSelection의 자동 저장 기능을 제거했습니다.

## 🔍 확인 내용

### 현재 구조

1. **Step4RecommendedContents 컴포넌트**

   - 위치: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
   - 상태: 리팩토링 완료, 하지만 **자동 저장 로직 없음**
   - 사용처: 현재 `PlanGroupWizard`에서 직접 사용되지 않음

2. **Step3ContentSelection 컴포넌트**
   - 위치: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
   - 상태: Step3Contents + Step4RecommendedContents 통합 버전
   - **자동 저장 로직 제거됨** (2025-01-30, 반복 루프 문제로 제거)

### 자동 저장 로직 비교

#### ❌ Step3ContentSelection (자동 저장 제거됨 - 2025-01-30)

```390:412:app/(student)/plan/new-group/_components/Step3ContentSelection.tsx
  // Draft 자동 저장 (데이터 변경 시)
  // onSaveDraft를 useRef로 저장하여 무한 루프 방지
  const onSaveDraftRef = useRef(onSaveDraft);
  useEffect(() => {
    onSaveDraftRef.current = onSaveDraft;
  }, [onSaveDraft]);

  useEffect(() => {
    // onSaveDraft가 없거나 저장 중이면 스킵
    if (!onSaveDraftRef.current || isSavingDraft) {
      return;
    }

    // 데이터가 실제로 변경되었는지 확인
    const timer = setTimeout(() => {
      // 현재 저장 중이 아닐 때만 실행
      if (!isSavingDraft && onSaveDraftRef.current) {
        onSaveDraftRef.current();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [data.student_contents, data.recommended_contents, isSavingDraft]);
```

**동작 방식:**

- `data.student_contents` 또는 `data.recommended_contents` 변경 시
- 2초 후 자동으로 `onSaveDraft()` 호출
- `isSavingDraft` 플래그로 중복 저장 방지
- `useRef`로 무한 루프 방지

#### ❌ Step4RecommendedContents (자동 저장 없음)

현재 `Step4RecommendedContents` 컴포넌트에는 자동 저장 로직이 없습니다.

**데이터 업데이트 흐름:**

1. `onUpdate` 호출 → `updateWizardData` 실행
2. `updateWizardData`는 단순히 `setWizardData`로 상태만 업데이트
3. 자동 저장 트리거 없음

```478:482:app/(student)/plan/new-group/_components/PlanGroupWizard.tsx
  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
    setValidationErrors([]);
    setValidationWarnings([]);
  };
```

### 데이터 업데이트 지점

Step4RecommendedContents에서 `onUpdate`가 호출되는 지점:

1. **useContentSelection 훅**

   - `addSelectedContents()`: 추천 콘텐츠 추가 시
   - `removeContent()`: 콘텐츠 제거 시

2. **useRangeEditor 훅**

   - `saveEditingRange()`: 범위 편집 저장 시

3. **useRecommendations 훅**

   - `autoAssignContents()`: 자동 배정 시

4. **필수 교과 설정**
   - `handleAddRequiredSubject()`: 필수 교과 추가 시
   - `handleRequiredSubjectUpdate()`: 필수 교과 업데이트 시
   - `handleRequiredSubjectRemove()`: 필수 교과 제거 시
   - `handleConstraintHandlingChange()`: 제약 처리 방식 변경 시

## 📊 결론

### 현재 상황

1. **Step3ContentSelection** (실제 사용 중)

   - ❌ 자동 저장 로직 제거됨 (2025-01-30)
   - ⚠️ 반복 루프 문제로 인해 제거
   - ✅ 수동 저장만 지원 (사용자가 직접 저장 버튼 클릭)

2. **Step4RecommendedContents** (리팩토링 완료, 미사용)
   - ❌ 자동 저장 로직 없음
   - ⚠️ 현재 `PlanGroupWizard`에서 직접 사용되지 않음

### 변경 사항

#### 자동 저장 기능 제거 (2025-01-30)

반복 루프 문제로 인해 Step3ContentSelection의 자동 저장 기능을 완전히 제거했습니다.

**제거된 코드:**

- `onSaveDraft`, `isSavingDraft` props
- `onSaveDraftRef` useRef
- 자동 저장 useEffect (2개)
- 저장 중 UI 표시

**영향:**

- 콘텐츠 변경 시 자동 저장되지 않음
- 사용자가 수동으로 저장 버튼을 클릭해야 함
- 반복 루프 문제 해결

### 권장 사항

#### 옵션 1: Step4RecommendedContents에 자동 저장 추가 (향후 사용 대비) - **비권장**

만약 `Step4RecommendedContents`를 독립적으로 사용할 계획이 있다면, Step3ContentSelection과 동일한 자동 저장 로직을 추가해야 합니다.

**필요한 변경사항:**

1. `Step4RecommendedContentsProps`에 `onSaveDraft`, `isSavingDraft` 추가
2. `useEffect`로 `data.recommended_contents` 변경 감지
3. 2초 디바운스 후 자동 저장

#### 옵션 2: 현재 상태 유지 (권장)

현재 `Step3ContentSelection`이 Step4 기능을 포함하고 있고, 자동 저장은 제거되었으므로:

- `Step4RecommendedContents`는 리팩토링된 참고용 컴포넌트로 유지
- 실제 사용은 `Step3ContentSelection`을 통해 진행
- 수동 저장만 지원 (반복 루프 방지)

## 🔧 구현 예시 (옵션 1 선택 시)

```typescript
// Step4RecommendedContents.tsx에 추가할 코드

// Props에 추가
interface Step4RecommendedContentsProps {
  // ... 기존 props
  onSaveDraft?: () => void;
  isSavingDraft?: boolean;
}

// 컴포넌트 내부에 추가
export default function Step4RecommendedContents({
  // ... 기존 props
  onSaveDraft,
  isSavingDraft = false,
}: Step4RecommendedContentsProps) {
  // ... 기존 코드

  // Draft 자동 저장 (데이터 변경 시)
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
  }, [data.recommended_contents, isSavingDraft]);

  // ... 나머지 코드
}
```

## 📝 참고사항

- Step3ContentSelection의 자동 저장은 `data.student_contents`와 `data.recommended_contents` 모두 감지
- Step4RecommendedContents는 `data.recommended_contents`만 업데이트하므로, 해당 필드만 감지하면 됨
- 디바운스 시간(2초)은 Step3ContentSelection과 동일하게 유지 권장
