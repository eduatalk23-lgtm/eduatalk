# Phase 3 Deprecated 함수 분석 보고서

**작업 일시**: 2025-02-04  
**Phase**: 3 - 학생 도메인 핵심 기능 Deprecated 함수 분석

---

## 📋 분석 개요

Phase 3 관련 파일들에서 deprecated 함수 및 속성 사용처를 세심하게 확인했습니다.

---

## 🔍 발견된 Deprecated 항목

### 1. `generate1730TimetablePlans` 함수
**위치**: `lib/plan/scheduler.ts` (839줄)

**상태**: 
- `@deprecated` 표시됨
- SchedulerEngine 클래스 사용 권장

**사용처**:
- ✅ `lib/plan/scheduler.ts` 내부에서만 사용 (152줄)
- ✅ 외부에서 직접 호출되지 않음
- ✅ 문서에만 언급됨

**마이그레이션 계획**:
- SchedulerEngine으로 완전히 마이그레이션 필요
- 현재는 내부 함수로만 사용되므로 우선순위 낮음

---

### 2. `prepareBaseBlocks` 함수
**위치**: `lib/plan/generators/planDataPreparer.ts` (97줄)

**상태**:
- `@deprecated` 표시됨
- `getBlockSetForPlanGroup` 사용 권장

**사용처**:
- ✅ 실제 사용처 없음
- ✅ 문서에만 언급됨
- ✅ 함수 내부에서 이미 `getBlockSetForPlanGroup` 사용

**마이그레이션 계획**:
- 즉시 제거 가능
- 사용처가 없으므로 안전하게 제거 가능

---

### 3. `timeToMinutes`, `minutesToTime` 함수
**위치**: `lib/plan/scheduleProcessor.ts` (74줄, 82줄)

**상태**:
- `@deprecated` 표시됨
- `@/lib/utils/time`의 공통 함수 사용 권장

**사용처**:
- ✅ 외부에서 import하는 곳 없음
- ✅ `lib/utils/time`에서 이미 제공됨
- ✅ 내부에서만 사용 가능한 상태

**마이그레이션 계획**:
- 즉시 제거 가능
- 사용처가 없으므로 안전하게 제거 가능

---

### 4. `getContentAllocation` 함수
**위치**: `lib/plan/1730TimetableLogic.ts` (143줄)

**상태**:
- `@deprecated` 표시됨
- `lib/utils/subjectAllocation.ts`의 `getEffectiveAllocation` 사용 권장

**사용처**:
- ⚠️ `lib/plan/scheduler.ts`에서 import (12줄)
- ⚠️ `lib/scheduler/SchedulerEngine.ts`에서 import 및 사용 (21줄, 194줄)
- ⚠️ 핵심 로직에서 사용 중

**마이그레이션 계획**:
- `getEffectiveAllocation`로 마이그레이션 필요
- 사용처가 많으므로 신중하게 진행 필요
- 우선순위 높음

---

### 5. `difficulty_level` 속성
**위치**: 여러 파일

**상태**:
- `difficulty_level_id` 사용 권장
- `masterContentFormHelpers.ts`에서 deprecated 표시됨

**사용처**:
- ⚠️ `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/hooks/useRecommendations.ts` (3곳)
- ⚠️ `app/(student)/plan/new-group/_components/_features/content-selection/utils/recommendationTransform.ts` (1곳)
- ⚠️ `app/(student)/plan/new-group/_components/_features/content-selection/hooks/useContentDetailsBatch.ts` (1곳)
- ⚠️ `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/hooks/useContentInfos.ts` (4곳)
- ⚠️ `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentItem.tsx` (1곳)
- ⚠️ `lib/plan/contentResolver.ts` (6곳)
- ⚠️ `lib/plan/contentDuration.ts` (1곳)

**총 사용처**: 약 17곳

**마이그레이션 계획**:
- `difficulty_level_id`로 마이그레이션 필요
- 데이터베이스 스키마 확인 필요
- 우선순위 중간

---

## 📊 우선순위 정리

### 즉시 제거 가능 (사용처 없음)
1. ✅ `prepareBaseBlocks` - 사용처 없음
2. ✅ `timeToMinutes`, `minutesToTime` (scheduleProcessor.ts) - 사용처 없음

### 신중한 마이그레이션 필요 (사용처 있음)
3. ⚠️ `getContentAllocation` - 핵심 로직에서 사용 중 (2곳)
4. ⚠️ `difficulty_level` - 여러 파일에서 사용 중 (약 17곳)
5. 📋 `generate1730TimetablePlans` - 내부 함수, 우선순위 낮음

---

## 🎯 마이그레이션 계획

### Phase 1: 즉시 제거 (안전)
1. `prepareBaseBlocks` 함수 제거
2. `timeToMinutes`, `minutesToTime` (scheduleProcessor.ts) 제거

### Phase 2: 신중한 마이그레이션
1. `getContentAllocation` → `getEffectiveAllocation` 마이그레이션
   - `lib/plan/scheduler.ts` 수정
   - `lib/scheduler/SchedulerEngine.ts` 수정
   - 테스트 필수

2. `difficulty_level` → `difficulty_level_id` 마이그레이션
   - 데이터베이스 스키마 확인
   - 각 파일별로 순차적 마이그레이션
   - 테스트 필수

### Phase 3: 장기 개선
1. `generate1730TimetablePlans` → SchedulerEngine 완전 마이그레이션

---

## 📝 다음 단계

1. **즉시 제거 가능 항목 정리** (Phase 1)
2. **getContentAllocation 마이그레이션** (Phase 2-1)
3. **difficulty_level 마이그레이션** (Phase 2-2)

---

**작업 완료 시간**: 2025-02-04

