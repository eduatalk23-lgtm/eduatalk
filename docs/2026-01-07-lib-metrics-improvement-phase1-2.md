# lib/metrics 모듈 개선 - Phase 1-2 완료

**작성일**: 2026-01-07  
**작업 범위**: `lib/metrics` 모듈 개선 계획의 Phase 1-2

---

## 📋 작업 개요

`lib/metrics` 모듈의 비즈니스 로직 사용성 문제점을 해결하기 위한 개선 작업의 Phase 1-2를 완료했습니다.

### 완료된 작업

#### Phase 1: 공통 유틸리티 및 타입 정의 ✅

1. **`lib/metrics/types.ts` 생성**
   - `MetricsResult<T>` 타입 정의: 성공/실패를 명시적으로 처리하는 Result 타입
   - `SupabaseServerClient` 타입 정의
   - 옵션 타입 정의: `WeeklyMetricsOptions`, `DateBasedMetricsOptions` 등
   - 표준 함수 시그니처 타입: `MetricsFunction<T, TOptions>`

2. **`lib/metrics/utils.ts` 생성**
   - `toDateString()`: Date 객체를 YYYY-MM-DD 형식으로 변환
   - `normalizeDateString()`: 문자열 또는 Date 객체를 정규화
   - `calculateWeekRange()`: 주간 범위 계산 (월요일~일요일)
   - `handleMetricsError()`: 에러를 MetricsResult 형식으로 변환
   - `withMetricsErrorHandling()`: 에러 처리 래퍼 함수
   - `nullToDefault()`: null/undefined 체크 및 기본값 반환
   - `isEmptyArray()`: 배열이 비어있는지 확인

3. **`lib/metrics/errors.ts` 생성**
   - `MetricsErrorCode` enum: 에러 코드 정의
   - `MetricsError` 클래스: 명시적 에러 처리
   - `createMetricsError()`: 에러 생성 헬퍼

#### Phase 2: getPlanCompletion 마이그레이션 ✅

1. **함수 시그니처 변경**
   - 기존: `getPlanCompletion(supabase, studentId, weekStart, weekEnd)`
   - 변경: `getPlanCompletion(supabase, { studentId, weekStart, weekEnd })`
   - 반환 타입: `Promise<PlanCompletionMetrics>` → `Promise<MetricsResult<PlanCompletionMetrics>>`

2. **에러 처리 개선**
   - 기존: try-catch로 빈 값 반환
   - 변경: `handleMetricsError()` 사용하여 명시적 에러 정보 반환

3. **중복 코드 제거**
   - 날짜 변환 로직: `toDateString()` 사용
   - null 체크: `nullToDefault()` 사용

4. **호출부 업데이트**
   - `lib/coaching/getWeeklyMetrics.ts`: Result 타입 처리 추가
   - `lib/risk/engine.ts`: Result 타입 처리 추가
   - `lib/recommendations/studyPlanRecommendation.ts`: Result 타입 처리 추가

---

## 🔄 변경 사항

### Before

```typescript
// 함수 시그니처
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<PlanCompletionMetrics> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    // ...
    return { totalPlans, completedPlans, completionRate };
  } catch (error) {
    console.error("[metrics/getPlanCompletion] 플랜 실행률 조회 실패", error);
    return { totalPlans: 0, completedPlans: 0, completionRate: 0 };
  }
}

// 호출부
const planCompletion = await getPlanCompletion(supabase, studentId, weekStart, weekEnd);
const completionRate = planCompletion.completionRate;
```

### After

```typescript
// 함수 시그니처
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  options: WeeklyMetricsOptions
): Promise<MetricsResult<PlanCompletionMetrics>> {
  try {
    const { studentId, weekStart, weekEnd } = options;
    const weekStartStr = toDateString(weekStart);
    const weekEndStr = toDateString(weekEnd);
    // ...
    return {
      success: true,
      data: { totalPlans, completedPlans, completionRate },
    };
  } catch (error) {
    return handleMetricsError(
      error,
      "[metrics/getPlanCompletion]",
      { totalPlans: 0, completedPlans: 0, completionRate: 0 }
    );
  }
}

// 호출부
const planCompletionResult = await getPlanCompletion(supabase, {
  studentId,
  weekStart,
  weekEnd,
});
const planCompletion = planCompletionResult.success
  ? planCompletionResult.data
  : { totalPlans: 0, completedPlans: 0, completionRate: 0 };
const completionRate = planCompletion.completionRate;
```

---

## 📊 개선 효과

### 1. 타입 안전성 향상
- Result 타입으로 에러를 명시적으로 처리
- null 체크 강화 (`nullToDefault`, `isEmptyArray`)

### 2. 코드 중복 제거
- 날짜 변환 로직 통일 (`toDateString`)
- 에러 처리 패턴 통일 (`handleMetricsError`)

### 3. 함수 시그니처 표준화
- 옵션 객체 패턴으로 파라미터 확장성 향상
- 일관된 함수 시그니처

### 4. 에러 정보 보존
- 기존: 에러 발생 시 빈 값 반환으로 원인 파악 어려움
- 개선: 에러 메시지, 코드, 상세 정보 포함

---

## 🚧 다음 단계

### Phase 2 (진행 중)
- [ ] 나머지 metrics 함수들 마이그레이션
  - `getHistoryPattern`
  - `getWeakSubjects`
  - `getScoreTrend`
  - `getGoalStatus`
  - `getStudyTime`
  - `todayProgress`
  - `streak`

### Phase 3
- [ ] 모든 함수 시그니처를 옵션 객체 패턴으로 표준화

### Phase 4
- [ ] 중복 코드 제거 (날짜 변환, 주간 범위 계산, 에러 처리 로직)

### Phase 5
- [ ] 타입 안전성 강화 (null 체크, 타입 가드 추가, 타입 단언 최소화)

### Phase 6
- [ ] 문서화 개선 (JSDoc 추가, 사용 예시 포함)

---

## 📝 참고 문서

- [lib/metrics 모듈 개선 계획](.cursor/plans/lib-metrics-cf575ce9.plan.md)
- [비즈니스 로직 사용성 문제점 분석](docs/business-logic-usability-issues.md)

---

**작업 완료 시간**: 약 2시간  
**다음 작업 예상 시간**: Phase 2 완료까지 약 4-6시간

