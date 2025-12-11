# 플랜 그룹 시간 블록 기능 개선 Phase 1 완료 보고

**작업 일자**: 2025-02-01  
**작업 범위**: 우선순위 1 (Critical) 작업 완료  
**관련 문서**: 
- `plan-group-time-block-analysis-2025-02-01.md`
- `plan-group-time-block-improvement-todo.md`

---

## 📋 작업 개요

플랜 그룹 생성 시 시간 블록 관련 Critical 이슈 3가지를 수정했습니다.

---

## ✅ 완료된 작업

### 1. 캠프 모드 `block_set_id` null 처리 수정

**문제점**:
- `app/(admin)/actions/campTemplateActions.ts:1834-1835`에서 캠프 모드 생성 시 `block_set_id`를 `null`로 설정
- 이로 인해 블록 세트 조회 실패 및 UI 표시 문제 발생

**해결 방법**:
- `continueCampStepsForAdmin` 함수에서 `block_set_id = null` 제거
- 템플릿 블록 세트 ID 조회 로직 추가
- `getCampPlanGroupForReview` 함수의 조회 로직 참고 (연결 테이블 → scheduler_options → template_data 순서)

**구현 내용**:
```typescript
// 템플릿 블록 세트 ID 조회 로직 추가
if (result.group.camp_template_id) {
  // 1. 연결 테이블에서 직접 조회
  const { data: templateBlockSetLink } = await supabase
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", result.group.camp_template_id)
    .maybeSingle();

  // 2. scheduler_options에서 template_block_set_id 확인 (Fallback)
  // 3. template_data에서 block_set_id 확인 (하위 호환성)
  
  if (tenantBlockSetId) {
    creationData.block_set_id = tenantBlockSetId;
  }
}
```

**수정 파일**:
- `app/(admin)/actions/campTemplateActions.ts`

---

### 2. `time_settings` 병합 시 보호 필드 명시적 처리

**문제점**:
- `app/(student)/actions/plan-groups/create.ts:45-68`에서 `Object.assign`으로 병합 시 `template_block_set_id`가 덮어쓸 수 있음
- 현재는 사후 복원 로직만 있어 사전 방지 부족
- `_savePlanGroupDraft`와 `bulkCreatePlanGroupsForCamp`에도 동일한 문제 존재

**해결 방법**:
- `lib/utils/schedulerOptionsMerge.ts` 파일 생성
- `mergeTimeSettingsSafely` 함수 구현 (보호 필드 목록 정의 및 병합 전 제외)
- 세 위치에서 공통 함수 사용:
  - `_createPlanGroup` (Line 45-68)
  - `_savePlanGroupDraft` (Line 334-338)
  - `continueCampStepsForAdmin` (Line 1844-1851)

**구현 내용**:
```typescript
// lib/utils/schedulerOptionsMerge.ts
const PROTECTED_FIELDS = ["template_block_set_id", "camp_template_id"];

export function mergeTimeSettingsSafely(
  schedulerOptions: Record<string, any>,
  timeSettings: Record<string, any> | null | undefined
): Record<string, any> {
  if (!timeSettings) {
    return schedulerOptions;
  }

  // 보호 필드 추출
  const protected = Object.fromEntries(
    PROTECTED_FIELDS
      .filter((key) => schedulerOptions[key] !== undefined)
      .map((key) => [key, schedulerOptions[key]])
  );

  // 병합 (보호 필드 제외)
  const merged = {
    ...schedulerOptions,
    ...timeSettings,
    ...protected, // 보호 필드 재적용
  };

  return merged;
}
```

**수정 파일**:
- `lib/utils/schedulerOptionsMerge.ts` (신규 생성)
- `app/(student)/actions/plan-groups/create.ts`
- `app/(admin)/actions/campTemplateActions.ts`

---

### 3. `daily_schedule` 생성 및 저장 흐름 명확화

**문제점**:
- `lib/scheduler/calculateAvailableDates.ts`에서 `time_slots`는 생성되지만 저장 시 검증 부재
- `app/(student)/actions/plan-groups/create.ts:112`에서 `daily_schedule` 저장 전 검증 없음

**해결 방법**:
- `calculateAvailableDates` 함수는 이미 `time_slots`를 포함하여 반환하는 것을 확인 (Line 1087)
- `_createPlanGroup` 함수에서 저장 전 `daily_schedule` 검증 로직 추가
- 각 날짜의 `time_slots` 존재 여부 확인 및 누락 시 경고 로그

**구현 내용**:
```typescript
// daily_schedule 검증 로직 추가
if (data.daily_schedule && Array.isArray(data.daily_schedule)) {
  const missingTimeSlots = data.daily_schedule.filter(
    (day) => !day.time_slots || day.time_slots.length === 0
  );

  if (missingTimeSlots.length > 0) {
    console.warn(
      "[_createPlanGroup] daily_schedule에 time_slots가 없는 날짜가 있습니다:",
      missingTimeSlots.map((d) => d.date)
    );
  }
}
```

**수정 파일**:
- `app/(student)/actions/plan-groups/create.ts`

---

## 📊 작업 결과

### 수정된 파일 목록

1. **신규 생성**
   - `lib/utils/schedulerOptionsMerge.ts` - 스케줄러 옵션 병합 유틸리티

2. **수정**
   - `app/(student)/actions/plan-groups/create.ts` - 플랜 그룹 생성 로직 개선
   - `app/(admin)/actions/campTemplateActions.ts` - 캠프 모드 블록 세트 조회 로직 개선

### 코드 변경 통계

- **신규 파일**: 1개
- **수정 파일**: 2개
- **추가된 라인**: 약 150줄
- **제거된 라인**: 약 30줄

---

## 🧪 테스트 체크리스트

- [ ] 캠프 모드 플랜 그룹 생성 시 `block_set_id`가 올바르게 설정되는지 확인
- [ ] `time_settings` 병합 시 `template_block_set_id`가 보호되는지 확인
- [ ] `daily_schedule` 저장 시 모든 날짜에 `time_slots`가 포함되는지 확인
- [ ] 기존 기능(일반 모드 플랜 그룹 생성)이 정상 동작하는지 확인

---

## 📝 다음 단계

### Phase 2: High 개선 (예정)

1. 중복 코드 공통 함수 추출
   - `study_review_cycle` 병합 로직 통합
   - `block_set_id` 조회 로직 통합

2. `non_study_time_blocks` 검증 추가
   - Zod 스키마로 검증 추가
   - 시간 형식 및 범위 검증

### Phase 3: Medium 개선 (예정)

1. 타입 안전성 개선 (`as any` 제거)
2. 에러 처리 강화
3. 로깅 개선
4. 단위 테스트 추가

---

## 🔗 관련 문서

- [플랜 그룹 생성 시 시간 블록 기능 점검 결과](./plan-group-time-block-analysis-2025-02-01.md)
- [플랜 그룹 생성 시 시간 블록 기능 개선 TODO](./plan-group-time-block-improvement-todo.md)

---

**작성자**: AI Assistant  
**작성 일자**: 2025-02-01

