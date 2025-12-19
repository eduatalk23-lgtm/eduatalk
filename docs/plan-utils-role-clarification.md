# 플랜 유틸리티 역할 명확화 문서

## 📋 개요

이 문서는 `lib/utils/planUtils.ts`와 다른 plan 관련 유틸리티 파일들의 역할을 명확히 하고, 중복 함수를 확인한 결과입니다.

**작성일**: 2025-02-04  
**작업**: Phase 2.2 - 플랜 유틸리티 역할 명확화

---

## 📁 plan 관련 유틸리티 파일 목록

| 파일명 | 역할 | 주요 함수 수 |
|--------|------|-------------|
| `planUtils.ts` | 더미 콘텐츠 판별 및 완료 판별 | 8개 함수 |
| `planStatusUtils.ts` | 플랜 상태 판별 및 상태 관련 유틸리티 | 11개 함수 |
| `planFormatting.ts` | 플랜 포맷팅 (시간, 날짜, 학습 분량) | 4개 함수 |
| `planVersionUtils.ts` | 플랜 버전 관리 | 3개 타입/함수 |
| `planGroupTransform.ts` | 플랜 그룹 데이터 변환 | 1개 함수 |
| `planGroupAdapters.ts` | 플랜 그룹 어댑터 | 1개 함수 |
| `planGroupDataSync.ts` | 플랜 그룹 데이터 동기화 | 1개 함수 |
| `planGroupLock.ts` | 플랜 그룹 락 관리 | 1개 함수 |
| `planDataMerger.ts` | 플랜 데이터 병합 | - |
| `planContentEnrichment.ts` | 플랜 콘텐츠 보강 | - |

**참고**: `plan.ts` 파일은 존재하지 않습니다.

---

## 📊 주요 파일별 상세 분석

### 1. `lib/utils/planUtils.ts` - 더미 콘텐츠 판별 및 완료 판별

**목적**: 더미 콘텐츠 판별 및 플랜 완료 판별 로직  
**특징**: 
- 더미 콘텐츠 (비학습, 자율학습) 판별
- 플랜 완료 판별 (actual_end_time 또는 progress 기준)
- 완료율 계산

**함수 목록 (8개)**:

| 함수명 | 설명 | 반환 타입 |
|--------|------|----------|
| `isDummyContent(contentId)` | 더미 콘텐츠인지 확인 | `contentId is DummyContentId` |
| `isNonLearningContent(contentId)` | 비학습 항목인지 확인 | `boolean` |
| `isSelfStudyContent(contentId)` | 자율학습 항목인지 확인 | `boolean` |
| `getDummyContentMetadata(contentId)` | 더미 콘텐츠 메타데이터 반환 | `DummyContentMetadata \| null` |
| `isCompletedPlan(plan)` | 플랜이 완료되었는지 확인 | `boolean` |
| `filterLearningPlans(plans)` | 학습 플랜만 필터링 (더미 제외) | `T[]` |
| `countCompletedLearningPlans(plans)` | 완료된 학습 플랜 수 계산 | `number` |
| `calculateCompletionRate(plans)` | 학습 플랜 완료율 계산 | `number` |

**사용 예시**:
```typescript
import { isDummyContent, isCompletedPlan, calculateCompletionRate } from "@/lib/utils/planUtils";

// 더미 콘텐츠 확인
if (isDummyContent(plan.content_id)) {
  // 더미 콘텐츠 처리
}

// 완료 플랜 필터링
const completedPlans = plans.filter(plan => isCompletedPlan(plan));

// 완료율 계산
const rate = calculateCompletionRate(allPlans);
```

---

### 2. `lib/utils/planStatusUtils.ts` - 플랜 상태 판별

**목적**: 재조정 기능에서 플랜 상태를 판단하는 데 사용  
**특징**:
- 플랜 상태 (pending, in_progress, completed, cancelled 등) 판별
- 상태별 작업 가능 여부 판별 (재조정 가능, 롤백 가능 등)
- 상태 레이블 및 색상 클래스 제공

**함수 목록 (11개)**:

| 함수명 | 설명 | 반환 타입 |
|--------|------|----------|
| `isReschedulable(plan)` | 재조정 가능한지 확인 | `boolean` |
| `isCompletedPlan(plan)` | 완료된 플랜인지 확인 | `boolean` |
| `isRollbackable(plan)` | 롤백 가능한지 확인 | `boolean` |
| `isInProgressPlan(plan)` | 진행 중인 플랜인지 확인 | `boolean` |
| `isPendingPlan(plan)` | 대기 중인 플랜인지 확인 | `boolean` |
| `isCanceledPlan(plan)` | 취소된 플랜인지 확인 | `boolean` |
| `inferStatusFromTimes(plan)` | 시간 정보로부터 상태 추론 | `PlanStatus` |
| `getStatusLabel(status)` | 상태 레이블 반환 | `string` |
| `getStatusColorClass(status)` | 상태 색상 클래스 반환 | `string` |

**사용 예시**:
```typescript
import { isReschedulable, inferStatusFromTimes, getStatusLabel } from "@/lib/utils/planStatusUtils";

// 재조정 가능 여부 확인
if (isReschedulable(plan)) {
  // 재조정 UI 표시
}

// 상태 추론
const status = inferStatusFromTimes(plan);
const label = getStatusLabel(status);
```

---

### 3. `lib/utils/planFormatting.ts` - 플랜 포맷팅

**목적**: 플랜 표시에 필요한 시간, 학습 분량, 날짜 포맷팅  
**특징**:
- UI 표시용 포맷팅
- 콘텐츠 타입별 학습 분량 포맷팅

**함수 목록 (4개)**:

| 함수명 | 설명 | 반환 타입 |
|--------|------|----------|
| `formatPlanTime(minutes)` | 소요시간 포맷팅 (분 → "1시간 30분") | `string` |
| `formatPlanLearningAmount(plan)` | 학습 분량 포맷팅 ("10-50p (41쪽)") | `string` |
| `formatPlanDate(date)` | 플랜 날짜 포맷팅 ("2025년 2월 4일 월요일") | `string` |
| `formatPlanDateShort(date)` | 플랜 날짜 짧은 포맷팅 ("2/4 (월)") | `string` |

**사용 예시**:
```typescript
import { formatPlanTime, formatPlanLearningAmount, formatPlanDate } from "@/lib/utils/planFormatting";

// 시간 포맷팅
const timeStr = formatPlanTime(90); // "1시간 30분"

// 학습 분량 포맷팅
const amountStr = formatPlanLearningAmount(plan); // "10-50p (41쪽)"

// 날짜 포맷팅
const dateStr = formatPlanDate("2025-02-04"); // "2025년 2월 4일 월요일"
```

---

## ⚠️ 중복 함수 발견

### `isCompletedPlan` 함수 중복

두 파일에서 `isCompletedPlan` 함수가 중복되어 있습니다:

#### `planUtils.ts`의 `isCompletedPlan`

```typescript
export function isCompletedPlan(plan: PlanCompletionFields): boolean {
  // actual_end_time 또는 progress >= 100 기준
  if (plan.actual_end_time !== null && plan.actual_end_time !== undefined) {
    return true;
  }
  if (plan.progress !== null && plan.progress !== undefined && 
      plan.progress >= PLAN_COMPLETION_CRITERIA.MIN_PROGRESS_FOR_COMPLETION) {
    return true;
  }
  return false;
}
```

**입력 타입**: `PlanCompletionFields` (`actual_end_time`, `progress`만 필요)

**용도**: 일반적인 완료 판별 (완료율 계산 등)

#### `planStatusUtils.ts`의 `isCompletedPlan`

```typescript
export function isCompletedPlan(plan: PlanWithStatus): boolean {
  // status 필드를 직접 확인
  return plan.status === "completed";
}
```

**입력 타입**: `PlanWithStatus` (`status` 필드 필요)

**용도**: 재조정 기능에서 상태 기반 완료 판별

**차이점**:
- `planUtils.ts`: 필드값 기반 완료 판별 (actual_end_time, progress)
- `planStatusUtils.ts`: 상태값 기반 완료 판별 (status === "completed")

---

## ✅ 결론 및 권장사항

### 역할 명확화

각 파일의 역할이 명확히 다릅니다:

1. **`planUtils.ts`**: 더미 콘텐츠 판별 및 필드 기반 완료 판별
2. **`planStatusUtils.ts`**: 상태 기반 플랜 판별 및 재조정 기능용
3. **`planFormatting.ts`**: UI 표시용 포맷팅

### 중복 함수 처리 방안

`isCompletedPlan` 함수가 두 파일에 중복되어 있지만, 역할이 다릅니다:

**옵션 1: 함수명 구분 (권장)**
- `planUtils.ts`: `isCompletedPlan` 유지 (필드 기반)
- `planStatusUtils.ts`: `isCompletedStatus` 또는 기존 함수명 유지 (상태 기반)

**옵션 2: 현재 상태 유지**
- 두 함수는 입력 타입과 판별 기준이 다르므로 현재 상태 유지 가능
- 하지만 함수명이 같아 혼동 가능성이 있음

**권장사항**: 
- 함수명을 구분하는 것이 좋습니다. 하지만 기존 코드에서 이미 사용 중이므로, 우선순위가 낮습니다.
- 현재 상태를 유지하되, 각 함수의 목적과 차이점을 명확히 문서화합니다.

### 권장 사용 가이드

**`planUtils.ts` 사용 예시**:
- 더미 콘텐츠 판별
- 완료율 계산 (필드값 기반)
- 학습 플랜 필터링

**`planStatusUtils.ts` 사용 예시**:
- 재조정 가능 여부 확인
- 플랜 상태 추론
- 상태 기반 완료 판별

**`planFormatting.ts` 사용 예시**:
- 플랜 시간 표시
- 학습 분량 표시
- 플랜 날짜 표시

---

## 📝 참고 자료

- `lib/utils/planUtils.ts` - 더미 콘텐츠 판별 및 완료 판별
- `lib/utils/planStatusUtils.ts` - 플랜 상태 판별
- `lib/utils/planFormatting.ts` - 플랜 포맷팅
- `lib/constants/plan.ts` - 플랜 관련 상수
