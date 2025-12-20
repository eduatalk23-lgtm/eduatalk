# Phase 4: Frontend/Dashboard UI 연동 및 최적화 로드맵

**작성일**: 2025-02-05  
**상태**: 📋 계획 단계

---

## 📋 개요

Phase 3-3에서 완료된 Metrics & Goals 모듈 리팩토링의 성과를 Frontend 컴포넌트에 반영하고, 성능 개선 효과를 최대화하기 위한 작업 계획입니다.

---

## 🔍 현재 상태 분석

### 1. 리팩토링된 함수들의 시그니처

#### `getWeakSubjects`
```typescript
// lib/metrics/getWeakSubjects.ts
export async function getWeakSubjects(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeakSubjectMetrics>

// 반환 타입
type WeakSubjectMetrics = {
  weakSubjects: string[]; // 취약 과목 목록
  subjectStudyTime: Map<string, number>; // 과목별 학습시간 (분)
  totalStudyTime: number; // 전체 학습시간 (분)
  weakSubjectStudyTimeRatio: number; // 취약 과목 학습시간 비율 (0-100)
};
```

#### `getGoalStatus`
```typescript
// lib/metrics/getGoalStatus.ts
export async function getGoalStatus(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string
): Promise<GoalStatusMetrics>

// 반환 타입
type GoalStatusMetrics = {
  totalActiveGoals: number;
  goalsNearDeadline: number; // D-7 이내 목표 수
  goalsVeryNearDeadline: number; // D-3 이내 목표 수
  averageProgress: number; // 평균 진행률 (0-100)
  lowProgressGoals: number; // 진행률 30% 미만 목표 수
  veryLowProgressGoals: number; // 진행률 50% 미만 목표 수
  goals: Array<{
    id: string;
    title: string;
    daysRemaining: number | null;
    progressPercentage: number;
  }>;
};
```

#### `calculateTodayProgress`
```typescript
// lib/metrics/todayProgress.ts
export async function calculateTodayProgress(
  studentId: string,
  tenantId?: string | null,
  targetDate?: string,
  excludeCampMode: boolean = false
): Promise<TodayProgress>

// 반환 타입
type TodayProgress = {
  planTotalCount: number;
  planCompletedCount: number;
  progressPercentage: number; // 0-100
};
```

---

## 📊 Frontend 컴포넌트 사용 현황

### 1. 현재 사용 중인 컴포넌트

#### ✅ 이미 리팩토링된 함수 사용 중
- `app/(student)/today/_components/TodayAchievementsAsync.tsx`
  - `calculateTodayProgress` 사용 ✅
  - Suspense 적용됨 ✅

#### ⚠️ 레거시 함수 사용 중 (마이그레이션 필요)

**1. `app/(parent)/parent/_components/ParentDashboardContent.tsx`**
- **현재**: `getWeakSubjects(riskAnalyses)` - 로컬 유틸리티 함수 사용
- **문제**: `lib/metrics/getWeakSubjects`와 다른 시그니처
- **영향**: 취약 과목 계산 로직이 다름

**2. `app/(student)/report/weekly/page.tsx`**
- **현재**: `getWeeklyWeakSubjectTrend` 사용
- **확인 필요**: `lib/metrics/getWeakSubjects`와의 관계

**3. `app/(student)/dashboard/_utils.ts`**
- **현재**: `fetchTodayProgress` - 로컬 함수 사용
- **문제**: `lib/metrics/todayProgress.calculateTodayProgress`와 중복
- **영향**: 두 가지 다른 로직이 혼재

**4. `app/(parent)/parent/_components/ParentDashboardContent.tsx`**
- **현재**: `getGoalProgress` + `calculateGoalProgress` 직접 호출
- **개선**: `lib/metrics/getGoalStatus` 사용으로 통합 가능

---

## 🎯 Phase 4 작업 목록

### Priority 1: 핵심 Dashboard 컴포넌트 마이그레이션

#### Task 1.1: Student Dashboard 마이그레이션
**파일**: `app/(student)/dashboard/_utils.ts`

**작업 내용**:
1. `fetchTodayProgress` 제거
2. `lib/metrics/todayProgress.calculateTodayProgress` 사용
3. 시그니처 변경에 따른 호출부 수정

**예상 효과**:
- 코드 중복 제거
- 일관된 진행률 계산 로직
- 성능 개선 (Batch Query 활용)

**작업 소요**: 2-3시간

---

#### Task 1.2: Parent Dashboard 마이그레이션
**파일**: `app/(parent)/parent/_components/ParentDashboardContent.tsx`

**작업 내용**:
1. `getWeakSubjects(riskAnalyses)` → `lib/metrics/getWeakSubjects` 사용
2. `getGoalProgress` + `calculateGoalProgress` → `lib/metrics/getGoalStatus` 사용
3. 반환 타입 변경에 따른 UI 수정
   - `WeakSubjectMetrics.subjectStudyTime`은 `Map<string, number>` 타입
   - UI에서 `Map` 순회 로직 필요

**예상 효과**:
- 일관된 메트릭 계산
- 성능 개선 (N+1 문제 해결)

**작업 소요**: 3-4시간

---

#### Task 1.3: Weekly Report 마이그레이션
**파일**: `app/(student)/report/weekly/page.tsx`

**작업 내용**:
1. `getWeeklyWeakSubjectTrend` 확인 및 `lib/metrics/getWeakSubjects`로 통합 검토
2. 시그니처 변경에 따른 UI 수정

**작업 소요**: 2-3시간

---

### Priority 2: Loading State 최적화

#### Task 2.1: Suspense 전략 개선
**현재 상태**:
- `TodayAchievementsAsync`에 Suspense 적용됨 ✅
- 일부 Dashboard 컴포넌트에 Suspense 적용됨 ✅

**개선 사항**:
1. **Streaming 최적화**: 리팩토링된 함수의 빠른 응답 속도 활용
   - 기존: 수백 ms → 개선: 수십 ms
   - Suspense fallback 시간 단축 가능

2. **병렬 로딩 전략**:
   ```typescript
   // 예시: 병렬 Suspense 경계
   <Suspense fallback={<TodayProgressSkeleton />}>
     <TodayProgressSection />
   </Suspense>
   <Suspense fallback={<GoalStatusSkeleton />}>
     <GoalStatusSection />
   </Suspense>
   <Suspense fallback={<WeakSubjectsSkeleton />}>
     <WeakSubjectsSection />
   </Suspense>
   ```

3. **스켈레톤 컴포넌트 개선**:
   - 빠른 응답 시간에 맞춘 경량 스켈레톤
   - 페이드 인 애니메이션 추가

**작업 소요**: 2-3시간

---

#### Task 2.2: Loading State 통일
**작업 내용**:
1. 모든 Metrics 관련 컴포넌트에 일관된 Loading State 적용
2. `LoadingSkeleton` variant 확장 (metrics, goals, weakSubjects)

**작업 소요**: 1-2시간

---

### Priority 3: 타입 안전성 강화

#### Task 3.1: 반환 타입 통일
**문제점**:
- `Map<string, number>` 타입이 UI에서 직접 사용 어려움
- 일부 컴포넌트에서 `Object.entries()` 변환 필요

**해결 방안**:
1. UI용 헬퍼 함수 추가:
   ```typescript
   // lib/metrics/utils.ts
   export function mapToArray<T, V>(
     map: Map<T, V>
   ): Array<{ key: T; value: V }> {
     return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
   }
   ```

2. 또는 컴포넌트에서 직접 변환:
   ```typescript
   const subjectStudyTimeArray = Array.from(
     weakSubjects.subjectStudyTime.entries()
   ).map(([subject, minutes]) => ({ subject, minutes }));
   ```

**작업 소요**: 1시간

---

### Priority 4: 성능 모니터링

#### Task 4.1: 성능 측정 도구 추가
**작업 내용**:
1. 리팩토링 전후 성능 비교 측정
2. Dashboard 로딩 시간 모니터링
3. 메트릭 함수별 응답 시간 로깅

**작업 소요**: 2-3시간

---

## 📈 예상 개선 효과

### 성능 개선
- **쿼리 횟수**: O(N) → O(1) 또는 O(콘텐츠 타입 수)
- **응답 시간**: 수백 ms → 수십 ms
- **Dashboard 초기 로딩**: 5-10% 개선 예상

### 코드 품질
- **코드 중복 제거**: 3-5개 중복 함수 통합
- **타입 안전성**: 일관된 타입 사용
- **유지보수성**: 단일 소스 오브 트루스

---

## 🗓 작업 일정

### Week 1: 핵심 마이그레이션
- [ ] Task 1.1: Student Dashboard 마이그레이션
- [ ] Task 1.2: Parent Dashboard 마이그레이션
- [ ] Task 1.3: Weekly Report 마이그레이션

### Week 2: UX 최적화
- [ ] Task 2.1: Suspense 전략 개선
- [ ] Task 2.2: Loading State 통일
- [ ] Task 3.1: 타입 안전성 강화

### Week 3: 모니터링 및 검증
- [ ] Task 4.1: 성능 측정 도구 추가
- [ ] 통합 테스트
- [ ] 문서화

---

## ⚠️ 주의사항

### 1. Breaking Changes
- `getWeakSubjects` 반환 타입 변경 (`Map<string, number>`)
- UI 컴포넌트에서 `Map` 순회 로직 필요

### 2. 테스트 필요
- 각 마이그레이션 후 E2E 테스트 필수
- 성능 회귀 테스트

### 3. 점진적 마이그레이션
- 한 번에 하나씩 마이그레이션
- 각 작업 후 커밋 및 검증

---

## 📚 참고 자료

- **리팩토링 가이드**: `docs/REFACTORING_GUIDE.md`
- **Phase 3-3 완료 보고서**: `docs/2025-02-05-phase3-3-completion.md`
- **성능 최적화 문서**: `docs/page-performance-analysis-and-optimization.md`

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-02-05

