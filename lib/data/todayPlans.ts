import { getPlansForStudent } from "@/lib/data/studentPlans";
import type { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { getContentsByIds } from "@/lib/data/studentContents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanWithContent } from "@/app/(student)/today/_utils/planGroupUtils";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { getSessionsInRange, getActiveSessionsForPlans } from "@/lib/data/studentSessions";
import {
  calculatePlanStudySeconds,
  buildActiveSessionMap,
} from "@/lib/metrics/studyTime";
import { perfTime } from "@/lib/utils/perfLog";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIsoDate(value: string | null): string | null {
  if (!value || !ISO_DATE_REGEX.test(value)) {
    return null;
  }
  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : value;
}

export type TodayPlansResponse = {
  plans: PlanWithContent[];
  sessions: Record<string, {
    isPaused: boolean;
    startedAt?: string | null;
    pausedAt?: string | null;
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  }>;
  planDate: string;
  isToday: boolean;
  serverNow: number;
  /**
   * Today progress summary (same as /api/today/progress).
   * Included to avoid separate API call on Today/Camp Today pages.
   * Can be null if calculation fails (non-blocking).
   */
  todayProgress?: TodayProgress | null;
};

export type GetTodayPlansOptions = {
  studentId: string;
  tenantId: string | null;
  date?: string | null;
  camp?: boolean;
  /**
   * If true, includes todayProgress in the response.
   * Default: true
   */
  includeProgress?: boolean;
  /**
   * If true, narrows progress and session queries to only the plans in the result set.
   * This optimization reduces query time when the student has many progress records or active sessions.
   */
  narrowQueries?: boolean;
  /**
   * If true, uses cache for todayPlans results.
   * Default: true
   */
  useCache?: boolean;
  /**
   * Cache TTL in seconds.
   * Default: 120 (2 minutes)
   */
  cacheTtlSeconds?: number;
};

/**
 * 서버 사이드에서 오늘의 플랜 데이터를 조회하는 헬퍼 함수
 * 
 * /api/today/plans API 라우트와 동일한 로직을 사용하지만,
 * 서버 컴포넌트에서 직접 호출할 수 있도록 설계됨.
 * 
 * @param options 조회 옵션
 * @returns 오늘의 플랜 데이터
 */
export async function getTodayPlans(
  options: GetTodayPlansOptions
): Promise<TodayPlansResponse> {
  const { 
    studentId, 
    tenantId, 
    date, 
    camp = false, 
    includeProgress = true, 
    narrowQueries = false,
    useCache = true,
    cacheTtlSeconds = 120
  } = options;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);
  
  const requestedDateParam = normalizeIsoDate(date ?? null);
  const targetDate = requestedDateParam ?? todayDate;

  // Cache lookup (if enabled) - 디버그 모드에서만
  if (useCache) {
    const lookupTimer = perfTime("[todayPlans] cache - lookup");
    try {
      const supabase = await createSupabaseServerClient();
      
      // Build cache query with tenant_id handling (NULL-safe)
      // Use partial index: one for NULL tenant_id, one for non-NULL
      let cacheQuery = supabase
        .from("today_plans_cache")
        .select("payload, expires_at")
        .eq("student_id", studentId)
        .eq("plan_date", targetDate)
        .eq("is_camp_mode", !!camp)
        .gt("expires_at", new Date().toISOString()); // Only valid (non-expired) cache
      
      // Handle tenant_id (NULL or value)
      if (tenantId) {
        cacheQuery = cacheQuery.eq("tenant_id", tenantId);
      } else {
        cacheQuery = cacheQuery.is("tenant_id", null);
      }
      
      const { data: cacheRow, error: cacheError } = await cacheQuery.maybeSingle();
      
      if (!cacheError && cacheRow) {
        lookupTimer.end();
        // Return cached result
        return cacheRow.payload as TodayPlansResponse;
      }
      
      if (cacheError && cacheError.code !== "PGRST116") {
        // PGRST116 = no rows found (expected for cache miss)
        console.warn("[todayPlans] cache lookup error (non-blocking):", cacheError);
      }
    } catch (error) {
      console.warn("[todayPlans] cache lookup failed (non-blocking):", error);
      // Continue with normal execution on cache error
    }
    lookupTimer.end();
  }

  // Wave 1: Independent queries that can run in parallel
  // - planGroups (needed to filter plans)
  const allActivePlanGroups = await getPlanGroupsForStudent({
    studentId,
    tenantId,
    status: "active",
  });

  // Filter plan groups based on camp mode
  let planGroupIds: string[] | undefined = undefined;
  if (camp) {
    // 캠프 모드: 캠프 활성 플랜 그룹만 필터링
    const campPlanGroups = allActivePlanGroups.filter(
      (group) =>
        group.plan_type === "camp" ||
        group.camp_template_id !== null ||
        group.camp_invitation_id !== null
    );
    planGroupIds = campPlanGroups.map((g) => g.id);
  } else {
    // 일반 모드: 일반 활성 플랜 그룹만 필터링
    const nonCampPlanGroups = allActivePlanGroups.filter(
      (group) =>
        group.plan_type !== "camp" &&
        group.camp_template_id === null &&
        group.camp_invitation_id === null
    );
    planGroupIds = nonCampPlanGroups.map((g) => g.id);
  }

  // 선택한 날짜 플랜 조회
  let plans = await getPlansForStudent({
    studentId,
    tenantId,
    planDate: targetDate,
    planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
  });

  let displayDate = targetDate;
  let isToday = targetDate === todayDate;

  // 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 찾기
  if (!requestedDateParam && plans.length === 0) {
    const shortRangeEndDate = new Date(today);
    shortRangeEndDate.setDate(shortRangeEndDate.getDate() + 30);
    const shortRangeEndDateStr = shortRangeEndDate.toISOString().slice(0, 10);

    let futurePlans = await getPlansForStudent({
      studentId,
      tenantId,
      dateRange: {
        start: todayDate,
        end: shortRangeEndDateStr,
      },
      planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
    });

    if (futurePlans.length === 0) {
      const longRangeEndDate = new Date(today);
      longRangeEndDate.setDate(longRangeEndDate.getDate() + 180);
      const longRangeEndDateStr = longRangeEndDate.toISOString().slice(0, 10);

      futurePlans = await getPlansForStudent({
        studentId,
        tenantId,
        dateRange: {
          start: todayDate,
          end: longRangeEndDateStr,
        },
        planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
      });
    }

    if (futurePlans.length > 0) {
      const sortedPlans = futurePlans.sort((a, b) => {
        if (!a.plan_date || !b.plan_date) return 0;
        return a.plan_date.localeCompare(b.plan_date);
      });

      const nearestDate = sortedPlans[0].plan_date;
      if (nearestDate) {
        displayDate = nearestDate;
        isToday = false;
        plans = futurePlans.filter((p) => p.plan_date === nearestDate);
      }
    }
  }

  // Calculate todayProgress from already loaded data (no additional DB queries)
  // This replaces the ~600ms calculateTodayProgress call with in-memory computation
  let todayProgress: TodayProgress | null = null;
  if (includeProgress) {
    try {
      // Use already loaded plans (no need to re-query)
      const planTotalCount = plans.length;
      const planCompletedCount = plans.filter((plan) => !!plan.actual_end_time).length;

      // We'll compute todayStudyMinutes and achievementScore after fullDaySessions are loaded
      // Store intermediate values for later computation
      todayProgress = {
        todayStudyMinutes: 0, // Will be computed after sessions are loaded
        planCompletedCount,
        planTotalCount,
        achievementScore: 0, // Will be computed after todayStudyMinutes is known
      };
    } catch (error) {
      console.error("[data/todayPlans] 오늘 진행률 계산 실패 (비차단)", error);
      // Non-blocking: continue without progress data
      todayProgress = null;
    }
  }

  if (plans.length === 0) {
    // If no plans, we still need to finalize todayProgress if includeProgress is true
    if (includeProgress && todayProgress) {
      // For empty plans, todayProgress is already computed (all zeros)
      todayProgress.todayStudyMinutes = 0;
      todayProgress.achievementScore = 0;
    }
    return {
      plans: [],
      sessions: {},
      planDate: displayDate,
      isToday,
      serverNow: Date.now(),
      todayProgress: todayProgress ?? undefined,
    };
  }

  // 콘텐츠 정보 조회 (최적화: 필요한 ID만 조회)
  // Note: First run can be slow (~59s) due to cold start, connection pooling, or index warmup.
  // Subsequent runs should be ~190ms. This code is hardened to prevent large IN clauses and malformed queries.
  
  // Extract and deduplicate content IDs (defensive: filter out null/undefined/empty)
  const bookIds = [...new Set(
    plans
      .filter((p) => p.content_type === "book" && p.content_id && typeof p.content_id === "string")
      .map((p) => p.content_id as string)
  )];
  const lectureIds = [...new Set(
    plans
      .filter((p) => p.content_type === "lecture" && p.content_id && typeof p.content_id === "string")
      .map((p) => p.content_id as string)
  )];
  const customIds = [...new Set(
    plans
      .filter((p) => p.content_type === "custom" && p.content_id && typeof p.content_id === "string")
      .map((p) => p.content_id as string)
  )];

  // 공통 함수 사용하여 콘텐츠 조회
  const { books, lectures, customContents } = await getContentsByIds(
    bookIds,
    lectureIds,
    customIds,
    studentId,
    tenantId
  );

  // 데이터 enrich 시작 (메모리 연산만 측정, DB 쿼리는 별도 측정)
  // Step 1: Build maps (O(n) where n = content count)
  const contentMap = new Map<string, unknown>();
  books.forEach((book) => contentMap.set(`book:${book.id}`, book));
  lectures.forEach((lecture) => contentMap.set(`lecture:${lecture.id}`, lecture));
  customContents.forEach((custom) => contentMap.set(`custom:${custom.id}`, custom));

  // 진행률 조회 (최적화: 필요한 콘텐츠만 조회)
  // 필요한 콘텐츠의 (content_type, content_id) 쌍만 조회
  const contentKeys = new Set<string>();
  plans.forEach((plan) => {
    if (plan.content_type && plan.content_id) {
      contentKeys.add(`${plan.content_type}:${plan.content_id}`);
    }
  });

  let progressData: Array<{ content_type: string; content_id: string; progress: number | null }> = [];
  
  if (contentKeys.size > 0) {
    // 각 content_type별로 그룹화하여 쿼리
    const bookProgressIds: string[] = [];
    const lectureProgressIds: string[] = [];
    const customProgressIds: string[] = [];

    contentKeys.forEach((key) => {
      const [type, id] = key.split(":");
      if (type === "book") bookProgressIds.push(id);
      else if (type === "lecture") lectureProgressIds.push(id);
      else if (type === "custom") customProgressIds.push(id);
    });

    const progressQueries = [];
    if (bookProgressIds.length > 0) {
      progressQueries.push(
        supabase
          .from("student_content_progress")
          .select("content_type,content_id,progress")
          .eq("student_id", studentId)
          .eq("content_type", "book")
          .in("content_id", bookProgressIds)
      );
    }
    if (lectureProgressIds.length > 0) {
      progressQueries.push(
        supabase
          .from("student_content_progress")
          .select("content_type,content_id,progress")
          .eq("student_id", studentId)
          .eq("content_type", "lecture")
          .in("content_id", lectureProgressIds)
      );
    }
    if (customProgressIds.length > 0) {
      progressQueries.push(
        supabase
          .from("student_content_progress")
          .select("content_type,content_id,progress")
          .eq("student_id", studentId)
          .eq("content_type", "custom")
          .in("content_id", customProgressIds)
      );
    }

    if (progressQueries.length > 0) {
      const results = await Promise.all(progressQueries);
      results.forEach((result) => {
        if (result.data) {
          progressData.push(...result.data);
        }
      });
    }
  }

  // Step 2: Build progress map (O(n) where n = progress records)
  const progressMap = new Map<string, number | null>();
  progressData.forEach((row) => {
    if (row.content_type && row.content_id) {
      const key = `${row.content_type}:${row.content_id}`;
      progressMap.set(key, row.progress ?? null);
    }
  });

  // Wave 2: Queries that depend on plans (can run in parallel after plans are loaded)
  // - contents (books/lectures/custom) - already parallelized above
  // - progress (narrowed) - already parallelized above
  // - activeSessions (narrowed) - for plan execution state
  // - fullDaySessions (only if includeProgress) - for todayStudyMinutes calculation
  const planIds = plans.map((p) => p.id);
  const [activeSessionsResult, fullDaySessionsResult] = await Promise.all([
    // Query 1: Active sessions for plan execution state (narrowed to plan IDs)
    (async () => {
      let sessions: Array<{
        plan_id: string | null;
        started_at: string | null;
        paused_at: string | null;
        resumed_at: string | null;
        paused_duration_seconds: number | null;
      }> = [];
      
      if (planIds.length > 0) {
        const { data } = await supabase
          .from("student_study_sessions")
          .select("plan_id,started_at,paused_at,resumed_at,paused_duration_seconds")
          .eq("student_id", studentId)
          .in("plan_id", planIds.length > 0 ? planIds : ['dummy-id'])
          .is("ended_at", null);
        sessions = data ?? [];
      }
      return sessions;
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
  const activeSessions = activeSessionsResult;
  const fullDaySessions = fullDaySessionsResult;

  // Complete todayProgress calculation now that we have fullDaySessions
  if (includeProgress && todayProgress && fullDaySessions.length >= 0) {
    try {
      const activeSessionMap = buildActiveSessionMap(fullDaySessions);
      const nowMs = Date.now();
      const todayStudySeconds = plans.reduce((total, plan) => {
        return (
          total +
          calculatePlanStudySeconds(
            {
              actual_start_time: plan.actual_start_time,
              actual_end_time: plan.actual_end_time,
              total_duration_seconds: plan.total_duration_seconds,
              paused_duration_seconds: plan.paused_duration_seconds,
            },
            nowMs,
            plan.actual_end_time ? undefined : activeSessionMap.get(plan.id)
          )
        );
      }, 0);

      const todayStudyMinutes = Math.floor(todayStudySeconds / 60);

      // Calculate achievement score
      // (오늘 실행률 * 0.7) + (집중 타이머 누적/예상 * 0.3)
      const executionRate =
        todayProgress.planTotalCount > 0
          ? (todayProgress.planCompletedCount / todayProgress.planTotalCount) * 100
          : 0;

      const expectedMinutes = todayProgress.planTotalCount * 60;
      const focusTimerRate =
        expectedMinutes > 0
          ? Math.min((todayStudyMinutes / expectedMinutes) * 100, 100)
          : 0;

      const achievementScore = Math.round(
        executionRate * 0.7 + focusTimerRate * 0.3
      );

      todayProgress.todayStudyMinutes = todayStudyMinutes;
      todayProgress.achievementScore = achievementScore;
    } catch (error) {
      console.error("[data/todayPlans] 오늘 진행률 최종 계산 실패 (비차단)", error);
      // Keep partial progress data
    }
  }

  // Step 3: Build session map (O(n) where n = active sessions)
  const sessionMap = new Map<string, { 
    isPaused: boolean; 
    startedAt?: string | null;
    pausedAt?: string | null; 
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  }>();
  activeSessions?.forEach((session) => {
    if (session.plan_id) {
      const isPaused = !!session.paused_at && !session.resumed_at;
      sessionMap.set(session.plan_id, {
        isPaused,
        startedAt: session.started_at,
        pausedAt: session.paused_at,
        resumedAt: session.resumed_at,
        pausedDurationSeconds: session.paused_duration_seconds,
      });
    }
  });

  // Step 4: Attach content/progress/session to plans (O(n) where n = plans)
  // Optimized: Remove destructuring and spread operations for better performance
  
  // Helper function to exclude denormalized fields (more efficient than destructuring)
  const excludeFields = <T extends Record<string, any>>(
    obj: T,
    fieldsToExclude: Set<string>
  ): Omit<T, keyof T & string> => {
    const result: any = {};
    for (const key in obj) {
      if (!fieldsToExclude.has(key)) {
        result[key] = obj[key];
      }
    }
    return result;
  };

  const denormalizedFields = new Set([
    'content_title',
    'content_subject',
    'content_subject_category',
    'content_category'
  ]);

  const plansWithContent: PlanWithContent[] = plans.map((plan) => {
    // Pre-compute content key once per plan
    const contentKey = plan.content_type && plan.content_id 
      ? `${plan.content_type}:${plan.content_id}` 
      : null;
    
    // Direct Map lookups (O(1) each)
    const content = contentKey ? contentMap.get(contentKey) : undefined;
    const progress = contentKey ? (progressMap.get(contentKey) ?? null) : null;
    const session = sessionMap.get(plan.id);

    // Optimized: Use helper function for field exclusion (more efficient than destructuring)
    const planWithoutDenormalized = excludeFields(plan, denormalizedFields);

    // Optimized: Reuse session object from sessionMap (no need to recreate)
    // sessionMap already contains the properly formatted object
    // Optimized: Use Object.assign for better performance than spread
    const result = Object.assign({}, planWithoutDenormalized, {
      content: content as Book | Lecture | CustomContent | undefined,
      progress: progress ?? plan.progress ?? null,
      session: session,
    }) as PlanWithContent;

    return result;
  });

  // Step 5: Convert session map to object (O(n) where n = active sessions)
  const sessionsObj: Record<string, { 
    isPaused: boolean; 
    startedAt?: string | null;
    pausedAt?: string | null; 
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  }> = {};
  sessionMap.forEach((value, key) => {
    sessionsObj[key] = value;
  });

  const result: TodayPlansResponse = {
    plans: plansWithContent,
    sessions: sessionsObj,
    planDate: displayDate,
    isToday,
    serverNow: Date.now(),
    todayProgress: todayProgress ?? undefined,
  };

  // Cache store (if enabled and result is valid) - 디버그 모드에서만
  if (useCache && result) {
    const storeTimer = perfTime("[todayPlans] cache - store");
    try {
      const supabase = await createSupabaseServerClient();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (cacheTtlSeconds * 1000));
      
      // Use upsert with single UNIQUE constraint
      // Constraint: today_plans_cache_unique_key (tenant_id, student_id, plan_date, is_camp_mode)
      // Always use all 4 columns for onConflict, regardless of tenant_id being NULL or not
      const { error: cacheError } = await supabase
        .from("today_plans_cache")
        .upsert({
          tenant_id: tenantId ?? null,
          student_id: studentId,
          plan_date: targetDate,
          is_camp_mode: !!camp,
          payload: result,
          computed_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        }, {
          onConflict: "tenant_id,student_id,plan_date,is_camp_mode",
        });

      if (cacheError) {
        console.warn("[todayPlans] cache store error (non-blocking):", cacheError);
      }
    } catch (error) {
      console.warn("[todayPlans] cache store failed (non-blocking):", error);
      // Continue without caching - result is still valid
    }
    storeTimer.end();
  }

  return result;
}
