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

#### 1.1 `validationUtils.ts`의 deprecated 함수 ✅ 삭제됨 (2025-12-25)

~~**파일**: `app/(student)/plan/new-group/_components/utils/validationUtils.ts`~~

**결과:**
- `StepValidationResult` 타입 및 `validateStep` 함수가 어디에서도 사용되지 않음 확인
- `useWizardValidation.ts`에서는 `planValidation.ts`의 `validateStep`을 직접 사용 중
- deprecated 코드 (L175-210) 삭제 완료
- `validationUtils.ts`의 다른 함수들(`validatePeriod`, `validateRequiredFields`, `validateContents`)은 계속 사용 중

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

#### 2.1 `usePlanValidator.ts` ✅ 삭제됨 (2025-12-25)

~~**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanValidator.ts`~~

**결과:**
- `usePlanSubmission.ts`에서만 `validatePeriod` 함수 호출 용도로 사용됨
- `validatePeriod`를 직접 import하도록 `usePlanSubmission.ts` 수정
- 훅 레이어가 불필요하여 삭제됨
- 2025-12-25 삭제 완료

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

### 1. `Step4RecommendedContents` 관련 파일 ✅ 삭제됨 (2025-12-25)

~~**파일들:**~~

~~- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`~~
~~- `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/`~~

**결과:**
- `Step3ContentSelection`에서 이미 통합되어 사용 중
- 어디에서도 import되지 않음 확인
- 관련 파일 6개 삭제됨:
  - `Step4RecommendedContents.tsx`
  - `Step4RecommendedContents/components/RecommendationRequestForm.tsx`
  - `Step4RecommendedContents/components/RecommendedContentsList.tsx`
  - `Step4RecommendedContents/components/AddedContentsList.tsx`
  - `Step4RecommendedContents/components/RequiredSubjectsSection.tsx`
  - `Step4RecommendedContents/components/RecommendedContentCard.tsx`
- 필요한 파일들은 `content-selection/`로 병합:
  - `types.ts` - 기존 types.ts와 병합
  - `constants.ts` - 이동
  - `RequiredSubjectItem.tsx` - components/로 이동

---

### 2. `Step3Contents.tsx` ✅ 삭제됨 (2025-12-25)

~~**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step3Contents.tsx`~~

**결과:**
- `Step3ContentSelection.tsx`가 실제로 사용되는 컴포넌트
- `Step3Contents.tsx`는 어디에서도 import되지 않음 확인
- `index.ts`도 `Step3Contents`만 export하고 있어 함께 삭제
- 2025-12-25 삭제 완료

---

### 3. `ContentMasterSearch.tsx` ✅ 삭제됨 (2025-12-25)

~~**파일**: `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`~~

**결과:**
- import되는 곳이 없음 확인
- `MasterContentsPanel.tsx`로 대체됨
- 2025-12-25 삭제 완료

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

1. ~~**사용되지 않는 deprecated 함수**: `dayTypeColors` (사용처 확인 후)~~ ✅ 삭제됨 (2025-12-25)
2. ~~**중복된 훅**: `usePlanValidator.ts` - 아직 usePlanSubmission.ts, useWizardValidation.ts에서 사용 중~~ ✅ 삭제됨 (2025-12-25)

### 중간 우선순위 (마이그레이션 후 삭제)

1. ~~**Deprecated 타입**: `StepValidationResult` (마이그레이션 후)~~ ✅ 삭제됨 (2025-12-25)
2. ~~**중복된 컴포넌트**: `Step4RecommendedContents` 관련 (통합 후)~~ ✅ 삭제됨 (2025-12-25)

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
**최종 업데이트**: 2025-12-25
**상태**: ✅ 레거시 정리 완료 (dayTypeColors, ContentMasterSearch.tsx, 중복 디렉토리 구조 정리, usePlanValidator.ts, Step4RecommendedContents 관련 파일, StepValidationResult/validateStep deprecated 코드, Step3Contents.tsx)

---

## 📁 디렉토리 구조 정리 (2025-12-25)

### 변경 내용

중복된 `_components/_components/` 폴더 구조를 정리하여 `common/` 폴더로 통합했습니다.

#### 삭제된 파일

- `_components/_components/EditableField.tsx` - 사용되지 않아 삭제

#### 이동된 파일 (`_components/_components/` → `common/`)

- `ContentSelectionProgress.tsx`
- `DateInput.tsx`
- `BlockSetTimeline.tsx`
- `FieldError.tsx`
- `fieldErrorUtils.ts`

#### 업데이트된 import 경로

| 파일 | 이전 경로 | 새 경로 |
|------|----------|---------|
| Step3ContentSelection.tsx | `../../_components/` | `../../common/` |
| Step4RecommendedContents.tsx | `./_components/` | `./common/` |
| ExclusionsPanel.tsx | `../../../_components/` | `../../../common/` |
| PeriodSection.tsx | `../../../_components/` | `../../../common/` |
| Step1BasicInfo.tsx | `../../_components/` | `../../common/` |
| BlockSetSection.tsx | `../../../_components/` | `../../../common/` |
| ExclusionManagement.tsx (blocks) | `@/app/.../\_components/\_components/` | `@/app/.../common/` |
