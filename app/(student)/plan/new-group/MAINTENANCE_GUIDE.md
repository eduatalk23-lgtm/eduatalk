# Plan Wizard 유지보수 가이드

## 📋 개요

이 문서는 Plan Wizard에 새로운 기능을 추가하거나 기존 기능을 수정할 때 따라야 할 단계별 가이드를 제공합니다. 특히 "새로운 입력 필드를 추가하려면 어떻게 해야 하나요?"와 같은 질문에 대한 답변을 포함합니다.

---

## 🎯 새로운 입력 필드 추가하기

새로운 입력 필드를 Plan Wizard에 추가하는 것은 다음 5단계로 이루어집니다:

### Step 1: Zod 스키마에 필드 추가

**파일**: `lib/schemas/planWizardSchema.ts`

**작업 내용:**
1. `planWizardSchemaObject`에 새 필드 추가
2. 적절한 Zod 검증 규칙 설정
3. 해당 Step의 부분 스키마에도 추가 (필요한 경우)

**예시:**
```typescript
// lib/schemas/planWizardSchema.ts

const planWizardSchemaObject = z.object({
  // 기존 필드들...
  name: z.string().min(1, "플랜 이름을 입력해주세요."),
  
  // 새 필드 추가
  study_goal: z.string().min(1, "학습 목표를 입력해주세요.").optional(),
  target_score: z.number().int().min(0).max(100).optional(),
  
  // ...
});

// Step 1에 포함시키려면 step1Schema에도 추가
export const step1Schema = planWizardSchemaObject.pick({
  name: true,
  study_goal: true,  // 새 필드 추가
  target_score: true, // 새 필드 추가
  // ...
});
```

**주의사항:**
- 필수 필드는 `.optional()`을 제거하고 적절한 검증 규칙 추가
- 선택적 필드는 `.optional()` 추가
- 숫자 필드는 `.int()`, `.min()`, `.max()` 등으로 범위 제한
- 문자열 필드는 `.min()`, `.max()`, `.regex()` 등으로 형식 검증

---

### Step 2: PlanWizardContext 초기값 업데이트

**파일**: `app/(student)/plan/new-group/_components/_context/PlanWizardContext.tsx`

**작업 내용:**
1. `createInitialState` 함수의 `defaultWizardData`에 새 필드 초기값 추가
2. `initialData`에서 새 필드를 읽어올 수 있도록 처리

**예시:**
```typescript
// _context/PlanWizardContext.tsx

function createInitialState(
  initialData?: Partial<WizardData> & { /* ... */ },
  // ...
): WizardState {
  const defaultWizardData: WizardData = {
    name: initialData?.name || "",
    // 기존 필드들...
    
    // 새 필드 초기값 추가
    study_goal: initialData?.study_goal || "",
    target_score: initialData?.target_score || undefined,
    
    // ...
  };
  
  // ...
}
```

**주의사항:**
- 필수 필드는 빈 문자열(`""`) 또는 기본값 설정
- 선택적 필드는 `undefined`로 초기화 가능
- 기존 데이터에서 불러올 때는 `initialData?.fieldName || defaultValue` 패턴 사용

---

### Step 3: 검증 로직 추가

**파일**: `app/(student)/plan/new-group/_components/utils/planValidation.ts`

**작업 내용:**
1. 해당 Step의 검증 함수에 새 필드 검증 로직 추가
2. 필드별 에러 메시지 설정

**예시:**
```typescript
// utils/planValidation.ts

export function validateStep1(
  wizardData: WizardData,
  isTemplateMode: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors = new Map<string, string>();

  // 기존 검증 로직...
  if (!wizardData.name) {
    errors.push("플랜 이름을 입력해주세요.");
    fieldErrors.set("name", "플랜 이름을 입력해주세요.");
  }

  // 새 필드 검증 추가
  if (!wizardData.study_goal) {
    errors.push("학습 목표를 입력해주세요.");
    fieldErrors.set("study_goal", "학습 목표를 입력해주세요.");
  }

  if (wizardData.target_score !== undefined) {
    if (wizardData.target_score < 0 || wizardData.target_score > 100) {
      errors.push("목표 점수는 0-100 사이의 값이어야 합니다.");
      fieldErrors.set("target_score", "목표 점수는 0-100 사이의 값이어야 합니다.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fieldErrors,
  };
}
```

**주의사항:**
- Zod 스키마 검증과 비즈니스 로직 검증을 구분
- 필드별 에러 메시지는 사용자 친화적으로 작성
- 경고(warnings)는 필수는 아니지만 권장하는 사항에 사용

---

### Step 4: Step 컴포넌트 UI 구현

**파일**: 해당 Step 컴포넌트 (예: `_features/basic-info/Step1BasicInfo.tsx`)

**작업 내용:**
1. `usePlanWizard` 훅으로 상태 접근
2. 새 필드에 대한 입력 UI 추가
3. `updateData`로 상태 업데이트
4. `fieldErrors`로 에러 표시

**예시:**
```tsx
// _features/basic-info/Step1BasicInfo.tsx

import { usePlanWizard } from "../../_context/PlanWizardContext";

export function Step1BasicInfo() {
  const { state, updateData, setFieldError, clearFieldError } = usePlanWizard();
  const { wizardData, fieldErrors } = state;

  return (
    <div className="flex flex-col gap-6">
      {/* 기존 필드들... */}
      
      {/* 새 필드 추가 */}
      <div className="flex flex-col gap-2">
        <label htmlFor="study_goal" className="text-sm font-medium text-gray-700">
          학습 목표
        </label>
        <input
          id="study_goal"
          type="text"
          value={wizardData.study_goal || ""}
          onChange={(e) => {
            updateData({ study_goal: e.target.value });
            clearFieldError("study_goal");
          }}
          className={cn(
            "rounded-lg border px-4 py-2",
            fieldErrors.has("study_goal")
              ? "border-red-500"
              : "border-gray-300"
          )}
        />
        {fieldErrors.has("study_goal") && (
          <p className="text-sm text-red-600">
            {fieldErrors.get("study_goal")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="target_score" className="text-sm font-medium text-gray-700">
          목표 점수
        </label>
        <input
          id="target_score"
          type="number"
          min={0}
          max={100}
          value={wizardData.target_score ?? ""}
          onChange={(e) => {
            const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
            updateData({ target_score: value });
            clearFieldError("target_score");
          }}
          className={cn(
            "rounded-lg border px-4 py-2",
            fieldErrors.has("target_score")
              ? "border-red-500"
              : "border-gray-300"
          )}
        />
        {fieldErrors.has("target_score") && (
          <p className="text-sm text-red-600">
            {fieldErrors.get("target_score")}
          </p>
        )}
      </div>
    </div>
  );
}
```

**주의사항:**
- `usePlanWizard` 훅을 사용하여 상태 접근 (Props Drilling 금지)
- `updateData`로 상태 업데이트
- `fieldErrors`로 필드별 에러 표시
- `clearFieldError`로 사용자가 입력할 때 에러 제거

---

### Step 5: 테스트 케이스 추가

**파일**: `__tests__/validation/planValidator.test.ts` 또는 해당 테스트 파일

**작업 내용:**
1. 새 필드에 대한 검증 테스트 추가
2. 성공 케이스와 실패 케이스 모두 작성

**예시:**
```typescript
// __tests__/validation/planValidator.test.ts

import { validateStep1 } from "@/app/(student)/plan/new-group/_components/utils/planValidation";

describe("validateStep1", () => {
  it("should validate study_goal field", () => {
    const wizardData = {
      name: "테스트 플랜",
      study_goal: "", // 빈 값
      // ... 기타 필수 필드
    };

    const result = validateStep1(wizardData, false);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("학습 목표를 입력해주세요.");
    expect(result.fieldErrors.get("study_goal")).toBe("학습 목표를 입력해주세요.");
  });

  it("should validate target_score range", () => {
    const wizardData = {
      name: "테스트 플랜",
      study_goal: "수능 만점",
      target_score: 150, // 범위 초과
      // ... 기타 필수 필드
    };

    const result = validateStep1(wizardData, false);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("목표 점수는 0-100 사이의 값이어야 합니다.");
    expect(result.fieldErrors.get("target_score")).toBe("목표 점수는 0-100 사이의 값이어야 합니다.");
  });

  it("should pass validation with valid data", () => {
    const wizardData = {
      name: "테스트 플랜",
      study_goal: "수능 만점",
      target_score: 90,
      // ... 기타 필수 필드
    };

    const result = validateStep1(wizardData, false);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

**주의사항:**
- 성공 케이스와 실패 케이스 모두 작성
- 경계값 테스트 포함 (최소값, 최대값 등)
- 필드별 에러 메시지 검증

---

## 🔧 기타 유지보수 작업

### 새로운 Step 추가하기

1. `PlanGroupWizard.tsx`의 `WizardStep` 타입에 새 Step 추가
2. `BasePlanWizard.tsx`에 새 Step 컴포넌트 추가
3. `planValidation.ts`에 새 Step 검증 함수 추가
4. `planWizardSchema.ts`에 새 Step 스키마 추가

### 검증 로직 수정하기

1. `planValidation.ts`의 해당 Step 검증 함수 수정
2. `planWizardSchema.ts`의 Zod 스키마 수정 (필요한 경우)
3. 테스트 케이스 업데이트

### 상태 관리 로직 수정하기

1. `PlanWizardContext.tsx`의 `wizardReducer` 수정
2. 새로운 액션 타입 추가 (필요한 경우)
3. 관련 훅 업데이트

---

## ✅ 체크리스트

새로운 필드를 추가할 때 확인할 사항:

- [ ] `planWizardSchema.ts`에 Zod 스키마 추가
- [ ] `PlanWizardContext.tsx`의 초기값 업데이트
- [ ] `planValidation.ts`에 검증 로직 추가
- [ ] Step 컴포넌트에 UI 구현
- [ ] `usePlanWizard` 훅 사용 (Props Drilling 금지)
- [ ] 필드별 에러 표시 구현
- [ ] 테스트 케이스 추가
- [ ] 타입 안전성 확인 (TypeScript 에러 없음)

---

## 🚨 주의사항

### Props Drilling 금지

**❌ 나쁜 예:**
```tsx
function Step1BasicInfo({ wizardData, updateData }: Props) {
  // Props로 전달받음
}
```

**✅ 좋은 예:**
```tsx
function Step1BasicInfo() {
  const { state, updateData } = usePlanWizard();
  const wizardData = state.wizardData;
}
```

### 타입 Import 위치

**권장:**
```typescript
import type { WizardData } from "@/lib/schemas/planWizardSchema";
```

**하위 호환성 (기존 코드):**
```typescript
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
```

### 검증 로직 중복 방지

**❌ 나쁜 예:**
```typescript
// 각 컴포넌트에서 개별적으로 검증
if (!wizardData.name) {
  setErrors(["플랜 이름을 입력해주세요."]);
}
```

**✅ 좋은 예:**
```typescript
// 통합 검증 함수 사용
import { validateStep } from "../utils/planValidation";

const result = validateStep(step, wizardData, isTemplateMode, isCampMode);
if (!result.isValid) {
  setErrors(result.errors);
  result.fieldErrors.forEach((error, field) => {
    setFieldError(field, error);
  });
}
```

---

## 📚 참고 자료

- **리팩토링 가이드**: `README_REFACTOR.md`
- **변경 이력**: `CHANGELOG_REFACTOR.md`
- **Zod 문서**: https://zod.dev/
- **React Context API**: https://react.dev/reference/react/useContext

---

**작성일**: 2025-02-04  
**마지막 업데이트**: 2025-02-04

