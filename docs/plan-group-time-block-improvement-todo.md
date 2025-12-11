# 플랜 그룹 생성 시 시간 블록 기능 개선 TODO

**작성 일자**: 2025-02-01  
**관련 문서**: `plan-group-time-block-analysis-2025-02-01.md`

---

## 🔴 우선순위 1: Critical (즉시 수정 필요)

### 1.1 캠프 모드 `block_set_id` null 처리 수정

**문제**: 캠프 모드에서 `block_set_id`가 `null`로 설정되어 블록 세트 조회 실패

**위치**: `app/(admin)/actions/campTemplateActions.ts:1834-1835`

**작업 내용**:
- [ ] `bulkCreatePlanGroupsForCamp` 함수에서 템플릿 블록 세트 ID 조회 로직 추가
- [ ] `getCampPlanGroupForReview` 함수의 블록 세트 조회 로직 참고하여 구현
- [ ] 템플릿 블록 세트 ID를 `creationData.block_set_id`에 설정
- [ ] 캠프 모드에서도 블록 세트가 정상적으로 조회되는지 테스트

**예상 소요 시간**: 2시간

**관련 파일**:
- `app/(admin)/actions/campTemplateActions.ts`
- `lib/plan/blocks.ts`

---

### 1.2 `time_settings` 병합 시 보호 필드 명시적 처리

**문제**: `time_settings` 병합 시 `template_block_set_id`가 덮어쓸 수 있음

**위치**: `app/(student)/actions/plan-groups/create.ts:45-68`

**작업 내용**:
- [ ] 보호 필드 목록 정의 (`template_block_set_id` 등)
- [ ] 병합 전 보호 필드 제외 로직 구현
- [ ] `_createPlanGroup` 함수 수정
- [ ] `_savePlanGroupDraft` 함수에도 동일 로직 적용
- [ ] 기존 복원 로직 제거 (사전 방지로 대체)
- [ ] 단위 테스트 작성

**예상 소요 시간**: 3시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/utils/schedulerOptionsMerge.ts` (신규 생성)

**구현 예시**:
```typescript
// lib/utils/schedulerOptionsMerge.ts
const PROTECTED_FIELDS = ['template_block_set_id', 'camp_template_id'];

export function mergeTimeSettingsSafely(
  schedulerOptions: Record<string, any>,
  timeSettings: Record<string, any>
): Record<string, any> {
  const protected = Object.fromEntries(
    PROTECTED_FIELDS
      .filter(key => schedulerOptions[key] !== undefined)
      .map(key => [key, schedulerOptions[key]])
  );
  
  const merged = {
    ...schedulerOptions,
    ...timeSettings,
    ...protected, // 보호 필드 재적용
  };
  
  return merged;
}
```

---

### 1.3 `daily_schedule` 생성 및 저장 흐름 명확화

**문제**: `time_slots` 생성과 저장 로직이 분리되어 있어 누락 가능성

**위치**: `lib/scheduler/calculateAvailableDates.ts:547-774`

**작업 내용**:
- [ ] `generateTimeSlots` 함수가 `daily_schedule`에 포함되는지 확인
- [ ] `calculateAvailableTimeForDate` 함수의 반환값에 `time_slots` 포함 여부 확인
- [ ] `daily_schedule` 생성 시 `time_slots`가 항상 포함되도록 보장
- [ ] 저장 전 `time_slots` 검증 로직 추가
- [ ] 플랜 그룹 생성 시 `daily_schedule`의 `time_slots` 확인 로직 추가
- [ ] 통합 테스트 작성

**예상 소요 시간**: 4시간

**관련 파일**:
- `lib/scheduler/calculateAvailableDates.ts`
- `app/(student)/actions/plan-groups/create.ts`
- `app/(student)/actions/plan-groups/queries.ts`

---

## 🟠 우선순위 2: High (중요 개선)

### 2.1 중복 코드 공통 함수 추출

#### 2.1.1 `time_settings` 병합 로직 통합

**위치**:
- `app/(student)/actions/plan-groups/create.ts:45-68` (`_createPlanGroup`)
- `app/(student)/actions/plan-groups/create.ts:334-338` (`_savePlanGroupDraft`)
- `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:117-119`

**작업 내용**:
- [ ] `lib/utils/schedulerOptionsMerge.ts` 파일 생성
- [ ] `mergeTimeSettingsSafely` 함수 구현 (1.2 작업과 연계)
- [ ] `_createPlanGroup`에서 공통 함수 사용
- [ ] `_savePlanGroupDraft`에서 공통 함수 사용
- [ ] `usePlanPayloadBuilder`에서 공통 함수 사용
- [ ] 기존 중복 코드 제거
- [ ] 단위 테스트 작성

**예상 소요 시간**: 2시간

**관련 파일**:
- `lib/utils/schedulerOptionsMerge.ts` (신규)
- `app/(student)/actions/plan-groups/create.ts`
- `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts`

---

#### 2.1.2 `study_review_cycle` 병합 로직 통합

**위치**:
- `app/(student)/actions/plan-groups/create.ts:70-74`
- `app/(student)/actions/plan-groups/create.ts:340-344`
- `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:103-106`

**작업 내용**:
- [ ] `lib/utils/schedulerOptionsMerge.ts`에 `mergeStudyReviewCycle` 함수 추가
- [ ] 각 위치에서 공통 함수 사용
- [ ] 기존 중복 코드 제거
- [ ] 단위 테스트 작성

**예상 소요 시간**: 1시간

**관련 파일**:
- `lib/utils/schedulerOptionsMerge.ts`
- `app/(student)/actions/plan-groups/create.ts`
- `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts`

---

### 2.2 `non_study_time_blocks` 검증 추가

**문제**: 저장 전 검증이 없어 잘못된 데이터 저장 가능

**위치**: `app/(student)/actions/plan-groups/create.ts:111`

**작업 내용**:
- [ ] `lib/types/plan.ts`에 `NonStudyTimeBlock` 타입 정의 확인
- [ ] `lib/validation/planValidator.ts`에 `non_study_time_blocks` 검증 스키마 추가
- [ ] 시간 형식 검증 (HH:mm)
- [ ] 시간 범위 검증 (start < end)
- [ ] 중복 체크 (같은 시간대 중복 방지)
- [ ] `PlanValidator.validateCreation`에 검증 로직 추가
- [ ] 에러 메시지 정의
- [ ] 단위 테스트 작성

**예상 소요 시간**: 3시간

**관련 파일**:
- `lib/validation/planValidator.ts`
- `lib/types/plan.ts`
- `app/(student)/actions/plan-groups/create.ts`

**검증 스키마 예시**:
```typescript
const nonStudyTimeBlockSchema = z.object({
  type: z.enum(["아침식사", "점심식사", "저녁식사", "수면", "기타"]),
  start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  day_of_week: z.array(z.number().min(0).max(6)).optional(),
  description: z.string().optional(),
});

const nonStudyTimeBlocksSchema = z.array(nonStudyTimeBlockSchema)
  .refine((blocks) => {
    // 중복 체크
    const keys = new Set();
    for (const block of blocks) {
      const key = `${block.start_time}-${block.end_time}-${block.day_of_week?.join(',') || 'all'}`;
      if (keys.has(key)) return false;
      keys.add(key);
    }
    return true;
  }, { message: "중복된 시간 블록이 있습니다." });
```

---

### 2.3 `block_set_id` 조회 로직 통합

**위치**:
- `lib/plan/blocks.ts:88-143` (`getTemplateBlockSet`)
- `lib/utils/planGroupTransform.ts:115-127`
- `app/(admin)/actions/campTemplateActions.ts:1406-1454`

**작업 내용**:
- [ ] `lib/plan/blocks.ts`의 `getTemplateBlockSet` 함수를 공통 함수로 개선
- [ ] 연결 테이블 → 하위 호환성 → template_data 순서로 조회하는 로직 통합
- [ ] `lib/utils/planGroupTransform.ts`에서 공통 함수 사용
- [ ] `app/(admin)/actions/campTemplateActions.ts`에서 공통 함수 사용
- [ ] 기존 중복 코드 제거
- [ ] 단위 테스트 작성

**예상 소요 시간**: 3시간

**관련 파일**:
- `lib/plan/blocks.ts`
- `lib/utils/planGroupTransform.ts`
- `app/(admin)/actions/campTemplateActions.ts`

---

## 🟡 우선순위 3: Medium (점진적 개선)

### 3.1 타입 안전성 개선 (`as any` 제거)

**문제**: 여러 위치에서 `as any` 사용으로 타입 안전성 저하

**작업 내용**:
- [ ] `app/(student)/actions/plan-groups/create.ts`의 `as any` 제거
- [ ] `lib/utils/planGroupTransform.ts`의 `as any` 제거
- [ ] `lib/data/planGroups.ts`의 `as any` 제거
- [ ] 적절한 타입 정의 추가
- [ ] 타입 가드 함수 작성
- [ ] TypeScript 컴파일 에러 해결

**예상 소요 시간**: 4시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/utils/planGroupTransform.ts`
- `lib/data/planGroups.ts`
- `lib/types/plan.ts`

---

### 3.2 에러 처리 강화

**작업 내용**:
- [ ] `block_set_id` 조회 실패 시 명확한 에러 메시지
- [ ] `time_settings` 병합 실패 시 에러 처리
- [ ] `daily_schedule` 생성 실패 시 에러 처리
- [ ] `non_study_time_blocks` 검증 실패 시 에러 메시지 개선
- [ ] 에러 로깅 개선

**예상 소요 시간**: 2시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/plan/blocks.ts`
- `lib/validation/planValidator.ts`

---

### 3.3 로깅 개선

**작업 내용**:
- [ ] 구조화된 로깅 형식 적용
- [ ] 로그 레벨 구분 (debug, info, warn, error)
- [ ] 민감 정보 제외
- [ ] 로그 컨텍스트 추가 (groupId, studentId 등)

**예상 소요 시간**: 2시간

**관련 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/plan/blocks.ts`
- `lib/utils/schedulerOptionsMerge.ts`

---

### 3.4 단위 테스트 추가

**작업 내용**:
- [ ] `schedulerOptionsMerge` 함수 테스트
- [ ] `block_set_id` 조회 로직 테스트
- [ ] `non_study_time_blocks` 검증 테스트
- [ ] `daily_schedule` 생성 테스트
- [ ] 통합 테스트 작성

**예상 소요 시간**: 6시간

**관련 파일**:
- `__tests__/utils/schedulerOptionsMerge.test.ts` (신규)
- `__tests__/plan/blocks.test.ts` (신규)
- `__tests__/validation/planValidator.test.ts` (신규)

---

## 📋 작업 진행 체크리스트

### Phase 1: Critical 수정 (1주)
- [ ] 1.1 캠프 모드 `block_set_id` null 처리 수정
- [ ] 1.2 `time_settings` 병합 시 보호 필드 명시적 처리
- [ ] 1.3 `daily_schedule` 생성 및 저장 흐름 명확화

### Phase 2: High 개선 (1주)
- [ ] 2.1.1 `time_settings` 병합 로직 통합
- [ ] 2.1.2 `study_review_cycle` 병합 로직 통합
- [ ] 2.2 `non_study_time_blocks` 검증 추가
- [ ] 2.3 `block_set_id` 조회 로직 통합

### Phase 3: Medium 개선 (1주)
- [ ] 3.1 타입 안전성 개선
- [ ] 3.2 에러 처리 강화
- [ ] 3.3 로깅 개선
- [ ] 3.4 단위 테스트 추가

---

## 📊 예상 총 소요 시간

- **우선순위 1 (Critical)**: 9시간
- **우선순위 2 (High)**: 9시간
- **우선순위 3 (Medium)**: 14시간
- **총 예상 시간**: 32시간 (약 4일)

---

## 🔗 관련 문서

- [플랜 그룹 생성 시 시간 블록 기능 점검 결과](./plan-group-time-block-analysis-2025-02-01.md)
- [플랜 그룹 생성 저장 정보](./플랜_그룹_생성_저장_정보.md)

---

**마지막 업데이트**: 2025-02-01

