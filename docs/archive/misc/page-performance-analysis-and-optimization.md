# 페이지 성능 분석 및 최적화 제안

**작성 일자**: 2025-12-11  
**분석 대상**: `/today`, `/camp/today`, `/dashboard` 페이지 성능 로그

---

## 1. 페이지별 요약 테이블

### 1.1 `/dashboard` 페이지

| 타이머 이름 | 실행 시간 | 비중 | 비고 |
|------------|----------|------|------|
| `[dashboard] data - monthlyReport` | 2,791ms | 35.0% | **최대 병목** |
| `[dashboard] data - overview` | 2,638ms | 33.1% | **두 번째 병목** |
| `[dashboard] data - todayPlansSummary` | 1,327ms | 16.6% | **세 번째 병목** |
| `[dashboard] data - weeklyReport` | 210ms | 2.6% | 양호 |
| `[dashboard] render - DashboardContent` | 1ms | 0.01% | 렌더링은 빠름 |
| **Total** | **7,977ms** | **100%** | |

**주요 문제점**:
- 데이터 페치가 전체 시간의 99.99% 차지
- 월간 리포트가 가장 큰 병목 (2.791s)
- Overview 데이터 페치도 느림 (2.638s)

---

### 1.2 `/camp/today` 페이지

| 타이머 이름 | 실행 시간 | 비중 | 비고 |
|------------|----------|------|------|
| `[camp/today] data - todayPlans` | 1,416ms | 49.3% | todayPlans 쿼리 |
| `[camp/today] data - planGroups+templates` | 410ms | 14.3% | 플랜 그룹 + 템플릿 |
| `[camp/today] render - TodayPageContent` | 0.3ms | 0.01% | 렌더링은 빠름 |
| **Total** | **2,871ms** | **100%** | |

**세부 todayPlans 내부**:
- `[todayPlans] cache - lookup`: 199ms (캐시 미스)
- `[todayPlans] db - wave1 (parallel)`: 205ms
- `[todayPlans] db - wave2 (parallel)`: 197ms
- `[todayPlans] enrich`: 390ms
- `[todayPlans] cache - store`: 211ms

**주요 문제점**:
- 캐시 미스 시 전체 쿼리 실행 (1.4s)
- 캐시 lookup 자체가 199ms로 느림 (RLS 정책 영향 가능)
- 두 번째 호출부터는 캐시 히트로 개선 예상

---

### 1.3 `/today` 페이지

| 타이머 이름 | 실행 시간 | 비중 | 비고 |
|------------|----------|------|------|
| `[today] data - todayPlans` | ~1,300ms (추정) | ~99% | calculateTodayProgress |
| `[today] render - TodayPageContent` | ~14ms (추정) | ~1% | 렌더링 |
| **Total** | **1,314ms** | **100%** | |

**주요 문제점**:
- `calculateTodayProgress`가 전체 시간의 대부분 차지
- todayPlans 캐시를 활용하지 않음 (별도 쿼리 실행)

---

## 2. 최적화 우선순위 Top 3

### 🥇 Priority 1: Dashboard Monthly Report (2.791s → 목표: 500ms)

**문제점**:
- `getMonthlyReportData()`가 여러 하위 함수를 순차/병렬 호출
- 월간 데이터 범위가 넓어서 쿼리 비용이 큼
- 세션 조회, 플랜 조회, 진행률 조회 등이 각각 실행됨

**왜 느린가**:
1. **넓은 날짜 범위**: 한 달치 데이터를 모두 조회
2. **N+1 쿼리 패턴**: 세션별로 플랜 정보를 개별 조회하는 부분 존재
3. **중복 계산**: 주차별, 과목별 집계가 메모리에서 반복 계산
4. **캐싱 없음**: 월간 리포트는 캐싱되지 않음

**개선 아이디어**:
1. **Lazy Loading**: 월간 리포트 섹션을 클라이언트에서 on-demand 로드
2. **캐싱**: 월간 리포트 결과를 별도 캐시 테이블에 저장 (TTL: 1시간)
3. **쿼리 최적화**: 세션-플랜 JOIN으로 N+1 제거
4. **Suspense 경계**: 월간 리포트를 Suspense로 감싸서 페이지 초기 로딩과 분리

---

### 🥈 Priority 2: Dashboard Overview (2.638s → 목표: 800ms)

**문제점**:
- `fetchTodayPlans()`가 플랜별로 개별 쿼리 실행 (N+1)
- `fetchActivePlan()`이 콘텐츠 맵을 다시 조회 (중복)
- 여러 통계 쿼리가 순차 실행

**왜 느린가**:
1. **N+1 쿼리**: `fetchTodayPlans()` 내부에서 각 플랜마다 `planTiming` 조회 (151-156줄)
2. **중복 콘텐츠 조회**: `fetchActivePlan()`이 콘텐츠 맵을 다시 조회 (822-826줄)
3. **비효율적 쿼리**: `fetchLearningStatistics()`가 이번 주 플랜을 모두 조회 후 메모리에서 집계

**개선 아이디어**:
1. **쿼리 통합**: 플랜 조회 시 timing 정보를 한 번에 JOIN
2. **캐싱**: 콘텐츠 맵을 메모리 캐시 또는 Redis에 저장
3. **병렬 최적화**: Overview 내부 쿼리들을 더 세밀하게 병렬화
4. **todayPlans 캐시 재사용**: `fetchTodayPlans()` 대신 `getTodayPlans()` 캐시 활용

---

### 🥉 Priority 3: Dashboard Today Plans Summary (1.327s → 목표: 200ms)

**문제점**:
- `summarizeTodayPlans()`가 세션을 다시 조회
- `calculatePlanStudySeconds()`가 각 플랜마다 실행
- todayPlans 데이터를 이미 가져왔는데 다시 계산

**왜 느린가**:
1. **중복 세션 조회**: `getSessionsInRange()`로 오늘 세션을 다시 조회 (135-142줄)
2. **순차 계산**: 각 플랜마다 `calculatePlanStudySeconds()` 실행
3. **todayPlans 캐시 미활용**: 이미 `fetchTodayPlans()`로 가져온 데이터를 재활용하지 않음

**개선 아이디어**:
1. **todayPlans 캐시 활용**: `getTodayPlans()` 결과에서 세션 정보 추출
2. **세션 캐싱**: 오늘 세션을 별도로 캐싱하거나 todayPlans에 포함
3. **계산 최적화**: Map 기반 세션 조회로 O(1) 접근

---

## 3. 실제 코드 수정 제안

### 3.1 Priority 1: Dashboard Monthly Report Lazy Loading

**파일**: `app/(student)/dashboard/page.tsx`

**변경 사항**:
1. 월간 리포트를 클라이언트 컴포넌트로 분리
2. Suspense 경계로 감싸서 초기 로딩과 분리
3. 클라이언트에서 on-demand 로드

**코드 예시**:

```typescript
// app/(student)/dashboard/_components/MonthlyReportSection.tsx
"use client";

import { useState, useEffect } from "react";
import { getMonthlyReportData } from "@/lib/reports/monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function MonthlyReportSection({ studentId, monthDate }: { studentId: string; monthDate: Date }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = await createSupabaseServerClient();
      const result = await getMonthlyReportData(supabase, studentId, monthDate);
      setData(result);
      setLoading(false);
    }
    load();
  }, [studentId, monthDate]);

  if (loading) return <div>로딩 중...</div>;
  if (!data) return null;

  // 기존 월간 리포트 렌더링 로직
  return <div>{/* ... */}</div>;
}
```

```typescript
// app/(student)/dashboard/page.tsx
import { Suspense } from "react";
import { MonthlyReportSection } from "./_components/MonthlyReportSection";

export default async function DashboardPage() {
  // ... 기존 코드 ...

  // 월간 리포트는 제거하고 Suspense로 감싸기
  // console.time("[dashboard] data - monthlyReport");
  // const [monthlyReportResult] = await Promise.allSettled([
  //   getMonthlyReportData(supabase, user.id, today),
  // ]);
  // console.timeEnd("[dashboard] data - monthlyReport");

  const page = (
    <>
      {/* ... 기존 섹션들 ... */}
      
      {/* 월간 리포트를 Suspense로 감싸서 lazy load */}
      <Suspense fallback={<div>월간 리포트 로딩 중...</div>}>
        <MonthlyReportSection studentId={user.id} monthDate={today} />
      </Suspense>
    </>
  );

  return page;
}
```

**예상 개선 효과**:
- 초기 페이지 로딩: 7.977s → 5.186s (35% 개선)
- 월간 리포트는 클라이언트에서 별도 로드

---

### 3.2 Priority 2: Dashboard Overview 쿼리 최적화

**파일**: `app/(student)/dashboard/_utils.ts`

**변경 사항**:
1. `fetchTodayPlans()`의 N+1 쿼리 제거
2. `fetchActivePlan()`의 중복 콘텐츠 조회 제거
3. todayPlans 캐시 재사용

**코드 예시**:

```typescript
// app/(student)/dashboard/_utils.ts

// 변경 1: fetchTodayPlans에서 N+1 제거
export async function fetchTodayPlans(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string,
  dayOfWeek: number
): Promise<TodayPlan[]> {
  try {
    // 기존: 플랜만 조회
    // 변경: timing 정보를 한 번에 JOIN
    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select(`
          id,
          block_index,
          content_type,
          content_id,
          planned_start_page_or_time,
          planned_end_page_or_time,
          actual_start_time,
          actual_end_time,
          total_duration_seconds,
          paused_duration_seconds,
          pause_count
        `)
        .eq("plan_date", todayDate)
        .order("block_index", { ascending: true });

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);
    if (error && error.code === "42703") {
      // fallback: timing 컬럼 없이 조회
      ({ data: plans, error } = await selectPlans().select(`
        id,
        block_index,
        content_type,
        content_id,
        planned_start_page_or_time,
        planned_end_page_or_time
      `));
    }
    if (error) throw error;

    const planRows = (plans as PlanRow[] | null) ?? [];
    if (planRows.length === 0) {
      return [];
    }

    // ... 기존 블록/콘텐츠/진행률 조회 로직 ...

    // 변경: 개별 쿼리 제거, 이미 조회한 데이터 사용
    for (const plan of planRows) {
      // 기존: 각 플랜마다 개별 쿼리
      // const { data: planTiming } = await supabase.from("student_plan")...
      
      // 변경: 이미 조회한 데이터 사용
      const planTiming = plan; // 이미 timing 정보 포함

      todayPlans.push({
        // ... 기존 필드들 ...
        actual_start_time: planTiming?.actual_start_time ?? null,
        actual_end_time: planTiming?.actual_end_time ?? null,
        total_duration_seconds: planTiming?.total_duration_seconds ?? null,
        paused_duration_seconds: planTiming?.paused_duration_seconds ?? null,
        pause_count: planTiming?.pause_count ?? null,
      });
    }

    return todayPlans.sort((a, b) => a.block_index - b.block_index);
  } catch (error) {
    console.error("[dashboard] 오늘 플랜 조회 실패", error);
    return [];
  }
}

// 변경 2: fetchActivePlan에서 콘텐츠 맵 재사용
export async function fetchActivePlan(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string,
  contentMaps?: { // 추가 파라미터
    bookMap: Record<string, ContentRow>;
    lectureMap: Record<string, ContentRow>;
    customMap: Record<string, ContentRow>;
  }
): Promise<ActivePlan | null> {
  try {
    // ... 기존 활성 플랜 조회 로직 ...

    // 변경: 콘텐츠 맵을 파라미터로 받아서 재사용
    let bookMap: Record<string, ContentRow>;
    let lectureMap: Record<string, ContentRow>;
    let customMap: Record<string, ContentRow>;

    if (contentMaps) {
      // 재사용
      ({ bookMap, lectureMap, customMap } = contentMaps);
    } else {
      // 없으면 새로 조회 (fallback)
      [bookMap, lectureMap, customMap] = await Promise.all([
        fetchContentMap(supabase, "books", studentId),
        fetchContentMap(supabase, "lectures", studentId),
        fetchContentMap(supabase, "student_custom_contents", studentId),
      ]);
    }

    const contentMeta = resolveContentMeta(
      plan.content_id,
      contentType,
      bookMap,
      lectureMap,
      customMap
    );

    return { /* ... */ };
  } catch (error) {
    console.error("[dashboard] 활성 플랜 조회 실패", error);
    return null;
  }
}
```

```typescript
// app/(student)/dashboard/page.tsx

export default async function DashboardPage() {
  // ... 기존 코드 ...

  console.time("[dashboard] data - overview");
  
  // 변경: 콘텐츠 맵을 한 번만 조회하고 재사용
  const [bookMap, lectureMap, customMap] = await Promise.all([
    fetchContentMap(supabase, user.id, "books"),
    fetchContentMap(supabase, user.id, "lectures"),
    fetchContentMap(supabase, user.id, "student_custom_contents"),
  ]);

  const [
    todayPlansResult,
    statisticsResult,
    weeklyBlocksResult,
    contentTypeProgressResult,
    activePlanResult,
  ] = await Promise.allSettled([
    fetchTodayPlans(supabase, user.id, todayDate, dayOfWeek), // N+1 제거됨
    fetchLearningStatistics(supabase, user.id),
    fetchWeeklyBlockCounts(supabase, user.id),
    fetchContentTypeProgress(supabase, user.id),
    fetchActivePlan(supabase, user.id, todayDate, { // 콘텐츠 맵 재사용
      bookMap,
      lectureMap,
      customMap,
    }),
  ]);
  console.timeEnd("[dashboard] data - overview");
}
```

**예상 개선 효과**:
- Overview: 2.638s → 800ms (70% 개선)
- N+1 쿼리 제거로 플랜 수 × 쿼리 시간 절약
- 콘텐츠 맵 중복 조회 제거

---

### 3.3 Priority 3: Dashboard Today Plans Summary 최적화

**파일**: `app/(student)/dashboard/page.tsx`

**변경 사항**:
1. `getTodayPlans()` 캐시 활용
2. 세션 정보를 todayPlans에서 추출
3. 중복 계산 제거

**코드 예시**:

```typescript
// app/(student)/dashboard/page.tsx
import { getTodayPlans } from "@/lib/data/todayPlans";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export default async function DashboardPage() {
  // ... 기존 코드 ...

  // 변경: fetchTodayPlans 대신 getTodayPlans 캐시 활용
  console.time("[dashboard] data - overview");
  const tenantContext = await getTenantContext();
  
  // todayPlans 캐시에서 데이터 가져오기
  const todayPlansData = await getTodayPlans({
    studentId: user.id,
    tenantId: tenantContext?.tenantId || null,
    date: todayDate,
    camp: false,
    includeProgress: true,
    narrowQueries: true,
    useCache: true,
    cacheTtlSeconds: 120,
  });

  // todayPlansData에서 필요한 정보 추출
  const todayPlans = todayPlansData.plans.map(plan => ({
    id: plan.id,
    block_index: plan.block_index || 0,
    content_type: plan.content_type,
    content_id: plan.content_id,
    title: plan.content_title || "",
    subject: plan.subject || null,
    difficulty_level: plan.difficulty_level || null,
    start_time: plan.start_time || null,
    end_time: plan.end_time || null,
    progress: plan.progress || null,
    planned_start_page_or_time: plan.planned_start_page_or_time || null,
    planned_end_page_or_time: plan.planned_end_page_or_time || null,
    actual_start_time: plan.actual_start_time || null,
    actual_end_time: plan.actual_end_time || null,
    total_duration_seconds: plan.total_duration_seconds || null,
    paused_duration_seconds: plan.paused_duration_seconds || null,
    pause_count: plan.pause_count || null,
  }));

  // 세션 정보는 todayPlansData.sessions에서 추출
  const sessions = Object.entries(todayPlansData.sessions).map(([planId, session]) => ({
    plan_id: planId,
    ...session,
  }));

  // ... 나머지 overview 쿼리들 ...
  console.timeEnd("[dashboard] data - overview");

  console.time("[dashboard] data - todayPlansSummary");
  // 변경: summarizeTodayPlans 최적화
  const {
    todayProgress,
    completedPlans,
    incompletePlans,
    timeStats: todayTimeStats,
  } = await summarizeTodayPlansOptimized(
    todayPlans,
    sessions, // 세션을 파라미터로 전달 (재조회 없음)
    user.id,
    todayDate
  );
  console.timeEnd("[dashboard] data - todayPlansSummary");
}

// 새로운 최적화된 함수
async function summarizeTodayPlansOptimized(
  plans: TodayPlan[],
  sessions: Array<{ plan_id: string; isPaused: boolean; startedAt?: string | null }>, // 세션을 파라미터로 받음
  studentId: string,
  todayDate: string
): Promise<TodayPlanSummary> {
  const todayProgress = calculateTodayProgress(plans);
  const completedPlans = plans.filter(
    (plan) => plan.progress !== null && plan.progress >= 100
  ).length;
  const incompletePlans = plans.length - completedPlans;

  // 변경: 세션을 재조회하지 않고 파라미터로 받은 세션 사용
  const activeSessionMap = new Map<string, { isPaused: boolean; startedAt?: string | null }>();
  sessions.forEach(session => {
    activeSessionMap.set(session.plan_id, session);
  });

  const nowMs = Date.now();

  // 기존과 동일한 시간 계산 로직
  const timeStats = plans.reduce(
    (acc, plan) => {
      if (plan.actual_start_time) {
        const studySeconds = calculatePlanStudySeconds(
          plan,
          nowMs,
          plan.actual_end_time ? undefined : activeSessionMap.get(plan.id)
        );
        
        const totalDuration = plan.total_duration_seconds || 0;
        const pausedDuration = plan.paused_duration_seconds || 0;
        
        acc.totalStudySeconds += totalDuration;
        acc.pausedSeconds += pausedDuration;
        acc.pureStudySeconds += studySeconds;
        acc.completedCount++;
      }
      return acc;
    },
    { totalStudySeconds: 0, pausedSeconds: 0, pureStudySeconds: 0, completedCount: 0 }
  );

  const averagePlanMinutes =
    timeStats.completedCount > 0
      ? Math.round(timeStats.pureStudySeconds / timeStats.completedCount / 60)
      : 0;

  return {
    todayProgress,
    completedPlans,
    incompletePlans,
    timeStats: {
      totalStudySeconds: timeStats.totalStudySeconds,
      pausedSeconds: timeStats.pausedSeconds,
      completedCount: timeStats.completedCount,
      pureStudySeconds: timeStats.pureStudySeconds,
      averagePlanMinutes,
    },
  };
}
```

**예상 개선 효과**:
- Today Plans Summary: 1.327s → 200ms (85% 개선)
- 세션 재조회 제거
- todayPlans 캐시 재사용

---

## 4. 추가 2차 작업 제안

### 4.1 Today 페이지 todayPlans 캐시 활용

**문제**: `/today` 페이지가 `calculateTodayProgress()`를 별도로 호출하여 todayPlans 캐시를 활용하지 않음

**제안**: `/today` 페이지도 `getTodayPlans()`를 사용하고 캐시를 활용

**예상 효과**: 1.314s → 200ms (캐시 히트 시)

---

### 4.2 Dashboard 월간 리포트 캐싱

**문제**: 월간 리포트가 매번 2.791s 소요

**제안**: 월간 리포트 결과를 별도 캐시 테이블에 저장 (TTL: 1시간)

**구현**:
- `monthly_report_cache` 테이블 생성
- `(student_id, year, month)`를 키로 사용
- TTL: 1시간

**예상 효과**: 2.791s → 50ms (캐시 히트 시)

---

### 4.3 콘텐츠 맵 전역 캐싱

**문제**: 여러 함수에서 콘텐츠 맵을 중복 조회

**제안**: 콘텐츠 맵을 Redis 또는 메모리 캐시에 저장 (TTL: 5분)

**구현**:
- `lib/cache/contentMaps.ts` 생성
- `getContentMap(studentId, contentType)` 함수로 통일
- 내부에서 캐시 확인 후 없으면 DB 조회

**예상 효과**: 콘텐츠 맵 조회 시간 50% 감소

---

## 5. 예상 전체 개선 효과

### 5.1 Dashboard 페이지

**현재**: 7.977s
**개선 후**: 
- Overview: 2.638s → 800ms
- Monthly Report: 2.791s → 0ms (lazy load)
- Today Plans Summary: 1.327s → 200ms
- **예상 총 시간**: ~1.2s (85% 개선)

### 5.2 Camp/Today 페이지

**현재**: 2.871s (첫 호출), ~200ms (캐시 히트)
**개선 후**: 
- 캐시 lookup 최적화: 199ms → 50ms
- **예상 총 시간**: ~1.2s (첫 호출), ~150ms (캐시 히트)

### 5.3 Today 페이지

**현재**: 1.314s
**개선 후**: 
- todayPlans 캐시 활용
- **예상 총 시간**: ~200ms (캐시 히트 시)

---

**작성자**: AI Assistant  
**검토 필요**: 백엔드 팀, 프론트엔드 팀

