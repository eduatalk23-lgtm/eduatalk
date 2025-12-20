# Plan Wizard 레거시 파일 전수 조사

## 📋 개요

이 문서는 Plan Wizard 리팩토링 후 더 이상 필요하지 않거나 사용되지 않는 레거시 파일, 함수, 타입 정의를 조사한 결과입니다. 실제 삭제 전에 이 문서를 검토하고 컨펌을 받아야 합니다.

**조사 일자**: 2025-02-04  
**조사 범위**: `app/(student)/plan/new-group/` 디렉토리 전체

---

## 🔍 조사 방법

1. `@deprecated` 주석이 있는 코드 검색
2. 사용되지 않는 import 확인
3. 중복된 기능 제공 파일 확인
4. 하위 호환성을 위해 유지 중인 코드 확인

---

## 📝 삭제 제안 목록

### 1. Deprecated 함수 및 타입

#### 1.1 `validationUtils.ts`의 deprecated 함수

**파일**: `app/(student)/plan/new-group/_components/utils/validationUtils.ts`

**위치**: 라인 175-195

**내용:**

```typescript
/**
 * 통합 검증 함수 (하위 호환성 유지)
 *
 * @deprecated 이 함수는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드는 planValidation.ts의 validateStep을 사용하세요.
 */
export type StepValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fieldErrors: Map<string, string>;
};
```

**삭제 제안 이유:**

- `planValidation.ts`의 `validateStep` 함수로 대체됨
- 하위 호환성을 위해 유지 중이지만, 실제 사용처 확인 필요

**삭제 전 확인 사항:**

- [ ] `StepValidationResult` 타입이 다른 파일에서 사용되는지 확인
- [ ] `validationUtils.ts`의 다른 함수들이 여전히 사용되는지 확인

**권장 조치:**

1. 프로젝트 전체에서 `StepValidationResult` 사용처 검색
2. 사용되지 않는다면 삭제
3. 사용된다면 해당 코드를 `planValidation.ts`의 타입으로 마이그레이션 후 삭제

---

#### 1.2 `scheduleUtils.ts`의 deprecated 상수

**파일**: `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts`

**위치**: 라인 20-30

**내용:**

```typescript
/**
 * @deprecated getDayTypeBadgeClasses() 사용 권장
 * 날짜 타입별 색상 클래스 반환 (하위 호환성 유지)
 */
export const dayTypeColors: Record<string, string> = {
  학습일: getDayTypeBadgeClasses("학습일"),
  복습일: getDayTypeBadgeClasses("복습일"),
  지정휴일: getDayTypeBadgeClasses("지정휴일"),
  휴가: getDayTypeBadgeClasses("휴가"),
  개인일정: getDayTypeBadgeClasses("개인일정"),
};
```

**삭제 제안 이유:**

- `getDayTypeBadgeClasses()` 함수로 대체됨
- 하위 호환성을 위해 유지 중

**삭제 전 확인 사항:**

- [ ] `dayTypeColors`가 다른 파일에서 사용되는지 확인
- [ ] `SchedulePreviewPanel.tsx`에서도 deprecated 주석이 있는지 확인

**권장 조치:**

1. 프로젝트 전체에서 `dayTypeColors` 사용처 검색
2. 사용되지 않는다면 삭제
3. 사용된다면 해당 코드를 `getDayTypeBadgeClasses()` 호출로 마이그레이션 후 삭제

---

### 2. 사용되지 않는 훅 파일

#### 2.1 `usePlanValidator.ts`

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanValidator.ts`

**삭제 제안 이유:**

- `useWizardValidation.ts`로 대체된 것으로 보임
- 실제 사용처 확인 필요

**삭제 전 확인 사항:**

- [ ] `usePlanValidator`가 다른 파일에서 import되는지 확인
- [ ] `useWizardValidation`과 기능이 중복되는지 확인

**권장 조치:**

1. 프로젝트 전체에서 `usePlanValidator` 사용처 검색
2. 사용되지 않는다면 삭제
3. 사용된다면 `useWizardValidation`으로 마이그레이션 후 삭제

---

### 3. 중복된 타입 정의

#### 3.1 `PlanGroupWizard.tsx`의 타입 re-export

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**위치**: 라인 32-36

**내용:**

```typescript
// WizardData 타입을 스키마에서 import (타입 정의 통합)
import type {
  WizardData,
  TemplateLockedFields,
} from "@/lib/schemas/planWizardSchema";

// 타입 re-export (하위 호환성 유지)
export type { WizardData, TemplateLockedFields };
```

**유지 권장 이유:**

- 하위 호환성을 위해 의도적으로 유지
- 기존 코드에서 `PlanGroupWizard`에서 import하는 경우가 있을 수 있음
- 점진적 마이그레이션을 위해 필요

**권장 조치:**

- ✅ **유지**: 하위 호환성을 위해 계속 유지
- 향후 모든 코드가 `@/lib/schemas/planWizardSchema`에서 직접 import하도록 마이그레이션 완료 후 삭제 검토

---

## 🔎 추가 조사 필요 항목

### 1. `Step4RecommendedContents` 관련 파일

**파일들:**

- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/`

**조사 필요 사항:**

- `Step3ContentSelection`과 기능이 중복되는지 확인
- 실제로 사용되는지 확인

**권장 조치:**

1. 두 컴포넌트의 기능 비교
2. 실제 사용처 확인
3. 중복된다면 하나로 통합

---

### 2. `Step3Contents.tsx`

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step3Contents.tsx`

**조사 필요 사항:**

- `Step3ContentSelection.tsx`와의 관계 확인
- 실제로 사용되는지 확인

**권장 조치:**

1. 두 파일의 차이점 확인
2. 실제 사용처 확인
3. 사용되지 않는다면 삭제

---

### 3. `ContentMasterSearch.tsx`

**파일**: `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`

**조사 필요 사항:**

- 실제로 사용되는지 확인
- 다른 컴포넌트로 대체되었는지 확인

**권장 조치:**

1. 프로젝트 전체에서 `ContentMasterSearch` 사용처 검색
2. 사용되지 않는다면 삭제

---

## ✅ 삭제 안전성 체크리스트

각 파일/함수를 삭제하기 전에 다음을 확인하세요:

- [ ] 프로젝트 전체에서 해당 파일/함수 import 검색
- [ ] 테스트 파일에서 사용되는지 확인
- [ ] 다른 모듈에서 사용되는지 확인
- [ ] 하위 호환성이 필요한지 확인
- [ ] 삭제 후 빌드 에러가 없는지 확인
- [ ] 삭제 후 테스트가 통과하는지 확인

---

## 🚨 삭제 시 주의사항

1. **하위 호환성**: 기존 코드와의 호환성을 고려하여 점진적으로 삭제
2. **테스트**: 삭제 전후로 테스트 실행하여 회귀 테스트
3. **문서화**: 삭제한 파일/함수에 대한 기록 유지
4. **커밋**: 삭제 작업은 별도의 커밋으로 분리하여 추적 가능하게

---

## 📊 삭제 우선순위

### 높은 우선순위 (즉시 삭제 가능)

1. **사용되지 않는 deprecated 함수**: `dayTypeColors` (사용처 확인 후)
2. **중복된 훅**: `usePlanValidator.ts` (사용처 확인 후)

### 중간 우선순위 (마이그레이션 후 삭제)

1. **Deprecated 타입**: `StepValidationResult` (마이그레이션 후)
2. **중복된 컴포넌트**: `Step4RecommendedContents` 관련 (통합 후)

### 낮은 우선순위 (향후 검토)

1. **타입 re-export**: `PlanGroupWizard.tsx`의 타입 re-export (마이그레이션 완료 후)

---

## 📝 삭제 실행 계획

### Phase 1: 사용처 확인 (1일)

1. 각 파일/함수의 사용처 전수 조사
2. 사용되지 않는 항목 목록 작성
3. 삭제 영향도 분석

### Phase 2: 마이그레이션 (필요 시, 2-3일)

1. 사용 중인 deprecated 코드를 새 코드로 마이그레이션
2. 테스트 작성 및 실행
3. 코드 리뷰

### Phase 3: 삭제 실행 (1일)

1. 사용되지 않는 파일/함수 삭제
2. 관련 import 정리
3. 빌드 및 테스트 실행
4. 문서 업데이트

---

## 📚 참고 자료

- **리팩토링 가이드**: `README_REFACTOR.md`
- **변경 이력**: `CHANGELOG_REFACTOR.md`
- **유지보수 가이드**: `MAINTENANCE_GUIDE.md`

---

**작성일**: 2025-02-04  
**최종 업데이트**: 2025-02-04  
**상태**: 🔍 조사 완료, 삭제 대기 중
