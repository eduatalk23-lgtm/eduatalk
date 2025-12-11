# 플랜 그룹 생성 시 시간 블록 기능 점검 결과

**작업 일자**: 2025-02-01  
**작업 범위**: 플랜 그룹 생성 시 시간 블록 기능 점검 및 개선 사항 분석

## 📋 개요

플랜 그룹 생성 시 시간 블록 관련 기능(`block_set_id`, `time_settings`, `non_study_time_blocks`, `daily_schedule`)의 문제점, 개선점, 중복 코드, 로직 오류를 분석했습니다.

---

## 🔴 1. 문제점 분석

### 1.1 `block_set_id` 처리 불일치

**위치**: `app/(student)/actions/plan-groups/create.ts:107`

**문제**:
- 캠프 모드에서 `block_set_id`가 `null`로 설정됨 (Line 1834-1835 in `campTemplateActions.ts`)
- 일반 모드에서는 `block_set_id`가 필수
- 두 모드 간 처리 로직이 분리되어 있어 일관성 부족

**영향**: 캠프 모드에서 블록 세트 조회 실패 가능

**관련 코드**:
```typescript
// app/(admin)/actions/campTemplateActions.ts:1834-1835
// 캠프 모드에서는 block_set_id를 null로 설정
creationData.block_set_id = null;
```

---

### 1.2 `time_settings` 병합 로직의 덮어쓰기 위험

**위치**: `app/(student)/actions/plan-groups/create.ts:45-68`

**문제**:
- `time_settings`를 `scheduler_options`에 병합할 때 `template_block_set_id`가 덮어쓸 수 있음
- 복원 로직이 있지만 사전 방지가 부족

**코드**:
```typescript
// time_settings를 scheduler_options에 병합
const mergedSchedulerOptions = data.scheduler_options || {};

// template_block_set_id 보호 (캠프 모드에서 중요)
const templateBlockSetId = (mergedSchedulerOptions as any).template_block_set_id;

if (data.time_settings) {
  Object.assign(mergedSchedulerOptions, data.time_settings);
  
  // template_block_set_id가 덮어씌워졌는지 확인하고 복원
  if (templateBlockSetId && !(mergedSchedulerOptions as any).template_block_set_id) {
    console.warn("[_createPlanGroup] template_block_set_id가 time_settings 병합 시 덮어씌워짐, 복원:", {
      template_block_set_id: templateBlockSetId,
    });
    (mergedSchedulerOptions as any).template_block_set_id = templateBlockSetId;
  }
}
```

---

### 1.3 `daily_schedule`의 `time_slots` 생성 누락 가능성

**위치**: `lib/scheduler/calculateAvailableDates.ts:547-774`

**문제**:
- `generateTimeSlots` 함수가 호출되지만 `daily_schedule`에 저장되는지 불명확
- `time_slots` 생성과 저장 로직이 분리되어 있음

**영향**: UI에서 시간 슬롯이 표시되지 않을 수 있음

---

### 1.4 `non_study_time_blocks` 검증 부재

**위치**: `app/(student)/actions/plan-groups/create.ts:111`

**문제**:
- `non_study_time_blocks` 저장 전 검증이 없음
- 형식 검증 및 중복 체크가 없음

**영향**: 잘못된 데이터가 저장될 수 있음

---

## 💡 2. 개선점 분석

### 2.1 `block_set_id` 처리 통합

**현재**: 캠프 모드와 일반 모드에서 분리된 처리

**개선**: 공통 함수로 추출하여 일관성 확보

**위치**: `lib/plan/blocks.ts`에 통합 함수 추가

---

### 2.2 `time_settings` 병합 안전성 강화

**현재**: `Object.assign` 사용으로 덮어쓰기 위험

**개선**: 병합 전 필드 제외 목록 확인 또는 병합 전략 명시

**예시**:
```typescript
// 개선안
const protectedFields = ['template_block_set_id'];
const timeSettingsToMerge = Object.fromEntries(
  Object.entries(data.time_settings).filter(([key]) => !protectedFields.includes(key))
);
Object.assign(mergedSchedulerOptions, timeSettingsToMerge);
```

---

### 2.3 `daily_schedule` 생성 및 저장 흐름 명확화

**현재**: 생성과 저장이 분리되어 있음

**개선**: 생성 함수에서 `daily_schedule` 반환 및 저장 보장

**위치**: `lib/scheduler/calculateAvailableDates.ts` 개선

---

### 2.4 `non_study_time_blocks` 검증 추가

**현재**: 검증이 없음

**개선**: Zod 스키마로 검증 추가

**위치**: `lib/validation/planValidator.ts`에 검증 로직 추가

---

## 🔄 3. 중복된 코드

### 3.1 `time_settings` 병합 로직 중복

**위치 1**: `app/(student)/actions/plan-groups/create.ts:45-68` (`_createPlanGroup`)
**위치 2**: `app/(student)/actions/plan-groups/create.ts:334-338` (`_savePlanGroupDraft`)
**위치 3**: `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:117-119`

**개선**: 공통 함수로 추출

---

### 3.2 `block_set_id` 조회 로직 중복

**위치 1**: `lib/plan/blocks.ts:88-143` (`getTemplateBlockSet`)
**위치 2**: `lib/utils/planGroupTransform.ts:115-127`
**위치 3**: `app/(admin)/actions/campTemplateActions.ts:1406-1454`

**개선**: `lib/plan/blocks.ts`의 함수를 재사용

---

### 3.3 `study_review_cycle` 병합 로직 중복

**위치 1**: `app/(student)/actions/plan-groups/create.ts:70-74`
**위치 2**: `app/(student)/actions/plan-groups/create.ts:340-344`
**위치 3**: `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts:103-106`

**개선**: 공통 함수로 추출

---

## ⚠️ 4. 로직 오류

### 4.1 캠프 모드에서 `block_set_id` null 처리

**위치**: `app/(admin)/actions/campTemplateActions.ts:1834-1835`

**문제**:
```typescript
// 캠프 모드에서는 block_set_id를 null로 설정
creationData.block_set_id = null;
```

**설명**: 캠프 모드에서도 템플릿 블록 세트를 사용하므로 `null`이 아닌 템플릿 블록 세트 ID를 설정해야 함

**개선**: 템플릿 블록 세트 ID를 조회하여 설정

---

### 4.2 `daily_schedule` 저장 시 `time_slots` 누락 가능성

**위치**: `app/(student)/actions/plan-groups/create.ts:112`

**문제**: `daily_schedule`가 저장되지만 `time_slots` 생성 여부 확인이 없음

**개선**: 저장 전 `time_slots` 생성 확인 및 보장

---

### 4.3 `non_study_time_blocks`와 `daily_schedule`의 `time_slots` 중복

**문제**: 두 필드 모두 시간 블록 정보를 저장하지만 용도가 불명확

**개선**: 용도 명확화 및 중복 제거

---

## 📊 5. 권장 개선 사항

### 우선순위 1 (Critical)
1. 캠프 모드 `block_set_id` null 처리 수정
2. `time_settings` 병합 시 보호 필드 명시적 처리
3. `daily_schedule` 생성 및 저장 흐름 명확화

### 우선순위 2 (High)
1. 중복 코드 공통 함수 추출
2. `non_study_time_blocks` 검증 추가
3. `block_set_id` 조회 로직 통합

### 우선순위 3 (Medium)
1. 타입 안전성 개선 (`as any` 제거)
2. 에러 처리 강화
3. 로깅 개선

---

## ✅ 6. 개선 작업 체크리스트

- [ ] `block_set_id` 처리 통합 함수 생성
- [ ] `time_settings` 병합 안전성 강화
- [ ] `daily_schedule` 생성 및 저장 흐름 명확화
- [ ] `non_study_time_blocks` 검증 추가
- [ ] 중복 코드 공통 함수 추출
- [ ] 캠프 모드 `block_set_id` null 처리 수정
- [ ] 타입 안전성 개선
- [ ] 단위 테스트 추가

---

**참고 파일**:
- `app/(student)/actions/plan-groups/create.ts`
- `lib/data/planGroups.ts`
- `lib/plan/blocks.ts`
- `lib/utils/planGroupTransform.ts`
- `app/(admin)/actions/campTemplateActions.ts`
- `lib/scheduler/calculateAvailableDates.ts`

