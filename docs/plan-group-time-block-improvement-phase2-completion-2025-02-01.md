# 플랜 그룹 시간 블록 기능 개선 Phase 2 완료 보고

**작업 일자**: 2025-02-01  
**작업 범위**: 우선순위 2 (High) 작업 완료  
**관련 문서**: 
- `plan-group-time-block-analysis-2025-02-01.md`
- `plan-group-time-block-improvement-todo.md`
- `plan-group-time-block-improvement-phase1-completion-2025-02-01.md`

---

## 📋 작업 개요

플랜 그룹 생성 시 시간 블록 관련 High 우선순위 개선 작업 4가지를 완료했습니다.

---

## ✅ 완료된 작업

### 1. usePlanPayloadBuilder에서 time_settings 병합 함수 사용

**문제점**:
- Phase 1에서 `mergeTimeSettingsSafely` 함수를 생성했지만 `usePlanPayloadBuilder.ts`에서 아직 사용하지 않음
- `Object.assign`을 사용하여 보호 필드가 덮어쓸 수 있는 위험 존재

**해결 방법**:
- `usePlanPayloadBuilder.ts`에서 `mergeTimeSettingsSafely` import 및 사용
- `Object.assign` 대신 `mergeTimeSettingsSafely` 사용

**수정 파일**:
- `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts`

---

### 2. study_review_cycle 병합 로직 통합

**문제점**:
- `study_review_cycle` 병합 로직이 3곳에서 중복:
  - `_createPlanGroup` (Line 70-74)
  - `_savePlanGroupDraft` (Line 340-344)
  - `usePlanPayloadBuilder` (Line 103-106)

**해결 방법**:
- `lib/utils/schedulerOptionsMerge.ts`에 `mergeStudyReviewCycle` 함수 추가
- 세 위치에서 공통 함수 사용
- 기존 중복 코드 제거

**구현 내용**:
```typescript
// lib/utils/schedulerOptionsMerge.ts
export function mergeStudyReviewCycle(
  schedulerOptions: Record<string, any>,
  studyReviewCycle: { study_days: number; review_days: number } | null | undefined
): Record<string, any> {
  if (!studyReviewCycle) {
    return schedulerOptions;
  }

  return {
    ...schedulerOptions,
    study_days: studyReviewCycle.study_days,
    review_days: studyReviewCycle.review_days,
  };
}
```

**수정 파일**:
- `lib/utils/schedulerOptionsMerge.ts` (신규 함수 추가)
- `app/(student)/actions/plan-groups/create.ts`
- `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts`

---

### 3. non_study_time_blocks 검증 추가

**문제점**:
- 저장 전 검증이 없어 잘못된 데이터 저장 가능
- 시간 형식, 범위, 중복 체크 부재

**해결 방법**:
- `lib/validation/planValidator.ts`에 `validateNonStudyTimeBlocks` 메서드 추가
- Zod 스키마로 검증 (시간 형식, 범위, 중복 체크)
- `PlanValidator.validateCreation`에 검증 로직 추가

**구현 내용**:
- Zod 스키마로 시간 형식 검증 (HH:mm)
- 시간 범위 검증 (start < end)
- 중복 체크 (같은 시간대 중복 방지)
- `PlanValidator.validateCreation`에 통합

**수정 파일**:
- `lib/validation/planValidator.ts`

---

### 4. block_set_id 조회 로직 통합

**문제점**:
- 템플릿 블록 세트 ID 조회 로직이 3곳에서 중복:
  - `lib/plan/blocks.ts:88-143` (`getTemplateBlockSet` - BlockInfo[] 반환)
  - `lib/utils/planGroupTransform.ts:115-127` (template_data만 확인)
  - `app/(admin)/actions/campTemplateActions.ts:1406-1463` (완전한 조회 로직)

**해결 방법**:
- `lib/plan/blocks.ts`에 `getTemplateBlockSetId` 함수 추가 (tenant_block_set_id 반환)
- 연결 테이블 → scheduler_options → template_data 순서로 조회하는 로직 통합
- 세 위치에서 공통 함수 사용
- 기존 중복 코드 제거

**구현 내용**:
```typescript
// lib/plan/blocks.ts
export async function getTemplateBlockSetId(
  templateId: string,
  schedulerOptions?: Record<string, any> | null,
  tenantId?: string | null
): Promise<string | null> {
  // 1. 연결 테이블에서 직접 조회
  // 2. scheduler_options에서 template_block_set_id 확인 (Fallback)
  // 3. template_data에서 block_set_id 확인 (하위 호환성)
  // ...
}
```

**수정 파일**:
- `lib/plan/blocks.ts` (신규 함수 추가)
- `lib/utils/planGroupTransform.ts`
- `app/(admin)/actions/campTemplateActions.ts` (getCampPlanGroupForReview, continueCampStepsForAdmin)

---

## 📊 작업 결과

### 수정된 파일 목록

1. **수정**
   - `lib/utils/schedulerOptionsMerge.ts` - `mergeStudyReviewCycle` 함수 추가
   - `lib/validation/planValidator.ts` - `validateNonStudyTimeBlocks` 메서드 추가
   - `lib/plan/blocks.ts` - `getTemplateBlockSetId` 함수 추가
   - `app/(student)/actions/plan-groups/create.ts` - 공통 함수 사용
   - `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts` - 공통 함수 사용
   - `lib/utils/planGroupTransform.ts` - 공통 함수 사용
   - `app/(admin)/actions/campTemplateActions.ts` - 공통 함수 사용

### 코드 변경 통계

- **수정 파일**: 7개
- **추가된 라인**: 약 200줄
- **제거된 라인**: 약 150줄 (중복 코드 제거)

---

## 🧪 테스트 체크리스트

- [ ] `usePlanPayloadBuilder`에서 `time_settings` 병합 시 보호 필드가 보호되는지 확인
- [ ] `study_review_cycle` 병합이 모든 위치에서 동일하게 동작하는지 확인
- [ ] `non_study_time_blocks` 검증이 올바르게 동작하는지 확인 (시간 형식, 범위, 중복)
- [ ] `block_set_id` 조회가 모든 위치에서 동일한 로직으로 동작하는지 확인
- [ ] 기존 기능이 정상 동작하는지 확인

---

## 📝 다음 단계

### Phase 3: Medium 개선 (예정)

1. 타입 안전성 개선 (`as any` 제거)
2. 에러 처리 강화
3. 로깅 개선
4. 단위 테스트 추가

---

## 🔗 관련 문서

- [플랜 그룹 생성 시 시간 블록 기능 점검 결과](./plan-group-time-block-analysis-2025-02-01.md)
- [플랜 그룹 생성 시 시간 블록 기능 개선 TODO](./plan-group-time-block-improvement-todo.md)
- [플랜 그룹 시간 블록 기능 개선 Phase 1 완료 보고](./plan-group-time-block-improvement-phase1-completion-2025-02-01.md)

---

**작성자**: AI Assistant  
**작성 일자**: 2025-02-01

