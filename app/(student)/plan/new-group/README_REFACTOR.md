# Plan Wizard 리팩토링 가이드

## 📋 개요

Plan Wizard 리팩토링은 Props Drilling 문제를 해결하고, 타입 안전성을 강화하며, 코드 재사용성을 높이기 위해 수행되었습니다. 이 문서는 리팩토링된 구조를 이해하고 활용하기 위한 가이드입니다.

---

## 🏗 구조적 변화

### 1. Context API 도입

**이전 구조 (Props Drilling)**
```tsx
// 각 Step 컴포넌트가 props로 wizardData, updateData 등을 받음
<Step1BasicInfo 
  wizardData={wizardData}
  updateData={updateData}
  setErrors={setErrors}
  // ... 많은 props
/>
```

**리팩토링 후 (Context API)**
```tsx
// PlanWizardProvider로 감싸고, usePlanWizard 훅으로 접근
<PlanWizardProvider initialData={initialData}>
  <BasePlanWizard />
</PlanWizardProvider>

// Step 컴포넌트 내부
const { state, updateData, setErrors } = usePlanWizard();
```

**주요 파일:**
- `_context/PlanWizardContext.tsx`: Context Provider 및 Reducer 구현
- `PlanGroupWizard.tsx`: Provider 래퍼 및 초기화 로직

**장점:**
- Props Drilling 제거로 코드 가독성 향상
- 상태 관리 중앙화로 디버깅 용이
- 컴포넌트 간 결합도 감소

---

### 2. 타입 정의 통합

**이전 구조**
```typescript
// PlanGroupWizard.tsx에 직접 타입 정의
export type WizardData = {
  name: string;
  plan_purpose: "내신대비" | "모의고사(수능)" | "";
  // ... 많은 필드
};
```

**리팩토링 후 (Zod 스키마 기반)**
```typescript
// lib/schemas/planWizardSchema.ts
export const planWizardSchema = z.object({
  name: z.string().min(1, "플랜 이름을 입력해주세요."),
  plan_purpose: z.enum(["내신대비", "모의고사(수능)", ""]),
  // ... Zod 스키마로 정의
});

// 타입은 스키마에서 추론
export type WizardData = z.infer<typeof planWizardSchema>;
```

**주요 파일:**
- `lib/schemas/planWizardSchema.ts`: Zod 스키마 및 타입 정의
- `PlanGroupWizard.tsx`: 타입 re-export (하위 호환성 유지)

**장점:**
- 런타임 검증과 타입 안전성 동시 보장
- 스키마 변경 시 타입 자동 동기화
- 검증 로직 중앙화

---

## 📦 데이터 관리

### 1. planValidation.ts (Zod 기반 검증)

**위치:** `_components/utils/planValidation.ts`

**사용법:**
```typescript
import { validateStep } from "../utils/planValidation";

// Step별 검증
const result = validateStep(
  step,           // WizardStep (1-7)
  wizardData,     // WizardData
  isTemplateMode, // boolean
  isCampMode      // boolean
);

// 결과 구조
type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fieldErrors: Map<string, string>;
};
```

**특징:**
- 각 Step별 독립적인 검증 함수 제공 (`validateStep1`, `validateStep2`, ...)
- Zod 스키마와 WizardValidator 통합
- 필드별 에러 메시지 지원

---

### 2. usePlanPayloadBuilder (Payload 생성)

**위치:** `_components/hooks/usePlanPayloadBuilder.ts`

**사용법:**
```typescript
import { usePlanPayloadBuilder } from "./hooks/usePlanPayloadBuilder";

const { payload, isValid, errors, warnings, build } = usePlanPayloadBuilder(
  wizardData,
  {
    validateOnBuild: true,  // 빌드 시 검증 여부
    isCampMode: false,      // 캠프 모드 여부
  }
);

// 검증 후 빌드
if (isValid) {
  const creationData = build(); // PlanGroupCreationData
  // 서버 액션 호출
}
```

**특징:**
- WizardData → PlanGroupCreationData 변환
- 콘텐츠 중복 제거 및 병합
- 스케줄러 옵션 자동 병합 (`mergeTimeSettingsSafely`, `mergeStudyReviewCycle`)

---

## ⚡ 성능 최적화

### useContentDataFetcher (콘텐츠 데이터 페칭)

**위치:** `_components/hooks/useContentDataFetcher.ts`

**사용법:**
```typescript
import { useContentDataFetcher } from "./hooks/useContentDataFetcher";

const {
  contentDetails,    // Map<string, ContentDetailData>
  contentMetadata,   // Map<string, ContentMetadata>
  contentInfos,      // ContentInfo[]
  contentTotals,     // Map<string, number>
  loading,
  error,
  fetchMetadata,     // 수동 메타데이터 조회 함수
} = useContentDataFetcher({
  contentIds: ["book-1", "lecture-1"],
  bookIdSet: new Set(["book-1"]),
  lectureIdSet: new Set(["lecture-1"]),
  includeMetadata: true,
  enabled: true,
});
```

**캐싱 메커니즘:**
- **전역 캐시**: 컴포넌트 언마운트 후에도 유지 (`globalContentMetadataCache`, `globalContentDetailsCache`)
- **배치 API 호출**: 여러 콘텐츠를 한 번에 조회하여 네트워크 요청 최소화
- **중복 요청 방지**: 동일한 `contentId`에 대한 동시 요청을 하나로 병합

**최적화 포인트:**
- `contentIds` 변경 시에만 재요청 (useEffect 의존성 배열)
- AbortController로 취소 가능한 비동기 요청
- 메모이제이션을 통한 불필요한 재계산 방지

---

## 🐛 디버깅

### PlanWizardDebugger

**위치:** `_components/debug/PlanWizardDebugger.tsx`

**활성화 방법:**
```tsx
// PlanGroupWizard.tsx 또는 BasePlanWizard.tsx
{process.env.NODE_ENV === "development" && (
  <PlanWizardDebugger
    isAdminMode={isAdminMode}
    isTemplateMode={isTemplateMode}
    isCampMode={isCampMode}
  />
)}
```

**기능:**
- **Data 탭**: 현재 `wizardData`의 전체 JSON 표시
- **Validation 탭**: 현재 Step의 검증 결과 표시
  - 에러 목록
  - 경고 목록
  - 필드별 에러 메시지

**사용 시나리오:**
- 개발 중 데이터 구조 확인
- 검증 로직 디버깅
- 필드별 에러 메시지 확인

---

### isDirty 체크 로직

**위치:** `_context/PlanWizardContext.tsx`, `utils/wizardDataComparison.ts`

**동작 원리:**
```typescript
// Context 내부
const isDirty = useMemo(() => {
  return hasWizardDataChanged(state.initialWizardData, state.wizardData);
}, [state.initialWizardData, state.wizardData]);

// 저장 후 dirty 상태 리셋
const resetDirtyState = useCallback(() => {
  dispatch({ type: "RESET_DIRTY_STATE" });
}, []);
```

**사용법:**
```typescript
const { isDirty, resetDirtyState } = usePlanWizard();

// 저장 전 확인
if (isDirty) {
  // 저장 필요 알림 표시
}

// 저장 후 리셋
await savePlanGroupDraftAction(payload);
resetDirtyState(); // initialWizardData를 현재 데이터로 업데이트
```

**비교 로직:**
- `wizardDataComparison.ts`의 `hasWizardDataChanged` 함수 사용
- 깊은 비교(deep comparison)로 실제 변경 사항만 감지
- 배열/객체 내부 변경도 감지

---

## 🧪 테스트

### 유닛 테스트 실행

**검증 로직 테스트:**
```bash
# planValidation.ts 테스트
npm test -- planValidation.test.ts

# wizardValidator 테스트
npm test -- wizardValidator.test.ts
```

**테스트 파일 위치:**
- `__tests__/validation/planValidator.test.ts`
- `__tests__/planValidation.test.ts`

**테스트 커버리지:**
- Step별 검증 함수 (`validateStep1` ~ `validateStep7`)
- Zod 스키마 검증
- 비즈니스 로직 검증 (WizardValidator)

---

## 📝 마이그레이션 가이드

### 기존 코드에서 리팩토링된 구조로 전환

#### 1. Props Drilling 제거

**이전:**
```tsx
function Step1BasicInfo({ wizardData, updateData, setErrors }: Props) {
  // ...
}
```

**이후:**
```tsx
function Step1BasicInfo() {
  const { state, updateData, setErrors } = usePlanWizard();
  const wizardData = state.wizardData;
  // ...
}
```

#### 2. 타입 Import 변경

**이전:**
```typescript
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
```

**이후 (권장):**
```typescript
import type { WizardData } from "@/lib/schemas/planWizardSchema";
// 또는
import type { WizardData } from "@/lib/types/wizard";
```

**하위 호환성:**
- `PlanGroupWizard.tsx`에서 타입을 re-export하므로 기존 import도 동작
- 점진적 마이그레이션 가능

#### 3. 검증 로직 통합

**이전:**
```typescript
// 각 컴포넌트에서 개별적으로 검증
if (!wizardData.name) {
  setErrors(["플랜 이름을 입력해주세요."]);
}
```

**이후:**
```typescript
import { validateStep } from "../utils/planValidation";

const result = validateStep(step, wizardData, isTemplateMode, isCampMode);
if (!result.isValid) {
  setErrors(result.errors);
  // 필드별 에러 설정
  result.fieldErrors.forEach((error, field) => {
    setFieldError(field, error);
  });
}
```

---

## 🔍 주요 파일 구조

```
new-group/
├── _components/
│   ├── _context/
│   │   └── PlanWizardContext.tsx      # Context Provider 및 Reducer
│   ├── hooks/
│   │   ├── usePlanPayloadBuilder.ts    # Payload 생성
│   │   ├── useContentDataFetcher.ts   # 콘텐츠 데이터 페칭
│   │   ├── useWizardValidation.ts     # 검증 로직 통합
│   │   └── ...
│   ├── utils/
│   │   ├── planValidation.ts          # Zod 기반 검증
│   │   ├── wizardDataComparison.ts    # 변경 사항 감지
│   │   └── ...
│   ├── debug/
│   │   └── PlanWizardDebugger.tsx     # 디버깅 패널
│   └── PlanGroupWizard.tsx            # 메인 컴포넌트
└── README_REFACTOR.md                  # 이 문서
```

---

## ✅ 체크리스트

리팩토링된 코드를 사용할 때 확인할 사항:

- [ ] `PlanWizardProvider`로 컴포넌트를 감싸고 있는가?
- [ ] `usePlanWizard` 훅을 사용하여 상태에 접근하는가?
- [ ] `validateStep` 함수를 사용하여 검증하는가?
- [ ] `usePlanPayloadBuilder`를 사용하여 Payload를 생성하는가?
- [ ] `useContentDataFetcher`를 사용하여 콘텐츠 데이터를 페칭하는가?
- [ ] 타입은 `@/lib/schemas/planWizardSchema` 또는 `@/lib/types/wizard`에서 import하는가?

---

## 📚 참고 자료

- **Zod 문서**: https://zod.dev/
- **React Context API**: https://react.dev/reference/react/useContext
- **프로젝트 가이드라인**: `.cursor/rules/project_rule.mdc`

---

**마지막 업데이트**: 2025-02-04

