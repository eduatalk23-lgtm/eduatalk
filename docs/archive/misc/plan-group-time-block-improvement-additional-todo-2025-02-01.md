# 플랜 그룹 시간 블록 기능 추가 개선 TODO

**작성 일자**: 2025-02-01  
**관련 문서**: 
- `plan-group-time-block-analysis-2025-02-01.md`
- `plan-group-time-block-improvement-todo.md`
- `plan-group-time-block-improvement-phase1-completion-2025-02-01.md`
- `plan-group-time-block-improvement-phase2-completion-2025-02-01.md`
- `plan-group-time-block-improvement-phase3-completion-2025-02-01.md`
- `plan-group-time-block-improvement-additional-review-2025-02-01.md`

---

## 📋 개요

Phase 1-3 작업 완료 후 전체 코드 점검을 통해 발견된 추가 개선 사항을 TODO 형태로 정리했습니다.

---

## 🔴 High 우선순위 (즉시 개선 권장)

### 1. `lib/utils/planGroupDataSync.ts`의 `mergeTimeSettingsSafely` 사용

**문제점**:
- Phase 2에서 `mergeTimeSettingsSafely` 함수를 생성하고 다른 위치에서 사용했지만, `planGroupDataSync.ts`에는 미적용
- Line 44-52: `Object.assign` 직접 사용 및 `as any` 다수 사용
- 보호 필드 보호 로직이 중복 구현됨

**작업 내용**:

- [ ] `lib/utils/planGroupDataSync.ts` 파일 확인
- [ ] `mergeTimeSettingsSafely` 함수 import 추가
- [ ] Line 43-53의 `Object.assign` 로직을 `mergeTimeSettingsSafely` 사용으로 변경
- [ ] `as any` 타입 단언 제거
- [ ] `console.warn`, `console.log` 제거 (병합 함수가 내부적으로 처리)
- [ ] Line 67-71의 최종 확인 로직 검토 (필요 여부 확인)
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `lib/utils/planGroupDataSync.ts:43-53` (time_settings 병합 로직)
- `lib/utils/planGroupDataSync.ts:67-71` (최종 확인 로직)

**예상 소요 시간**: 1시간

**관련 파일**:
- `lib/utils/planGroupDataSync.ts`
- `lib/utils/schedulerOptionsMerge.ts` (참고)

**구현 예시**:
```typescript
// 현재
if (wizardData.time_settings) {
  const templateBlockSetIdBefore = (schedulerOptions as any).template_block_set_id;
  Object.assign(schedulerOptions, wizardData.time_settings);
  if (templateBlockSetIdBefore && !(schedulerOptions as any).template_block_set_id) {
    console.warn("[planGroupDataSync] template_block_set_id가 time_settings 병합 시 덮어씌워짐, 복원:", {
      template_block_set_id: templateBlockSetIdBefore,
    });
    (schedulerOptions as any).template_block_set_id = templateBlockSetIdBefore;
  }
}

// 개선안
import { mergeTimeSettingsSafely } from "@/lib/utils/schedulerOptionsMerge";

if (wizardData.time_settings) {
  schedulerOptions = mergeTimeSettingsSafely(schedulerOptions, wizardData.time_settings);
}
```

---

## 🟠 Medium 우선순위 (중요 개선)

### 2. `lib/data/planGroups.ts`의 타입 안전성 개선

#### 2.1 `createPlanGroup` 함수의 파라미터 타입 개선

**문제점**:
- Line 283: `scheduler_options?: any | null`
- Line 289: `subject_constraints?: any | null`
- Line 290: `additional_period_reallocation?: any | null`
- Line 291: `non_study_time_blocks?: any | null`
- Line 292: `daily_schedule?: any | null`
- Line 301: `const payload: any = { ... }`

**작업 내용**:

- [ ] `lib/types/plan.ts`에서 타입 정의 확인
  - [ ] `SchedulerOptions` 타입 확인
  - [ ] `SubjectConstraints` 타입 확인
  - [ ] `AdditionalPeriodReallocation` 타입 확인
  - [ ] `NonStudyTimeBlock` 타입 확인
  - [ ] `DailyScheduleInfo` 타입 확인
- [ ] `createPlanGroup` 함수의 파라미터 타입 수정
  - [ ] `scheduler_options?: SchedulerOptions | null`
  - [ ] `subject_constraints?: SubjectConstraints | null`
  - [ ] `additional_period_reallocation?: AdditionalPeriodReallocation | null`
  - [ ] `non_study_time_blocks?: NonStudyTimeBlock[] | null`
  - [ ] `daily_schedule?: DailyScheduleInfo[] | null`
- [ ] `payload` 타입 정의
  - [ ] `PlanGroupPayload` 타입 인터페이스 생성
  - [ ] `const payload: PlanGroupPayload`로 변경
- [ ] TypeScript 컴파일 에러 확인 및 수정
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `lib/data/planGroups.ts:276-297` (함수 시그니처)
- `lib/data/planGroups.ts:301-312` (payload 생성)

**예상 소요 시간**: 1시간

**관련 파일**:
- `lib/data/planGroups.ts`
- `lib/types/plan.ts` (타입 정의)

---

#### 2.2 `getPlanGroupById` 함수의 에러 처리 개선

**문제점**:
- Line 256-258: `getErrorDetails` 함수를 사용하지 않고 수동으로 에러 정보 추출
- `isPostgrestError` 타입 가드 미사용
- `console.error` 직접 사용 (구조화된 로깅 미사용)

**작업 내용**:

- [ ] `lib/data/planGroups.ts` 상단에 `getErrorDetails`, `isPostgrestError` 함수 확인 (같은 파일 내)
- [ ] `logError` 함수 import 추가
- [ ] Line 248-267의 에러 처리 로직 수정
  - [ ] `isPostgrestError` 타입 가드 사용
  - [ ] `getErrorDetails` 함수 사용
  - [ ] `console.error` → `logError` 함수 사용
- [ ] 에러 컨텍스트 정보 추가 (function 이름 등)
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `lib/data/planGroups.ts:248-267` (에러 처리 로직)

**예상 소요 시간**: 0.5시간

**관련 파일**:
- `lib/data/planGroups.ts`
- `lib/errors/handler.ts` (logError 함수)

**구현 예시**:
```typescript
// 현재
if (error && error.code !== "PGRST116") {
  const errorInfo: Record<string, unknown> = {
    message: error.message || String(error),
    code: error.code || "UNKNOWN",
  };
  if ("details" in error) errorInfo.details = (error as { details?: unknown }).details;
  if ("hint" in error) errorInfo.hint = (error as { hint?: unknown }).hint;
  console.error("[data/planGroups] 플랜 그룹 조회 실패", {
    error: errorInfo,
    groupId,
    studentId,
    tenantId,
  });
  return null;
}

// 개선안
import { logError } from "@/lib/errors/handler";

if (error && isPostgrestError(error) && error.code !== "PGRST116") {
  const { details, hint } = getErrorDetails(error);
  logError(error, {
    function: "getPlanGroupById",
    groupId,
    studentId,
    tenantId,
    details,
    hint,
  });
  return null;
}
```

---

### 3. `app/(student)/actions/plan-groups/create.ts`의 로깅 개선

#### 3.1 중복 에러 로깅 제거

**문제점**:
- `withErrorHandling`이 이미 에러 로깅을 처리하는데 `createPlanGroupAction` 내부에서도 중복 로깅
- Line 265-297: try-catch 블록에서 중복된 에러 처리

**작업 내용**:

- [ ] `withErrorHandling` 함수의 동작 확인
  - [ ] `lib/errors/handler.ts`의 `withErrorHandling` 함수 확인
  - [ ] 에러 로깅이 자동으로 처리되는지 확인
- [ ] `createPlanGroupAction` 함수 수정
  - [ ] 중복된 try-catch 블록 제거
  - [ ] `withErrorHandling`이 에러를 처리하므로 내부 try-catch 불필요
- [ ] 정보성 로그는 별도 처리 (필요한 경우만)
  - [ ] 개발 환경에서만 로깅하도록 조건 추가
  - [ ] `logError` 함수의 `level: "info"` 사용 고려
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `app/(student)/actions/plan-groups/create.ts:242-299` (createPlanGroupAction 함수)

**예상 소요 시간**: 1시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/errors/handler.ts` (withErrorHandling 함수)

---

#### 3.2 `console.log` → 구조화된 로깅 변경

**문제점**:
- Line 251: `console.log` 사용 (구조화된 로깅 미사용)

**작업 내용**:

- [ ] `logError` 함수 import 추가
- [ ] Line 251의 `console.log` 제거 또는 변경
  - [ ] 정보성 로그는 개발 환경에서만 출력
  - [ ] `logError` 함수 사용 고려 (level: "info")
  - [ ] 또는 별도의 로깅 유틸리티 함수 생성
- [ ] 민감 정보 제외 확인
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `app/(student)/actions/plan-groups/create.ts:251` (console.log)

**예상 소요 시간**: 0.5시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/errors/handler.ts` (logError 함수)

---

### 4. 동적 import 최적화

#### 4.1 `PlanGroupError` 정적 import로 변경

**문제점**:
- Line 66: `await import("@/lib/errors/planGroupErrors")` - 런타임 동적 import
- 순환 참조 문제가 없는 경우 정적 import로 변경 가능

**작업 내용**:

- [ ] 순환 참조 확인
  - [ ] `lib/errors/planGroupErrors.ts`가 `create.ts`를 import하는지 확인
  - [ ] 순환 참조가 없으면 정적 import로 변경
- [ ] 정적 import로 변경
  - [ ] 파일 상단에 `import { PlanGroupError, PlanGroupErrorCodes, ErrorUserMessages } from "@/lib/errors/planGroupErrors";` 추가
  - [ ] Line 66의 동적 import 제거
- [ ] TypeScript 컴파일 에러 확인
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `app/(student)/actions/plan-groups/create.ts:66` (동적 import)
- `app/(student)/actions/plan-groups/create.ts:1-20` (import 섹션)

**예상 소요 시간**: 0.5시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/errors/planGroupErrors.ts`

---

#### 4.2 `updatePlanGroupDraftAction` 동적 import 검토

**문제점**:
- Line 93, 332: `await import("./update")` - 순환 참조 가능성 확인 필요

**작업 내용**:

- [ ] 순환 참조 확인
  - [ ] `app/(student)/actions/plan-groups/update.ts`가 `create.ts`를 import하는지 확인
  - [ ] 순환 참조가 없으면 정적 import로 변경
  - [ ] 순환 참조가 있으면 현재 방식 유지
- [ ] 순환 참조가 없는 경우 정적 import로 변경
  - [ ] 파일 상단에 `import { updatePlanGroupDraftAction } from "./update";` 추가
  - [ ] Line 93, 332의 동적 import 제거
- [ ] TypeScript 컴파일 에러 확인
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `app/(student)/actions/plan-groups/create.ts:93, 332` (동적 import)
- `app/(student)/actions/plan-groups/create.ts:1-20` (import 섹션)

**예상 소요 시간**: 0.5시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `app/(student)/actions/plan-groups/update.ts`

---

#### 4.3 `getCampTemplate` 동적 import 검토

**문제점**:
- `lib/plan/blocks.ts` Line 146, 236: `await import("@/lib/data/campTemplates")` - 순환 참조 가능성 낮음

**작업 내용**:

- [ ] 순환 참조 확인
  - [ ] `lib/data/campTemplates.ts`가 `blocks.ts`를 import하는지 확인
  - [ ] 순환 참조가 없으면 정적 import로 변경
- [ ] 정적 import로 변경
  - [ ] 파일 상단에 `import { getCampTemplate } from "@/lib/data/campTemplates";` 추가
  - [ ] Line 146, 236의 동적 import 제거
- [ ] TypeScript 컴파일 에러 확인
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `lib/plan/blocks.ts:146, 236` (동적 import)
- `lib/plan/blocks.ts:1-10` (import 섹션)

**예상 소요 시간**: 0.5시간

**관련 파일**:
- `lib/plan/blocks.ts`
- `lib/data/campTemplates.ts`

---

### 5. `lib/utils/planGroupDataSync.ts`의 로깅 개선

**문제점**:
- Line 48: `console.warn` 사용
- Line 68: `console.log` 사용
- 구조화된 로깅 미사용

**작업 내용**:

- [ ] `logError` 함수 import 추가
- [ ] Line 48의 `console.warn` 제거 또는 변경
  - [ ] `mergeTimeSettingsSafely` 사용 시 불필요할 수 있음 (함수 내부에서 처리)
  - [ ] 필요한 경우 `logError` 함수 사용 (level: "warn")
- [ ] Line 68의 `console.log` 제거 또는 변경
  - [ ] 개발 환경에서만 출력하도록 조건 추가
  - [ ] `logError` 함수 사용 고려 (level: "info")
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `lib/utils/planGroupDataSync.ts:48` (console.warn)
- `lib/utils/planGroupDataSync.ts:68` (console.log)

**예상 소요 시간**: 0.5시간

**관련 파일**:
- `lib/utils/planGroupDataSync.ts`
- `lib/errors/handler.ts` (logError 함수)

---

## 🟡 Low 우선순위 (점진적 개선)

### 6. `lib/utils/schedulerOptionsMerge.ts`의 타입 개선

**문제점**:
- Line 24, 25, 26: `Record<string, any>` 사용
- Line 99, 101: `Record<string, any>` 사용
- 타입 안전성 부족

**작업 내용**:

- [ ] `lib/types/plan.ts`에서 타입 정의 확인
  - [ ] `SchedulerOptions` 타입 확인
  - [ ] `TimeSettings` 타입 확인
- [ ] 함수 시그니처 수정
  - [ ] `mergeTimeSettingsSafely`: `SchedulerOptions & Partial<TimeSettings>` 타입 사용
  - [ ] `mergeStudyReviewCycle`: `SchedulerOptions` 타입 사용
- [ ] 반환 타입도 명시적으로 정의
- [ ] TypeScript 컴파일 에러 확인
- [ ] 기존 호출 코드와의 호환성 확인
- [ ] 테스트 실행하여 정상 동작 확인

**수정 위치**:
- `lib/utils/schedulerOptionsMerge.ts:23-26` (mergeTimeSettingsSafely 시그니처)
- `lib/utils/schedulerOptionsMerge.ts:98-101` (mergeStudyReviewCycle 시그니처)

**예상 소요 시간**: 0.5시간

**관련 파일**:
- `lib/utils/schedulerOptionsMerge.ts`
- `lib/types/plan.ts` (타입 정의)

**구현 예시**:
```typescript
// 현재
export function mergeTimeSettingsSafely(
  schedulerOptions: Record<string, any>,
  timeSettings: Record<string, any> | null | undefined
): Record<string, any>

// 개선안
import type { SchedulerOptions, TimeSettings } from "@/lib/types/plan";

export function mergeTimeSettingsSafely(
  schedulerOptions: SchedulerOptions & Partial<TimeSettings>,
  timeSettings: Partial<TimeSettings> | null | undefined
): SchedulerOptions & Partial<TimeSettings>
```

---

### 7. 테스트 커버리지 개선

#### 7.1 통합 테스트 구현

**현재 상태**:
- `__tests__/integration/planGroupTimeBlock.test.ts`에 기본 구조만 작성됨
- 실제 Supabase 연결이 필요한 테스트는 미구현

**작업 내용**:

- [ ] Supabase 모킹 전략 결정
  - [ ] Supabase 클라이언트 모킹 라이브러리 사용 고려
  - [ ] 또는 테스트 데이터베이스 사용
- [ ] 캠프 모드 통합 테스트 작성
  - [ ] 캠프 템플릿 생성
  - [ ] 템플릿에 블록 세트 연결
  - [ ] 플랜 그룹 생성 시 블록 세트 조회 확인
  - [ ] time_settings 병합 확인
- [ ] 일반 모드 통합 테스트 작성
  - [ ] 학생 블록 세트 생성
  - [ ] 플랜 그룹 생성 시 블록 세트 조회 확인
  - [ ] 활성 블록 세트 fallback 확인
- [ ] daily_schedule 생성 테스트 작성
  - [ ] time_slots 포함 확인
  - [ ] time_slots 누락 시 에러 처리 확인
- [ ] non_study_time_blocks 검증 테스트 작성
  - [ ] 유효한 데이터 저장 확인
  - [ ] 잘못된 데이터 검증 실패 확인

**테스트 파일**:
- `__tests__/integration/planGroupTimeBlock.test.ts`

**예상 소요 시간**: 4시간

**관련 파일**:
- `__tests__/integration/planGroupTimeBlock.test.ts`
- `app/(student)/actions/plan-groups/create.ts`
- `lib/plan/blocks.ts`
- `lib/utils/schedulerOptionsMerge.ts`

---

#### 7.2 에러 케이스 테스트 추가

**현재 상태**:
- 정상 케이스 위주로 테스트 작성됨
- 에러 케이스 테스트 부족

**작업 내용**:

- [ ] `schedulerOptionsMerge.test.ts`에 에러 케이스 테스트 추가
  - [ ] null/undefined 입력값 테스트
  - [ ] 잘못된 타입 입력값 테스트
  - [ ] 병합 실패 시나리오 테스트
- [ ] `planValidator.test.ts`에 경계값 테스트 추가
  - [ ] 최대/최소값 테스트
  - [ ] 특수 문자 입력 테스트
  - [ ] 매우 긴 문자열 입력 테스트
- [ ] `blocks.test.ts`에 에러 케이스 테스트 추가
  - [ ] 블록 세트 조회 실패 시나리오
  - [ ] 템플릿 조회 실패 시나리오
  - [ ] 데이터베이스 연결 실패 시나리오

**테스트 파일**:
- `__tests__/utils/schedulerOptionsMerge.test.ts`
- `__tests__/validation/planValidator.test.ts`
- `__tests__/plan/blocks.test.ts`

**예상 소요 시간**: 2시간

**관련 파일**:
- 기존 테스트 파일들
- 테스트 대상 함수들

---

### 8. 문서화 개선

#### 8.1 JSDoc 주석 보완

**현재 상태**:
- 기본적인 주석은 있으나 일부 함수에 부족

**작업 내용**:

- [ ] `lib/utils/schedulerOptionsMerge.ts` JSDoc 보완
  - [ ] `mergeTimeSettingsSafely` 함수
    - [ ] 파라미터 설명 보완
    - [ ] 반환값 설명 보완
    - [ ] 예제 코드 추가
  - [ ] `mergeStudyReviewCycle` 함수
    - [ ] 파라미터 설명 보완
    - [ ] 반환값 설명 보완
    - [ ] 예제 코드 추가
- [ ] `lib/plan/blocks.ts` JSDoc 보완
  - [ ] `getBlockSetForPlanGroup` 함수
  - [ ] `getTemplateBlockSetId` 함수
  - [ ] 내부 함수들도 주석 추가
- [ ] `lib/data/planGroups.ts` JSDoc 보완
  - [ ] `createPlanGroup` 함수
  - [ ] `getPlanGroupById` 함수
- [ ] `app/(student)/actions/plan-groups/create.ts` JSDoc 보완
  - [ ] `_createPlanGroup` 함수
  - [ ] `createPlanGroupAction` 함수

**예상 소요 시간**: 2시간

**관련 파일**:
- 모든 수정된 파일들

---

## 📊 작업 진행 체크리스트

### High 우선순위
- [ ] 1. `lib/utils/planGroupDataSync.ts`의 `mergeTimeSettingsSafely` 사용

### Medium 우선순위
- [ ] 2.1 `lib/data/planGroups.ts`의 `createPlanGroup` 함수 타입 개선
- [ ] 2.2 `lib/data/planGroups.ts`의 `getPlanGroupById` 함수 에러 처리 개선
- [ ] 3.1 `app/(student)/actions/plan-groups/create.ts`의 중복 에러 로깅 제거
- [ ] 3.2 `app/(student)/actions/plan-groups/create.ts`의 `console.log` → 구조화된 로깅 변경
- [ ] 4.1 `PlanGroupError` 정적 import로 변경
- [ ] 4.2 `updatePlanGroupDraftAction` 동적 import 검토
- [ ] 4.3 `getCampTemplate` 동적 import 검토
- [ ] 5. `lib/utils/planGroupDataSync.ts`의 로깅 개선

### Low 우선순위
- [ ] 6. `lib/utils/schedulerOptionsMerge.ts`의 타입 개선
- [ ] 7.1 통합 테스트 구현
- [ ] 7.2 에러 케이스 테스트 추가
- [ ] 8.1 JSDoc 주석 보완

---

## 📈 예상 총 소요 시간

- **High 우선순위**: 1시간
- **Medium 우선순위**: 4.5시간
- **Low 우선순위**: 8.5시간
- **총 예상 시간**: 14시간 (약 2일)

---

## 🎯 권장 작업 순서

### Phase 4: High + Medium 우선순위 (1주)

1. **High 우선순위 작업** (1시간)
   - `planGroupDataSync.ts`의 `mergeTimeSettingsSafely` 사용

2. **Medium 우선순위 작업** (4.5시간)
   - 타입 안전성 개선
   - 에러 처리 개선
   - 로깅 개선
   - 동적 import 최적화

### Phase 5: Low 우선순위 (1주)

1. **타입 개선** (0.5시간)
2. **테스트 커버리지 개선** (6시간)
3. **문서화 개선** (2시간)

---

## 🔗 관련 파일

### 수정 예정 파일

1. `lib/utils/planGroupDataSync.ts` (High)
2. `lib/data/planGroups.ts` (Medium)
3. `app/(student)/actions/plan-groups/create.ts` (Medium)
4. `lib/plan/blocks.ts` (Medium - 동적 import)
5. `lib/utils/schedulerOptionsMerge.ts` (Low)

### 참고 파일

1. `lib/types/plan.ts` - 타입 정의
2. `lib/errors/handler.ts` - 에러 로깅 유틸리티
3. `lib/utils/schedulerOptionsMerge.ts` - 병합 함수
4. `__tests__/` - 테스트 파일들

---

## 📝 작업 시 주의사항

### 1. 순환 참조 확인

- 동적 import를 정적 import로 변경하기 전에 반드시 순환 참조 확인
- 순환 참조가 있는 경우 현재 방식 유지

### 2. 타입 호환성

- 타입 변경 시 기존 호출 코드와의 호환성 확인
- 점진적 타입 개선 권장

### 3. 테스트 우선

- 모든 변경 사항에 대해 테스트 작성 및 실행
- 기존 테스트가 실패하지 않는지 확인

### 4. 점진적 개선

- 한 번에 모든 것을 변경하지 말고 단계적으로 진행
- 각 단계마다 커밋 및 테스트

---

## 💡 추가 고려사항

### 1. 성능 모니터링

- 프로덕션 환경에서 성능 모니터링
- 느린 쿼리 확인 및 최적화
- 메모리 사용량 확인

### 2. 사용자 피드백

- 실제 사용자 피드백 수집
- 에러 발생 빈도 모니터링
- 개선 사항 반영

### 3. 코드 리뷰

- Phase 1-3 작업 완료 후 코드 리뷰 권장
- 팀 내 리뷰 또는 외부 리뷰 고려

### 4. 지속적인 개선

- 정기적인 코드 점검
- 새로운 개선 사항 발견 시 즉시 반영
- 기술 부채 관리

---

**작성자**: AI Assistant  
**작성 일자**: 2025-02-01

