import { getPlansForStudent, type Plan, buildPlanQuery } from "@/lib/data/studentPlans";
import type { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanWithContent } from "@/app/(student)/today/_utils/planGroupUtils";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import type { TodayProgress } from "@/lib/metrics/todayProgress";
import {
  getSessionsInRange,
  getActiveSessionsForPlans,
  type StudySession,
} from "@/lib/data/studentSessions";
import {
  calculatePlanStudySeconds,
  buildActiveSessionMap,
} from "@/lib/metrics/studyTime";
import { perfTime } from "@/lib/utils/perfLog";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import {
  createTypedQuery,
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIsoDate(value: string | null): string | null {
  if (!value || !ISO_DATE_REGEX.test(value)) {
    return null;
  }
  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : value;
}

/**
 * View를 사용하여 플랜 조회 (콘텐츠 정보 포함)
 * today_plan_view를 사용하여 Application-side Join을 제거
 *
 * View가 없거나 에러 발생 시 자동으로 getPlansForStudent()로 fallback
 */
async function getPlansFromView(options: {
  studentId: string;
  tenantId: string | null;
  planDate?: string;
  dateRange?: { start: string; end: string };
  planGroupIds?: string[];
}): Promise<Plan[]> {
  const supabase = await createSupabaseServerClient();

  // planGroupIds 유효성 검사
  if (options.planGroupIds && options.planGroupIds.length > 0) {
    const validGroupIds = options.planGroupIds.filter(
      (id) => id && typeof id === "string" && id.trim().length > 0
    );
    if (validGroupIds.length === 0) {
      return [];
    }
  }

  // View 결과 타입 정의
  type ViewPlanRow = Record<string, unknown> & {
    id: string;
    tenant_id: string;
    student_id: string;
    plan_date: string;
    block_index: number;
    content_type: "custom" | "book" | "lecture";
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    progress: number | null;
    is_reschedulable: boolean;
    plan_group_id: string;
    start_time: string | null;
    end_time: string | null;
    actual_start_time: string | null;
    actual_end_time: string | null;
    total_duration_seconds: number | null;
    paused_duration_seconds: number | null;
    pause_count: number | null;
    plan_number: number | null;
    sequence: number | null;
    day_type: string | null;
    week: number | null;
    day: number | null;
    is_partial: boolean | null;
    is_continued: boolean | null;
    content_title: string | null;
    content_subject: string | null;
    content_subject_category: string | null;
    content_category: string | null;
    view_content_title: string | null;
    view_content_subject: string | null;
    view_content_subject_category: string | null;
    view_content_category: string | null;
    memo: string | null;
    created_at: string;
    updated_at: string | null;
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
      student_id: row.student_id,
      plan_date: row.plan_date,
      block_index: row.block_index,
      content_type: row.content_type,
      content_id: row.content_id,
      chapter: row.chapter,
      planned_start_page_or_time: row.planned_start_page_or_time,
      planned_end_page_or_time: row.planned_end_page_or_time,
      completed_amount: row.completed_amount,
      progress: row.progress,
      is_reschedulable: row.is_reschedulable,
      plan_group_id: row.plan_group_id,
      start_time: row.start_time,
      end_time: row.end_time,
      actual_start_time: row.actual_start_time,
      actual_end_time: row.actual_end_time,
      total_duration_seconds: row.total_duration_seconds,
      paused_duration_seconds: row.paused_duration_seconds,
      pause_count: row.pause_count,
      plan_number: row.plan_number,
      sequence: row.sequence,
      day_type: row.day_type,
      week: row.week,
      day: row.day,
      is_partial: row.is_partial,
      is_continued: row.is_continued,
      // denormalized 필드: 우선순위는 content_title > view_content_title
      content_title: row.content_title || row.view_content_title || null,
      content_subject: row.content_subject || row.view_content_subject || null,
      content_subject_category:
        row.content_subject_category || row.view_content_subject_category || null,
      content_category: row.content_category || row.view_content_category || null,
      memo: row.memo,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  return plans;
}

export type TodayPlansResponse = {
  plans: PlanWithContent[];
  sessions: Record<
    string,
    {
      isPaused: boolean;
      startedAt?: string | null;
      pausedAt?: string | null;
      resumedAt?: string | null;
      pausedDurationSeconds?: number | null;
    }
  >;
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
    cacheTtlSeconds = 120,
  } = options;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  const requestedDateParam = normalizeIsoDate(date ?? null);
  const targetDate = requestedDateParam ?? todayDate;

  // Supabase 클라이언트를 함수 시작 부분에서 한 번만 생성하여 재사용
  // 모든 블록(캐시 조회, 진행률 조회, 캐시 저장)에서 동일한 클라이언트 사용
  const supabase = await createSupabaseServerClient();

  // Cache lookup (if enabled) - 디버그 모드에서만
  if (useCache) {
    const lookupTimer = perfTime("[todayPlans] cache - lookup");
    try {
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

      const { data: cacheRow, error: cacheError } =
        await cacheQuery.maybeSingle();

      if (!cacheError && cacheRow) {
        lookupTimer.end();
        // Return cached result
        return cacheRow.payload as TodayPlansResponse;
      }

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

  // 선택한 날짜 플랜 조회 (View 사용으로 최적화)
  // today_plan_view를 통해 콘텐츠 정보가 이미 조인되어 있음
  let plans = await getPlansFromView({
    studentId,
    tenantId,
    planDate: targetDate,
    planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
  });

  let displayDate = targetDate;
  let isToday = targetDate === todayDate;

  // 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 찾기
  // 최적화: 30일/180일 범위를 병렬로 조회하여 순차 대기 시간 제거
  if (!requestedDateParam && plans.length === 0) {
    const shortRangeEndDate = new Date(today);
    shortRangeEndDate.setDate(shortRangeEndDate.getDate() + 30);
    const shortRangeEndDateStr = shortRangeEndDate.toISOString().slice(0, 10);

    const longRangeEndDate = new Date(today);
    longRangeEndDate.setDate(longRangeEndDate.getDate() + 180);
    const longRangeEndDateStr = longRangeEndDate.toISOString().slice(0, 10);

    // 병렬로 30일, 180일 범위 동시 조회
    const [shortRangePlans, longRangePlans] = await Promise.all([
      getPlansFromView({
        studentId,
        tenantId,
        dateRange: {
          start: todayDate,
          end: shortRangeEndDateStr,
        },
        planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
      }),
      getPlansFromView({
        studentId,
        tenantId,
        dateRange: {
          start: shortRangeEndDateStr, // 30일 이후부터 180일까지만 조회 (중복 방지)
          end: longRangeEndDateStr,
        },
        planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
      }),
    ]);

    // 30일 내 결과 우선, 없으면 180일 결과 사용
    const futurePlans = shortRangePlans.length > 0 ? shortRangePlans : longRangePlans;

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
      const planCompletedCount = plans.filter(
        (plan) => !!plan.actual_end_time
      ).length;

      // We'll compute todayStudyMinutes and achievementScore after fullDaySessions are loaded
      // Store intermediate values for later computation
      todayProgress = {
        todayStudyMinutes: 0, // Will be computed after sessions are loaded
        planCompletedCount,
        planTotalCount,
        achievementScore: 0, // Will be computed after todayStudyMinutes is known
      };
    } catch (error) {
      handleQueryError(error as { code?: string } | null, {
        context: "[data/todayPlans] 오늘 진행률 계산",
        logError: false, // Non-blocking이므로 warn 레벨로만 로깅
      });
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

  // 콘텐츠 정보는 View를 통해 조인되어 있음 (today_plan_view)
  // 별도의 콘텐츠 조회 쿼리 불필요 (Application-side Join 제거)

  // Wave 2: Queries that depend on plans (can run in parallel after plans are loaded)
  // - progress (narrowed) - for content progress
  // - activeSessions (narrowed) - for plan execution state
  // - fullDaySessions (only if includeProgress) - for todayStudyMinutes calculation
  const planIds = plans.map((p) => p.id);
  
  // 진행률 조회를 위한 콘텐츠 키 수집
  const contentKeys = new Set<string>();
  plans.forEach((plan) => {
    if (plan.content_type && plan.content_id) {
      contentKeys.add(`${plan.content_type}:${plan.content_id}`);
    }
  });

  const allContentIds: string[] = [];
  contentKeys.forEach((key) => {
    const [, id] = key.split(":");
    if (id) allContentIds.push(id);
  });

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

  // Build progress map (O(n) where n = progress records)
  const progressData = progressResult;
  const progressMap = new Map<string, number | null>();
  progressData.forEach((row) => {
    if (row.content_type && row.content_id) {
      const key = `${row.content_type}:${row.content_id}`;
      progressMap.set(key, row.progress ?? null);
    }
  });

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
          ? (todayProgress.planCompletedCount / todayProgress.planTotalCount) *
            100
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
      handleQueryError(error as { code?: string } | null, {
        context: "[data/todayPlans] 오늘 진행률 최종 계산",
        logError: false, // Non-blocking이므로 warn 레벨로만 로깅
      });
      // Keep partial progress data
    }
  }

  // Step 3: Build session map (O(n) where n = active sessions)
  const sessionMap = new Map<
    string,
    {
      isPaused: boolean;
      startedAt?: string | null;
      pausedAt?: string | null;
      resumedAt?: string | null;
      pausedDurationSeconds?: number | null;
    }
  >();
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
  const excludeFields = <T extends Record<string, unknown>>(
    obj: T,
    fieldsToExclude: Set<string>
  ): Partial<T> => {
    const result: Partial<T> = {};
    for (const key in obj) {
      if (!fieldsToExclude.has(key)) {
        result[key] = obj[key];
      }
    }
    return result;
  };

  const denormalizedFields = new Set([
    "content_title",
    "content_subject",
    "content_subject_category",
    "content_category",
  ]);

  // View를 통해 가져온 정보를 사용하여 content 객체 생성
  const plansWithContent: PlanWithContent[] = plans.map((plan) => {
    const contentKey =
      plan.content_type && plan.content_id
        ? `${plan.content_type}:${plan.content_id}`
        : null;

    // Progress는 여전히 별도 조회 필요 (student_content_progress 테이블)
    const progress = contentKey ? progressMap.get(contentKey) ?? null : null;
    const session = sessionMap.get(plan.id);

    // View에서 가져온 정보를 사용하여 content 객체 생성
    // denormalized 필드가 이미 plan에 포함되어 있음
    let content: Book | Lecture | CustomContent | undefined = undefined;
    if (plan.content_id && plan.content_title) {
      const baseContent = {
        id: plan.content_id,
        tenant_id: plan.tenant_id || null,
        student_id: plan.student_id,
        title: plan.content_title,
        subject: plan.content_subject || null,
        created_at: plan.created_at || null,
        updated_at: plan.updated_at || null,
      };

      if (plan.content_type === "book") {
        content = {
          ...baseContent,
          revision: null,
          semester: null,
          subject_category: plan.content_subject_category || null,
          publisher: null,
          difficulty_level: null,
          total_pages: null,
          notes: null,
        } as Book;
      } else if (plan.content_type === "lecture") {
        content = {
          ...baseContent,
          revision: null,
          semester: null,
          subject_category: plan.content_subject_category || null,
          platform: null,
          difficulty_level: null,
          duration: null,
          notes: null,
        } as Lecture;
      } else if (plan.content_type === "custom") {
        content = {
          ...baseContent,
          content_type: null,
          total_page_or_time: null,
        } as CustomContent;
      }
    }

    // Optimized: Use helper function for field exclusion (more efficient than destructuring)
    const planWithoutDenormalized = excludeFields(plan, denormalizedFields);

    // Optimized: Use Object.assign for better performance than spread
    const result = Object.assign({}, planWithoutDenormalized, {
      content: content,
      progress: progress ?? plan.progress ?? null,
      session: session,
    }) as PlanWithContent;

    return result;
  });

  // Step 5: Convert session map to object (O(n) where n = active sessions)
  const sessionsObj: Record<
    string,
    {
      isPaused: boolean;
      startedAt?: string | null;
      pausedAt?: string | null;
      resumedAt?: string | null;
      pausedDurationSeconds?: number | null;
    }
  > = {};
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
      const now = new Date();
      const expiresAt = new Date(now.getTime() + cacheTtlSeconds * 1000);

      // Use upsert with single UNIQUE constraint
      // Constraint: today_plans_cache_unique_key (tenant_id, student_id, plan_date, is_camp_mode)
      // Always use all 4 columns for onConflict, regardless of tenant_id being NULL or not
      const { error: cacheError } = await supabase
        .from("today_plans_cache")
        .upsert(
          {
            tenant_id: tenantId ?? null,
            student_id: studentId,
            plan_date: targetDate,
            is_camp_mode: !!camp,
            payload: result,
            computed_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            updated_at: now.toISOString(),
          },
          {
            onConflict: "tenant_id,student_id,plan_date,is_camp_mode",
          }
        );

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
    storeTimer.end();
  }

  return result;
}
