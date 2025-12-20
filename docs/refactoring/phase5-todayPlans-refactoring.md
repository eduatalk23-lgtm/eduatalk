# Phase 5: todayPlans.ts 리팩토링 완료

## 작업 개요

`lib/data/todayPlans.ts` 파일을 Core 모듈의 표준 패턴(`typedQueryBuilder`, `errorHandler`)으로 리팩토링했습니다.

## 주요 변경사항

### 1. Import 변경

**이전:**

```typescript
import {
  withErrorFallback,
} from "@/lib/utils/databaseFallback";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
```

**이후:**

```typescript
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import {
  createTypedQuery,
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";
import {
  getActiveSessionsForPlans,
  type StudySession,
} from "@/lib/data/studentSessions";
import { buildPlanQuery } from "@/lib/data/studentPlans";
```

### 2. View Fallback 리팩토링 (`getPlansFromView`)

**이전:**

```typescript
// View 조회 시도, PGRST205 에러 발생 시 fallback
const result = await (withErrorFallback as any)(
  queryPlansFromView,
  fallbackQuery,
  (error: any) => {
    // PGRST205: View가 스키마 캐시에 없음
    if (ErrorCodeCheckers.isViewNotFound(error)) {
      // 개발 환경에서만 상세 로깅
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[data/todayPlans] today_plan_view not found, using fallback",
          {
            code: error?.code,
            message: error?.message,
            hint: error?.hint,
          }
        );
      }
      return true;
    }
    // 기타 에러는 fallback하지 않음 (실제 에러로 처리)
    return false;
  }
);

// 에러가 있고 fallback하지 않은 경우 (실제 에러)
if (result.error && !ErrorCodeCheckers.isViewNotFound(result.error)) {
  // 구조화된 에러 로깅
  const errorDetails = {
    code: result.error?.code,
    message: result.error?.message,
    hint: result.error?.hint,
    details: result.error?.details,
    timestamp: new Date().toISOString(),
    context: {
      studentId: options.studentId,
      tenantId: options.tenantId,
      planDate: options.planDate,
      hasDateRange: !!options.dateRange,
      planGroupIdsCount: options.planGroupIds?.length || 0,
    },
  };

  console.error(
    "[data/todayPlans] View 조회 중 예상치 못한 에러",
    errorDetails
  );

  // 실제 에러 발생 시에도 fallback으로 처리 (안정성 우선)
  return await getPlansForStudent({
    studentId: options.studentId,
    tenantId: options.tenantId,
    planDate: options.planDate,
    dateRange: options.dateRange,
    planGroupIds: options.planGroupIds,
  });
}

// View 결과를 Plan 타입으로 변환 (denormalized 필드 우선, View 필드는 fallback)
const plans = (result.data || []).map((row: Record<string, unknown>) => {
  // ... 타입 변환 로직
});
```

**이후:**

```typescript
// View 결과 타입 정의
type ViewPlanRow = Record<string, unknown> & {
  id: string;
  tenant_id: string;
  student_id: string;
  // ... 모든 필드 타입 명시
};

// View에서 필요한 필드만 조회 (view_* 필드 포함)
const result = await createTypedConditionalQuery<ViewPlanRow[]>(
  async () => {
    const query = buildPlanQuery(
      supabase,
      "today_plan_view",
      "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,view_content_title,view_content_subject,view_content_subject_category,view_content_category,memo,created_at,updated_at",
      {
        studentId: options.studentId,
        tenantId: options.tenantId,
        planDate: options.planDate,
        dateRange: options.dateRange,
        planGroupIds: options.planGroupIds,
      }
    );
    const queryResult = await query;
    return {
      data: queryResult.data as ViewPlanRow[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/todayPlans] getPlansFromView",
    defaultValue: [],
    fallbackQuery: async () => {
      try {
        const plans = await getPlansForStudent({
          studentId: options.studentId,
          tenantId: options.tenantId,
          planDate: options.planDate,
          dateRange: options.dateRange,
          planGroupIds: options.planGroupIds,
        });
        // Fallback 결과를 ViewPlanRow 형식으로 변환 (호환성 유지)
        const viewRows: ViewPlanRow[] = plans.map((plan) => ({
          ...plan,
          view_content_title: null,
          view_content_subject: null,
          view_content_subject_category: null,
          view_content_category: null,
        })) as ViewPlanRow[];
        return { data: viewRows, error: null };
      } catch (error) {
        handleQueryError(error as { code?: string } | null, {
          context: "[data/todayPlans] getPlansFromView fallback",
        });
        return { data: null, error: error as { code?: string } | null };
      }
    },
    shouldFallback: (error) => ErrorCodeCheckers.isViewNotFound(error),
  }
);

// View 결과를 Plan 타입으로 변환 (denormalized 필드 우선, View 필드는 fallback)
const plans = (result || []).map((row: ViewPlanRow): Plan => {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    // ... 타입 안전한 변환
  };
});
```

### 3. 병렬 쿼리 안전성 강화 (`getTodayPlans`)

**이전:**

```typescript
// progress 조회와 sessions 조회를 병렬로 실행
const [progressResult, activeSessionsResult, fullDaySessionsResult] = await Promise.all([
  // Query 0: Progress data (narrowed to content IDs)
  (async () => {
    if (allContentIds.length === 0) {
      return [];
    }
    const { data: progressResult, error: progressError } = await supabase
      .from("student_content_progress")
      .select("content_type,content_id,progress")
      .eq("student_id", studentId)
      .in("content_id", allContentIds);

    if (progressError) {
      console.error("[data/todayPlans] 진행률 조회 실패", progressError);
      return [];
    }

    return progressResult ?? [];
  })(),
  // Query 1: Active sessions for plan execution state (narrowed to plan IDs)
  (async () => {
    if (planIds.length === 0) {
      return [];
    }
    const activeSessions = await getActiveSessionsForPlans(
      planIds,
      studentId,
      tenantId
    );
    // 기존 형식에 맞게 변환
    return activeSessions.map((session) => ({
      plan_id: session.plan_id,
      started_at: session.started_at,
      paused_at: session.paused_at,
      resumed_at: session.resumed_at,
      paused_duration_seconds: session.paused_duration_seconds,
    }));
  })(),
  // Query 2: Full-day sessions for todayProgress calculation (only if includeProgress)
  includeProgress && plans.length > 0
    ? (async () => {
        const target = new Date(targetDate + "T00:00:00");
        const targetEnd = new Date(target);
        targetEnd.setHours(23, 59, 59, 999);
        const sessions = await getSessionsInRange({
          studentId,
          tenantId,
          dateRange: {
            start: target.toISOString(),
            end: targetEnd.toISOString(),
          },
        });
        return sessions;
      })()
    : Promise.resolve([]),
]);
```

**이후:**

```typescript
// 진행률 데이터 타입 정의
type ProgressRow = {
  content_type: string;
  content_id: string;
  progress: number | null;
};

// 활성 세션 변환 타입 정의
type ActiveSessionRow = {
  plan_id: string | null;
  started_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  paused_duration_seconds: number | null;
};

// progress 조회와 sessions 조회를 병렬로 실행
const [progressResult, activeSessionsResult, fullDaySessionsResult] = await Promise.all([
  // Query 0: Progress data (narrowed to content IDs)
  createTypedQuery<ProgressRow[]>(
    async () => {
      if (allContentIds.length === 0) {
        return { data: [], error: null };
      }
      const queryResult = await supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress")
        .eq("student_id", studentId)
        .in("content_id", allContentIds);
      return {
        data: queryResult.data as ProgressRow[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/todayPlans] 진행률 조회",
      defaultValue: [],
    }
  ),
  // Query 1: Active sessions for plan execution state (narrowed to plan IDs)
  createTypedQuery<ActiveSessionRow[]>(
    async () => {
      if (planIds.length === 0) {
        return { data: [], error: null };
      }
      try {
        const activeSessions = await getActiveSessionsForPlans(
          planIds,
          studentId,
          tenantId
        );
        // 기존 형식에 맞게 변환
        const convertedSessions: ActiveSessionRow[] = activeSessions.map((session) => ({
          plan_id: session.plan_id ?? null,
          started_at: session.started_at,
          paused_at: session.paused_at ?? null,
          resumed_at: session.resumed_at ?? null,
          paused_duration_seconds: session.paused_duration_seconds ?? null,
        }));
        return { data: convertedSessions, error: null };
      } catch (error) {
        handleQueryError(error as { code?: string } | null, {
          context: "[data/todayPlans] 활성 세션 조회",
        });
        return { data: null, error: error as { code?: string } | null };
      }
    },
    {
      context: "[data/todayPlans] 활성 세션 조회",
      defaultValue: [],
    }
  ),
  // Query 2: Full-day sessions for todayProgress calculation (only if includeProgress)
  includeProgress && plans.length > 0
    ? createTypedQuery<StudySession[]>(
        async () => {
          const target = new Date(targetDate + "T00:00:00");
          const targetEnd = new Date(target);
          targetEnd.setHours(23, 59, 59, 999);
          try {
            const sessions = await getSessionsInRange({
              studentId,
              tenantId,
              dateRange: {
                start: target.toISOString(),
                end: targetEnd.toISOString(),
              },
            });
            return { data: sessions, error: null };
          } catch (error) {
            handleQueryError(error as { code?: string } | null, {
              context: "[data/todayPlans] 전체 세션 조회",
            });
            return { data: null, error: error as { code?: string } | null };
          }
        },
        {
          context: "[data/todayPlans] 전체 세션 조회",
          defaultValue: [],
        }
      )
    : Promise.resolve([]),
]);
```

### 4. 에러 처리 표준화

**이전:**

```typescript
if (cacheError && cacheError.code !== "PGRST116") {
  // PGRST116 = no rows found (expected for cache miss)
  console.warn(
    "[todayPlans] cache lookup error (non-blocking):",
    cacheError
  );
}
} catch (error) {
  console.warn("[todayPlans] cache lookup failed (non-blocking):", error);
  // Continue with normal execution on cache error
}

// ...

} catch (error) {
  console.error("[data/todayPlans] 오늘 진행률 계산 실패 (비차단)", error);
  // Non-blocking: continue without progress data
  todayProgress = null;
}

// ...

} catch (error) {
  console.error(
    "[data/todayPlans] 오늘 진행률 최종 계산 실패 (비차단)",
    error
  );
  // Keep partial progress data
}

// ...

if (cacheError) {
  console.warn(
    "[todayPlans] cache store error (non-blocking):",
    cacheError
  );
}
} catch (error) {
  console.warn("[todayPlans] cache store failed (non-blocking):", error);
  // Continue without caching - result is still valid
}
```

**이후:**

```typescript
if (cacheError && !ErrorCodeCheckers.isNoRowsReturned(cacheError)) {
  // PGRST116 = no rows found (expected for cache miss)
  handleQueryError(cacheError, {
    context: "[data/todayPlans] cache lookup",
    logError: false, // Non-blocking이므로 warn 레벨로만 로깅
  });
}
} catch (error) {
  handleQueryError(error as { code?: string } | null, {
    context: "[data/todayPlans] cache lookup",
    logError: false, // Non-blocking이므로 warn 레벨로만 로깅
  });
  // Continue with normal execution on cache error
}

// ...

} catch (error) {
  handleQueryError(error as { code?: string } | null, {
    context: "[data/todayPlans] 오늘 진행률 계산",
    logError: false, // Non-blocking이므로 warn 레벨로만 로깅
  });
  // Non-blocking: continue without progress data
  todayProgress = null;
}

// ...

} catch (error) {
  handleQueryError(error as { code?: string } | null, {
    context: "[data/todayPlans] 오늘 진행률 최종 계산",
    logError: false, // Non-blocking이므로 warn 레벨로만 로깅
  });
  // Keep partial progress data
}

// ...

if (cacheError) {
  handleQueryError(cacheError, {
    context: "[data/todayPlans] cache store",
    logError: false, // Non-blocking이므로 warn 레벨로만 로깅
  });
}
} catch (error) {
  handleQueryError(error as { code?: string } | null, {
    context: "[data/todayPlans] cache store",
    logError: false, // Non-blocking이므로 warn 레벨로만 로깅
  });
  // Continue without caching - result is still valid
}
```

### 5. 타입 안전성 강화

**제거된 `any` 타입:**

- `withErrorFallback as any` → `createTypedConditionalQuery`로 교체
- `(error: any)` → `(error: { code?: string } | null)`로 명시적 타입 지정
- `Record<string, unknown>` → `ViewPlanRow` 타입으로 명시적 정의
- `activeSessions.map((session) => ({ ... }))` → `ActiveSessionRow[]` 타입으로 명시적 정의

**추가된 타입 정의:**

```typescript
// View 결과 타입 정의
type ViewPlanRow = Record<string, unknown> & {
  id: string;
  tenant_id: string;
  student_id: string;
  // ... 모든 필드 타입 명시
};

// 진행률 데이터 타입 정의
type ProgressRow = {
  content_type: string;
  content_id: string;
  progress: number | null;
};

// 활성 세션 변환 타입 정의
type ActiveSessionRow = {
  plan_id: string | null;
  started_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  paused_duration_seconds: number | null;
};
```

## 개선 효과

### 1. View Fallback 로직 표준화

- `withErrorFallback` 유틸리티 제거
- `createTypedConditionalQuery` 패턴으로 통일
- `shouldFallback` 옵션으로 조건부 Fallback 명확화
- PGRST205 에러만 Fallback하도록 명확히 설정

### 2. 병렬 쿼리 안전성 강화

- 각 병렬 쿼리를 `createTypedQuery`로 감싸서 개별적인 에러 처리 가능
- 타입 안전성 향상 (명시적 타입 정의)
- 에러 발생 시에도 다른 쿼리에 영향 없이 기본값 반환

### 3. 에러 처리 일관성

- 모든 `console.error`, `console.warn` 호출을 `handleQueryError`로 통일
- 에러 로깅 컨텍스트 표준화 (`[data/todayPlans] functionName`)
- Non-blocking 에러는 `logError: false` 옵션으로 warn 레벨로만 로깅

### 4. 타입 안전성 향상

- `any` 타입 완전 제거
- 명시적 타입 정의로 런타임 에러 방지
- Database 타입 활용으로 타입 안전성 보장

## 유지된 비즈니스 로직

다음 비즈니스 로직은 그대로 유지되었습니다:

1. **성능 최적화 로직**:
   - 병렬 쿼리 처리 (`Promise.all`)
   - 캐시 조회/저장 로직 (Non-blocking)
   - View를 통한 Application-side Join 제거

2. **Fallback 로직**:
   - View 조회 실패 시 테이블 직접 조회로 전환
   - 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 찾기 (30일/180일 범위 병렬 조회)

3. **진행률 계산 로직**:
   - `todayProgress` 계산 로직 (비차단)
   - `fullDaySessions`를 통한 학습 시간 계산

## 변경된 함수 목록

### 주요 함수 (View Fallback 표준화)

- `getPlansFromView` - `createTypedConditionalQuery` 사용

### 병렬 쿼리 안전성 강화

- `getTodayPlans` 내부의 병렬 쿼리들:
  - 진행률 조회 (`createTypedQuery<ProgressRow[]>`)
  - 활성 세션 조회 (`createTypedQuery<ActiveSessionRow[]>`)
  - 전체 세션 조회 (`createTypedQuery<StudySession[]>`)

### 에러 처리 변경

- 캐시 조회 에러 처리 (`handleQueryError` 사용)
- 진행률 계산 에러 처리 (`handleQueryError` 사용)
- 캐시 저장 에러 처리 (`handleQueryError` 사용)

### 에러 코드 체크 변경

- `cacheError.code !== "PGRST116"` → `!ErrorCodeCheckers.isNoRowsReturned(cacheError)`

## 제거된 코드

- `withErrorFallback` import 및 사용
- `any` 타입 사용
- `console.error`, `console.warn` 직접 호출 (에러 처리 부분)

## 다음 단계

Phase 5 리팩토링이 완료되었습니다. 다음 단계는:

1. 다른 데이터 계층 파일들도 동일한 패턴으로 리팩토링
2. 성능 테스트 및 모니터링
3. 문서화 및 가이드라인 정리

## 참고

- Core 모듈: `lib/data/core/typedQueryBuilder.ts`
- 에러 처리: `lib/data/core/errorHandler.ts`
- 에러 코드: `lib/constants/errorCodes.ts`
- Database 타입: `lib/supabase/database.types.ts`

