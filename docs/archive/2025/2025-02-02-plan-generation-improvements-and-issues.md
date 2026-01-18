# 플랜 생성 시스템 개선점 및 문제점 분석

> 작성일: 2025-02-02  
> 목적: 플랜 생성 시스템의 개선점, 기능 확장 가능성, 알려진 문제점을 체계적으로 분석하고 문서화  
> 상태: 완료

---

## 📋 목차

1. [개요](#개요)
2. [알려진 문제점](#알려진-문제점)
3. [성능 병목 지점](#성능-병목-지점)
4. [구조적 개선 사항](#구조적-개선-사항)
5. [기능 확장 가능성](#기능-확장-가능성)
6. [미구현 기능](#미구현-기능)
7. [우선순위별 개선 로드맵](#우선순위별-개선-로드맵)

---

## 개요

### 분석 범위

이 문서는 플랜 생성 시스템의 다음 영역을 분석합니다:

1. **알려진 버그 및 문제점**: 현재 발생 중이거나 과거에 발생한 문제
2. **성능 병목**: 느린 작업 및 최적화 필요 영역
3. **구조적 문제**: 코드 품질, 아키텍처 개선 필요 사항
4. **기능 확장**: 추가 가능한 기능 및 개선 사항
5. **미구현 기능**: 계획되었으나 아직 구현되지 않은 기능

### 심각도 분류

| 심각도 | 설명 | 예시 |
|--------|------|------|
| **🔴 CRITICAL** | 즉시 수정 필요, 시스템 안정성에 영향 | 데이터 손실, 트랜잭션 실패 |
| **🟠 HIGH** | 빠른 시일 내 수정 권장, 사용자 경험에 큰 영향 | 성능 저하, UI 버그 |
| **🟡 MEDIUM** | 중기 개선 권장, 점진적 개선 가능 | 코드 중복, 구조적 문제 |
| **🟢 LOW** | 장기 개선, 우선순위 낮음 | 코드 스타일, 문서화 |

---

## 알려진 문제점

### 1. AI 플랜 생성 시 제외 날짜 미지원 ✅ (해결됨)

**위치**: `lib/domains/plan/llm/actions/generatePlan.ts`

**해결 상태**: ✅ 완료 (2026-01-05)

**해결 내용**:
1. `GeneratePlanInput` 타입에 `excludeDates?: string[]` 필드 추가
2. 플랜 그룹이 있으면 `getPlanExclusions()`로 제외일 자동 조회
3. `validatePlans()` 호출 시 `excludeDates` 전달
4. Preview 함수에도 동일하게 적용

**구현 코드**:
```typescript
// 제외 날짜 조회 (입력값 우선, 없으면 플랜 그룹에서 조회)
let excludeDates: string[] = [];
if (input.excludeDates && input.excludeDates.length > 0) {
  excludeDates = input.excludeDates;
} else if (input.planGroupId) {
  const exclusions = await getPlanExclusions(input.planGroupId, tenantId);
  excludeDates = exclusions.map((e) => e.exclusion_date);
}

const validationResult = validatePlans({
  plans: allPlans,
  academySchedules,
  blockSets,
  excludeDays: input.excludeDays,
  excludeDates, // 제외 날짜 전달
  dailyStudyMinutes: input.dailyStudyMinutes,
});
```

---

### 2. PlanGenerationOrchestrator 미완성 구현 🟡 MEDIUM

**위치**: `lib/plan/services/PlanGenerationOrchestrator.ts`

**문제**:
```typescript
/**
 * NOTE: 이 오케스트레이터는 Phase 2의 서비스 레이어 기본 구조를 보여줍니다.
 * 실제 프로덕션에서는 기존 generatePlansRefactored 함수를 사용하세요.
 */
```

**영향**:
- 새로운 서비스 레이어 구조가 완전히 구현되지 않음
- 기존 `generatePlansRefactored` 함수에 의존
- 리팩토링 목표 달성 지연

**현재 상태**:
- Phase 2: 기본 구조만 제공 (스텁 구현)
- Phase 3: 기존 함수와 통합 예정 (미완료)

**해결 방안**:
1. Phase 3 완료: 기존 `generatePlansRefactored` 로직을 서비스 레이어로 마이그레이션
2. 단계적 통합: 핵심 기능부터 순차적으로 이전

**예상 작업량**: 5-7일

---

### 3. 재조정 기능 미완성 🟠 HIGH

**위치**: `app/(student)/actions/plan-groups/reschedule.ts:388-544`

**문제**:
```typescript
// TODO: 실제 플랜 생성 및 저장 로직 구현 필요
// _rescheduleContents 함수에서 실제 플랜 생성 로직이 TODO로 남아있음
```

**영향**:
- 재조정 미리보기는 작동하지만 실제 실행이 불가능
- 사용자가 재조정을 확인해도 적용할 수 없음

**현재 상태**:
- ✅ 재조정 미리보기: 완료
- ✅ 재조정 Wizard UI: 완료
- ✅ 조정 엔진: 완료
- ❌ 재조정 실행: 미구현

**해결 방안**:
```typescript
async function _rescheduleContents(
  groupId: string,
  selectedContentIds: string[],
  dateRange: { from: string; to: string } | null,
  adjustments: Adjustment[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  // 1. 기존 플랜 히스토리 백업
  await backupPlanHistory(groupId, dateRange);
  
  // 2. 기존 플랜 비활성화
  await deactivatePlans(groupId, dateRange);
  
  // 3. 새 플랜 생성
  const newPlans = await generatePlansFromGroup(
    groupId,
    adjustedContents,
    adjustedPeriod
  );
  
  // 4. 새 플랜 저장
  await savePlans(newPlans);
  
  // 5. 재조정 로그 저장
  await saveRescheduleLog(groupId, adjustments);
  
  return { success: true, count: newPlans.length };
}
```

**예상 작업량**: 3-5일

---

### 4. 논리 플랜 기능 미구현 🟡 MEDIUM

**위치**: `docs/refactoring/logical_plan_reschedule_integration_todo.md`

**문제**:
- 논리 플랜 인프라는 존재하나 (30% 완료) 핵심 기능 미구현
- 날짜 범위 선택 재생성 기능 없음

**현재 상태**:
- ✅ 논리 플랜 CRUD: 완료
- ✅ 논리 플랜 UI: 완료
- ❌ 날짜 범위 선택: 미구현
- ❌ 선택적 재생성: 미구현
- ❌ 완료 플랜 보호: 미구현

**해결 방안**:
1. 재조정 기능과 통합하여 단일 기능으로 제공
2. 날짜 범위 선택 UI 추가
3. 선택한 날짜 범위만 `student_plan` 재생성

**예상 작업량**: 5-7일

---

### 5. RLS 권한 문제 (해결됨) ✅

**위치**: `docs/plan-insert-rls-fix.md`

**문제** (해결됨):
- Admin/Consultant가 다른 학생의 플랜 생성 시 RLS 정책 위반
- "Referenced book does not exist" 에러 발생

**해결 상태**: ✅ 완료
- Admin/Consultant가 다른 학생의 플랜 생성 시 Admin 클라이언트 사용

---

## 성능 병목 지점

### 1. 콘텐츠 Duration 조회 반복 호출 🔴 HIGH

**위치**: `lib/plan/1730TimetableLogic.ts` (과거), `lib/plan/scheduler.ts`

**문제** (부분 해결됨):
- Episode별로 `calculateContentDuration` 반복 호출
- 24개 episode × 15개 플랜 = 최소 360회 호출

**해결 상태**: ✅ 부분 해결
- Episode Map 캐싱 추가 (라인 1010-1038)
- Duration 5분 TTL 캐싱 추가 (라인 50-128)

**추가 개선 필요**:
- 배치 조회로 최적화 가능
- 캐시 히트율 모니터링 필요

---

### 2. 플랜 생성 요청 응답 시간 🟠 HIGH

**문제**:
- POST `/plan/new-group` 요청이 1.6초~3.2초 소요
- 사용자 대기 시간 증가

**원인 분석**:
1. **콘텐츠 ID 해석**: 순차 처리 (부분 해결됨)
2. **마스터 콘텐츠 복사**: 순차 처리
3. **플랜 생성 알고리즘**: 복잡한 계산

**해결 상태**: ✅ 부분 해결
- 콘텐츠 ID 해석 병렬화 (`Promise.all`)

**추가 개선 필요**:
```typescript
// 마스터 콘텐츠 복사도 병렬화
const copyPromises = contents.map(content =>
  copyMasterContent(content, studentId)
);
const copiedContents = await Promise.all(copyPromises);
```

**예상 개선 효과**: 30-40% 응답 시간 단축

---

### 3. DB 쿼리 성능 ✅ (부분 해결됨)

**위치**: `lib/data/planGroups.ts`, `lib/plan/shared/ContentResolutionService.ts`

**해결 상태**: ✅ 부분 해결 (2026-01-05)

**해결 내용**:
1. **인덱스**: 기존 인덱스가 이미 충분히 최적화되어 있음 확인
2. **메모리 캐싱**: `lib/cache/memoryCache.ts` 추가
3. **콘텐츠 메타데이터 캐싱**: `lib/plan/contentResolver.ts`에 캐싱 적용

**구현 코드**:
```typescript
// lib/cache/memoryCache.ts
export class MemoryCache<T> {
  // LRU 기반 TTL 지원 메모리 캐시
  constructor(maxSize = 1000, defaultTtlMs = 5 * 60 * 1000) { ... }
}

// 전역 캐시 인스턴스
export const contentMetadataCache = new MemoryCache<unknown>(500, 5 * 60 * 1000);
export const contentDurationCache = new MemoryCache<number>(500, 5 * 60 * 1000);
export const studySessionCache = new MemoryCache<unknown>(200, 1 * 60 * 1000);
export const progressCache = new MemoryCache<unknown>(500, 5 * 60 * 1000);
```

**적용 위치**:
- `loadBookMetadata()` - 5분 TTL
- `loadLectureMetadata()` - 5분 TTL
- `loadCustomContentMetadata()` - 5분 TTL

**남은 작업**:
- 캐시 히트율 모니터링 추가 (선택사항)

---

### 4. 메모리 연산 최적화 🟢 LOW

**위치**: `lib/data/planGroups.ts` - `enrich` 함수

**문제**:
- `attachToPlans()`에서 destructuring, spread 연산 반복
- 플랜 50개 기준 ~130ms 소요

**해결 상태**: ✅ 부분 해결
- 최적화 적용 후 0.124ms로 개선

**추가 개선 여지**: 없음 (이미 최적화됨)

---

## 구조적 개선 사항

### 1. God Function 문제 🔴 CRITICAL

**위치**: `lib/plan/services/generatePlansRefactored.ts` (과거)

**문제**:
- 1,547줄의 거대한 함수
- 16+ 책임을 가진 God Function
- 테스트 및 유지보수 어려움

**해결 상태**: ✅ 부분 해결
- 서비스 레이어로 분리 시작 (Phase 2)
- `PlanGenerationOrchestrator` 구조 제공

**추가 개선 필요**:
- Phase 3 완료: 기존 로직을 서비스 레이어로 완전 이전
- 단계적 리팩토링 계속 진행

---

### 2. generate/preview 중복 코드 ✅ (대부분 해결됨)

**위치**:
- `lib/plan/services/generatePlansWithServices.ts`
- `lib/plan/services/previewPlansWithServices.ts`

**해결 상태**: ✅ 대부분 완료 (2026-01-05)

**해결 내용**:
1. Phase 5: 공통 로직 70%가 `preparePlanGenerationData`로 추출됨
2. `PlanNumberCalculator` 유틸리티로 plan_number 계산 로직 통합
3. 실제 중복률이 90% → 15%로 감소

**구현 코드**:
```typescript
// lib/plan/services/planNumbering.ts
export class PlanNumberCalculator {
  getPlanNumber(date, contentId, startRange, endRange): number {
    const key = this.createPlanKey(date, contentId, startRange, endRange);
    return this.getOrAssignNumber(key);
  }
}

// 사용 예시 (generate/preview 공통)
const planNumberCalc = createPlanNumberCalculator();
const planNumber = planNumberCalc.getPlanNumber(date, resolvedContentId, start, end);
```

**남은 작업**:
- 추가 중복 코드가 있으면 점진적으로 리팩토링

---

### 3. 콘텐츠 해석 로직 분산 🟡 MEDIUM

**위치**: 
- `lib/plan/shared/ContentResolutionService.ts`
- `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`
- `lib/plan/services/preparePlanGenerationData.ts`

**문제**:
- 콘텐츠 해석 로직이 3곳에 분산
- 다중 진실의 원천 (Single Source of Truth 위반)

**해결 방안**:
- `ContentResolutionService`를 단일 진실의 원천으로 사용
- 다른 곳에서는 이 서비스만 호출하도록 통일

**예상 작업량**: 1-2일

---

### 4. 복잡한 Fallback 체인 🟡 MEDIUM

**위치**: `lib/plan/shared/ContentResolutionService.ts`

**문제**:
- 여러 단계의 fallback 로직
- 디버깅 어려움

**현재 구조**:
```typescript
// 1. 학생 콘텐츠 조회
// 2. 없으면 마스터 콘텐츠 복사
// 3. 없으면 마스터 콘텐츠 직접 사용
// 4. 없으면 에러
```

**개선 방안**:
- 각 단계를 명확한 함수로 분리
- 에러 메시지 개선
- 로깅 강화

---

## 기능 확장 가능성

### 1. 적응형 스케줄링 🟢 LOW

**목표**: 학습 진행 상황에 따른 자동 조정

**구현 가능성**: ✅ 높음

**필요 기능**:
1. 진행률 모니터링
2. 자동 재조정
3. 예측 기반 최적화

**기존 인프라**:
- `lib/domains/plan/services/adaptiveScheduler.ts`: 기본 구조 존재
- `lib/domains/plan/services/delayPredictionService.ts`: 지연 예측 서비스
- `lib/domains/plan/services/fatigueModelingService.ts`: 피로도 모델링

**예상 작업량**: 10-15일

---

### 2. 지능형 스케줄링 🟢 LOW

**목표**: 학습 데이터 기반 동적 스케줄링

**구현 가능성**: ✅ 중간

**필요 기능**:
1. 학습 속도 예측 모델
2. 난이도 매칭 시스템
3. 피로도 관리

**기존 인프라**:
- `lib/domains/plan/services/learningPacePredictor.ts`: 학습 속도 예측
- `lib/domains/plan/services/dynamicDifficultyService.ts`: 난이도 조정
- `lib/domains/plan/services/fatigueModelingService.ts`: 피로도 모델링

**예상 작업량**: 15-20일

---

### 3. 실시간 피드백 반영 🟢 LOW

**목표**: 학습 완료 시 피드백을 즉시 반영

**구현 가능성**: ✅ 높음

**필요 기능**:
1. 피드백 수집 시스템
2. 가중치 동적 업데이트
3. 실시간 추천 생성

**예상 작업량**: 5-7일

---

### 4. 머신러닝 기반 추천 🟢 LOW

**목표**: 학습 데이터 기반 개인화된 추천

**구현 가능성**: ⚠️ 낮음 (인프라 필요)

**필요 기능**:
1. 협업 필터링
2. 콘텐츠 기반 필터링
3. 하이브리드 추천

**예상 작업량**: 20-30일

---

## 미구현 기능

### 1. 캐시 구현 미완성 🟡 MEDIUM

**위치**: 
- `lib/domains/plan/llm/actions/optimizePlan.ts:588`
- `lib/domains/plan/llm/actions/recommendContent.ts:482`

**문제**:
```typescript
// TODO: 캐시 구현 (1일 캐싱)
```

**영향**:
- LLM 호출 비용 증가
- 응답 시간 지연

**해결 방안**:
```typescript
const cacheKey = `plan-optimization:${studentId}:${planGroupId}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

const result = await analyzePlanEfficiency(...);
await redis.setex(cacheKey, 86400, JSON.stringify(result)); // 1일 캐싱
return result;
```

**예상 작업량**: 1-2일

---

### 2. 지연일 추적 미구현 🟢 LOW

**위치**: `lib/domains/plan/services/delayPredictionService.ts:326`

**문제**:
```typescript
averageDelayDays: 0, // TODO: 실제 지연일 추적 필요
```

**영향**:
- 지연 예측 정확도 저하
- 적응형 스케줄링 기능 제한

**해결 방안**:
- 플랜 완료 시 실제 소요 시간 기록
- 지연일 통계 계산 및 저장

**예상 작업량**: 2-3일

---

### 3. 논리 플랜 날짜 범위 선택 🟡 MEDIUM

**위치**: `docs/refactoring/logical_plan_reschedule_integration_todo.md`

**문제**:
- 논리 플랜의 핵심 기능인 날짜 범위 선택 재생성 미구현

**해결 방안**:
- 재조정 기능과 통합
- 날짜 범위 선택 UI 추가

**예상 작업량**: 5-7일

---

## 우선순위별 개선 로드맵

### Phase 1: 즉시 수정 (1-2주)

**목표**: 사용자 경험에 직접적인 영향을 주는 문제 해결

#### P0: 긴급 수정

1. **AI 플랜 생성 시 제외 날짜 지원** 🔴 HIGH
   - 예상 작업량: 0.5일
   - 영향: 사용자 불만 해소

2. **재조정 기능 완성** 🟠 HIGH
   - 예상 작업량: 3-5일
   - 영향: 핵심 기능 완성

#### P1: 빠른 개선

3. **DB 쿼리 성능 최적화** 🟠 HIGH
   - 예상 작업량: 2-3일
   - 영향: 응답 시간 30-40% 개선

4. **generate/preview 중복 코드 제거** 🟠 HIGH
   - 예상 작업량: 2-3일
   - 영향: 유지보수성 향상

---

### Phase 2: 중기 개선 (1-2개월)

**목표**: 구조적 개선 및 기능 확장

1. **PlanGenerationOrchestrator 완성** 🟡 MEDIUM
   - 예상 작업량: 5-7일
   - 영향: 아키텍처 개선

2. **논리 플랜 기능 완성** 🟡 MEDIUM
   - 예상 작업량: 5-7일
   - 영향: 기능 완성도 향상

3. **캐시 구현** 🟡 MEDIUM
   - 예상 작업량: 1-2일
   - 영향: 비용 절감, 성능 향상

4. **콘텐츠 해석 로직 통합** 🟡 MEDIUM
   - 예상 작업량: 1-2일
   - 영향: 코드 품질 향상

---

### Phase 3: 장기 개선 (3-6개월)

**목표**: 고급 기능 및 AI/ML 통합

1. **적응형 스케줄링** 🟢 LOW
   - 예상 작업량: 10-15일
   - 영향: 사용자 경험 향상

2. **지능형 스케줄링** 🟢 LOW
   - 예상 작업량: 15-20일
   - 영향: 학습 효율 향상

3. **실시간 피드백 반영** 🟢 LOW
   - 예상 작업량: 5-7일
   - 영향: 개인화 강화

4. **지연일 추적** 🟢 LOW
   - 예상 작업량: 2-3일
   - 영향: 예측 정확도 향상

---

## 결론

### 주요 발견 사항

1. **긴급 수정 필요**: AI 플랜 생성 제외 날짜, 재조정 기능 완성
2. **성능 개선 여지**: DB 쿼리 최적화, 병렬 처리 강화
3. **구조적 개선**: God Function 분해, 중복 코드 제거
4. **기능 확장**: 적응형/지능형 스케줄링, 실시간 피드백

### 권장 사항

1. **즉시 적용**: Phase 1 P0 항목 우선 처리
2. **단계적 개선**: Phase 2, Phase 3 순차 진행
3. **지속적 모니터링**: 성능 메트릭 추적 및 개선

### 다음 단계

1. Phase 1 작업 시작 (긴급 수정 항목)
2. 성능 벤치마크 설정
3. 사용자 피드백 수집 시스템 구축

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰  
**업데이트 주기**: 분기별 또는 주요 변경 시


