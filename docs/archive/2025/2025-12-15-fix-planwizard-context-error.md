# PlanWizard Context 에러 수정

## 문제 상황

`PlanGroupDetailView`에서 Step 컴포넌트들을 사용할 때 `usePlanWizard must be used within PlanWizardProvider` 에러가 발생했습니다.

### 에러 메시지
```
usePlanWizard must be used within PlanWizardProvider
  at usePlanWizard (PlanWizardContext.tsx:377:11)
  at Step1BasicInfo (Step1BasicInfo.tsx:99:20)
  at renderTabContent (PlanGroupDetailView.tsx:268:15)
```

### 원인
- `Step1BasicInfo`, `Step2TimeSettings`, `Step3ContentSelection`, `Step6Simplified` 컴포넌트들이 `usePlanWizard()` 훅을 무조건 호출하고 있었습니다.
- 하지만 `PlanGroupDetailView`에서는 `PlanWizardProvider`로 감싸지 않고 props로 데이터를 전달하고 있었습니다.
- `usePlanWizard`는 Context가 없으면 에러를 던지도록 설계되어 있었습니다.

## 해결 방법

### 1. `PlanWizardContext` export 추가
`PlanWizardContext`를 직접 사용할 수 있도록 export했습니다.

```typescript
// PlanWizardContext.tsx
export const PlanWizardContext = createContext<PlanWizardContextType | null>(null);
```

### 2. Step 컴포넌트들 수정
모든 Step 컴포넌트에서 `usePlanWizard()` 대신 `useContext(PlanWizardContext)`를 사용하도록 변경했습니다.

**수정된 컴포넌트:**
- `Step1BasicInfo`
- `Step2TimeSettings`
- `Step3ContentSelection`
- `Step6Simplified`

### 변경 전
```typescript
const {
  state: { wizardData: contextData, fieldErrors: contextFieldErrors },
  updateData: contextUpdateData,
} = usePlanWizard(); // ❌ Context가 없으면 에러 발생
```

### 변경 후
```typescript
// Context가 없으면 props만 사용
const context = useContext(PlanWizardContext);
const contextData = context?.state?.wizardData;
const contextFieldErrors = context?.state?.fieldErrors;
const contextUpdateData = context?.updateData;

// Props가 있으면 우선 사용, 없으면 Context에서 가져오기
const data = dataProp ?? contextData;
const onUpdate = onUpdateProp ?? contextUpdateData ?? (() => {}); // fallback to no-op
const fieldErrors = fieldErrorsProp ?? contextFieldErrors;
```

## 수정된 파일

1. `app/(student)/plan/new-group/_components/_context/PlanWizardContext.tsx`
   - `PlanWizardContext` export 추가

2. `app/(student)/plan/new-group/_components/_features/basic-info/Step1BasicInfo.tsx`
   - `usePlanWizard()` → `useContext(PlanWizardContext)` 변경
   - Optional chaining으로 안전하게 접근

3. `app/(student)/plan/new-group/_components/_features/scheduling/Step2TimeSettings.tsx`
   - `usePlanWizard()` → `useContext(PlanWizardContext)` 변경
   - Optional chaining으로 안전하게 접근

4. `app/(student)/plan/new-group/_components/_features/content-selection/Step3ContentSelection.tsx`
   - `usePlanWizard()` → `useContext(PlanWizardContext)` 변경
   - Optional chaining으로 안전하게 접근

5. `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
   - `usePlanWizard()` → `useContext(PlanWizardContext)` 변경
   - Optional chaining으로 안전하게 접근

## 동작 방식

이제 Step 컴포넌트들은 두 가지 방식으로 사용할 수 있습니다:

1. **PlanWizardProvider 내부에서 사용** (기존 방식)
   - Context에서 데이터를 가져옵니다.
   - Wizard 플로우에서 사용됩니다.

2. **Props로 직접 전달** (새로운 방식)
   - `PlanGroupDetailView`처럼 Provider 없이 사용할 수 있습니다.
   - Props가 우선적으로 사용되고, Context는 fallback으로 사용됩니다.

## 테스트

- [x] `PlanGroupDetailView`에서 Step 컴포넌트들이 정상적으로 렌더링되는지 확인
- [x] 기존 Wizard 플로우에서도 정상 작동하는지 확인
- [x] Linter 에러 없음 확인

## 참고

- `usePlanWizard` 훅은 여전히 존재하며, Wizard 내부에서 사용할 때는 계속 사용할 수 있습니다.
- 하지만 Step 컴포넌트들은 이제 Provider 없이도 동작할 수 있도록 개선되었습니다.

