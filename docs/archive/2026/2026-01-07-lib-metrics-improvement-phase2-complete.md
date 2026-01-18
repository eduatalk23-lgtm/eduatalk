# lib/metrics 모듈 개선 - Phase 2 완료

**작성일**: 2026-01-07  
**작업 범위**: `lib/metrics` 모듈 개선 계획의 Phase 2 (주요 함수 마이그레이션)

---

## 📋 작업 개요

`lib/metrics` 모듈의 주요 함수들을 Result 타입과 옵션 객체 패턴으로 마이그레이션했습니다.

### 완료된 함수 마이그레이션 ✅

1. **`getPlanCompletion`** ✅
   - 옵션 객체 패턴 적용
   - Result 타입 적용
   - 호출부 업데이트 (3곳)

2. **`getHistoryPattern`** ✅
   - 옵션 객체 패턴 적용
   - Result 타입 적용
   - 호출부 업데이트 (2곳)

3. **`getWeakSubjects`** ✅
   - 옵션 객체 패턴 적용
   - Result 타입 적용
   - 호출부 업데이트 (5곳)

4. **`getScoreTrend`** ✅
   - 옵션 객체 패턴 적용
   - Result 타입 적용
   - 호출부 업데이트 (3곳)

5. **`getGoalStatus`** ✅
   - 옵션 객체 패턴 적용
   - Result 타입 적용
   - 호출부 업데이트 (2곳)

6. **`getStudyTime`** ✅
   - 옵션 객체 패턴 적용
   - Result 타입 적용
   - 호출부 업데이트 (3곳)

### 남은 함수

- **`todayProgress`** (calculateTodayProgress)
  - 다른 패턴: supabase를 파라미터로 받지 않음
  - 내부에서 createSupabaseServerClient 호출
  - 별도 리팩토링 필요

- **`streak`** (calculateStreak)
  - 다른 패턴: supabase를 파라미터로 받지 않음
  - 내부에서 세션 조회만 수행
  - 별도 리팩토링 필요

---

## 🔄 변경 사항 요약

### 공통 변경 패턴

1. **함수 시그니처 변경**
   ```typescript
   // Before
   export async function getPlanCompletion(
     supabase: SupabaseServerClient,
     studentId: string,
     weekStart: Date,
     weekEnd: Date
   ): Promise<PlanCompletionMetrics>

   // After
   export async function getPlanCompletion(
     supabase: SupabaseServerClient,
     options: WeeklyMetricsOptions
   ): Promise<MetricsResult<PlanCompletionMetrics>>
   ```

2. **에러 처리 개선**
   ```typescript
   // Before
   try {
     // ...
     return { totalPlans, completedPlans, completionRate };
   } catch (error) {
     console.error("[metrics/getPlanCompletion] 플랜 실행률 조회 실패", error);
     return { totalPlans: 0, completedPlans: 0, completionRate: 0 };
   }

   // After
   try {
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
   ```

3. **호출부 업데이트**
   ```typescript
   // Before
   const planCompletion = await getPlanCompletion(supabase, studentId, weekStart, weekEnd);
   const completionRate = planCompletion.completionRate;

   // After
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
- 호출부에서 에러 상황을 명확히 인지 가능

### 2. 코드 중복 제거
- 날짜 변환 로직 통일 (`toDateString`, `normalizeDateString`)
- 에러 처리 패턴 통일 (`handleMetricsError`)

### 3. 함수 시그니처 표준화
- 옵션 객체 패턴으로 파라미터 확장성 향상
- 일관된 함수 시그니처

### 4. 에러 정보 보존
- 기존: 에러 발생 시 빈 값 반환으로 원인 파악 어려움
- 개선: 에러 메시지, 코드, 상세 정보 포함

---

## 📝 업데이트된 파일 목록

### 마이그레이션된 함수 파일
- `lib/metrics/getPlanCompletion.ts`
- `lib/metrics/getHistoryPattern.ts`
- `lib/metrics/getWeakSubjects.ts`
- `lib/metrics/getScoreTrend.ts`
- `lib/metrics/getGoalStatus.ts`
- `lib/metrics/getStudyTime.ts`

### 호출부 업데이트
- `lib/coaching/getWeeklyMetrics.ts`
- `lib/risk/engine.ts`
- `lib/recommendations/studyPlanRecommendation.ts`
- `lib/recommendations/planRegenerationSuggestion.ts`
- `lib/recommendations/subjectRecommendation.ts`
- `lib/recommendations/masterContentRecommendation.ts`

---

## 🚧 다음 단계

### Phase 2 (남은 작업)
- [ ] `todayProgress` 리팩토링 (supabase 파라미터 추가)
- [ ] `streak` 리팩토링 (supabase 파라미터 추가)

### Phase 3
- [ ] 모든 함수 시그니처 표준화 완료 확인

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
- [Phase 1-2 완료 문서](docs/2026-01-07-lib-metrics-improvement-phase1-2.md)

---

**작업 완료 시간**: 약 4시간  
**마이그레이션된 함수**: 6개  
**업데이트된 호출부**: 18곳

