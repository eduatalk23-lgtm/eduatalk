import { getPlansForStudent } from "@/lib/data/studentPlans";
import {
  getBooks,
  getLectures,
  getCustomContents,
  type Book,
  type Lecture,
  type CustomContent,
} from "@/lib/data/studentContents";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanWithContent } from "@/app/(student)/today/_utils/planGroupUtils";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { calculateTodayProgress, type TodayProgress } from "@/lib/metrics/todayProgress";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIsoDate(value: string | null): string | null {
  if (!value || !ISO_DATE_REGEX.test(value)) {
    return null;
  }

  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : value;
}

export const dynamic = "force-dynamic";

type TodayPlansResponse = {
  plans: PlanWithContent[];
  sessions: Record<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
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

/**
 * 오늘의 플랜 조회 API
 * GET /api/today/plans?date=YYYY-MM-DD
 *
 * @returns
 * 성공: { success: true, data: TodayPlansResponse }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  console.time("[todayPlans] total");
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().slice(0, 10);

    const { searchParams } = new URL(request.url);
    const requestedDateParam = normalizeIsoDate(searchParams.get("date"));
    const targetDate = requestedDateParam ?? todayDate;
    const isCampMode = searchParams.get("camp") === "true";

    // 활성 플랜 그룹만 조회 (캠프 모드/일반 모드 필터링)
    console.time("[todayPlans] db - planGroups");
    let planGroupIds: string[] | undefined = undefined;
    const allActivePlanGroups = await getPlanGroupsForStudent({
      studentId: user.userId,
      tenantId: tenantContext?.tenantId || null,
      status: "active",
    });
    console.timeEnd("[todayPlans] db - planGroups");

    if (isCampMode) {
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
    console.time("[todayPlans] db - plans");
    let plans = await getPlansForStudent({
      studentId: user.userId,
      tenantId: tenantContext?.tenantId || null,
      planDate: targetDate,
      planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
    });
    console.timeEnd("[todayPlans] db - plans");

    let displayDate = targetDate;
    let isToday = targetDate === todayDate;

    // 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 찾기
    if (!requestedDateParam && plans.length === 0) {
      console.time("[todayPlans] db - futurePlans");
      const shortRangeEndDate = new Date(today);
      shortRangeEndDate.setDate(shortRangeEndDate.getDate() + 30);
      const shortRangeEndDateStr = shortRangeEndDate.toISOString().slice(0, 10);

      let futurePlans = await getPlansForStudent({
        studentId: user.userId,
        tenantId: tenantContext?.tenantId || null,
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
          studentId: user.userId,
          tenantId: tenantContext?.tenantId || null,
          dateRange: {
            start: todayDate,
            end: longRangeEndDateStr,
          },
          planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
        });
      }
      console.timeEnd("[todayPlans] db - futurePlans");

      if (futurePlans.length > 0) {
        const sortedPlans = futurePlans.sort((a, b) => {
          if (!a.plan_date || !b.plan_date) return 0;
          return a.plan_date.localeCompare(b.plan_date);
        });

        const nearestDate = sortedPlans[0].plan_date;
        if (nearestDate) {
          displayDate = nearestDate;
          isToday = false;
          plans = sortedPlans.filter((p) => p.plan_date === nearestDate);
        }
      }
    }

    // Calculate today progress in parallel (non-blocking, can fail silently)
    // This allows Today/Camp Today pages to avoid calling /api/today/progress separately
    let todayProgress: TodayProgress | null = null;
    if (includeProgress) {
      console.time("[todayPlans] db - todayProgress");
      try {
        // excludeCampMode: false for camp mode, true for regular mode
        todayProgress = await calculateTodayProgress(
          user.userId,
          tenantContext?.tenantId || null,
          targetDate,
          !isCampMode // excludeCampMode: true if NOT camp mode
        );
      } catch (error) {
        console.error("[api/today/plans] 오늘 진행률 계산 실패 (비차단)", error);
        // Non-blocking: continue without progress data
      }
      console.timeEnd("[todayPlans] db - todayProgress");
    }

    if (plans.length === 0) {
      console.timeEnd("[todayPlans] total");
      return apiSuccess<TodayPlansResponse>({
        plans: [],
        sessions: {},
        planDate: displayDate,
        isToday,
        todayProgress: todayProgress ?? undefined,
      });
    }

    // 콘텐츠 정보 조회 (최적화: 필요한 ID만 조회)
    // Note: First run can be slow (~59s) due to cold start, connection pooling, or index warmup.
    // Subsequent runs should be ~190ms. This code is hardened to prevent large IN clauses and malformed queries.
    console.time("[todayPlans] db - contents");
    const supabase = await createSupabaseServerClient();
    
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

    // Defensive: Limit IN clause size to prevent extremely large queries
    // Supabase typically handles up to 1000 items, but we cap at 500 for safety
    const MAX_IN_CLAUSE_SIZE = 500;
    const safeBookIds = bookIds.slice(0, MAX_IN_CLAUSE_SIZE);
    const safeLectureIds = lectureIds.slice(0, MAX_IN_CLAUSE_SIZE);
    const safeCustomIds = customIds.slice(0, MAX_IN_CLAUSE_SIZE);

    if (bookIds.length > MAX_IN_CLAUSE_SIZE) {
      console.warn(`[api/today/plans] bookIds truncated from ${bookIds.length} to ${MAX_IN_CLAUSE_SIZE}`);
    }
    if (lectureIds.length > MAX_IN_CLAUSE_SIZE) {
      console.warn(`[api/today/plans] lectureIds truncated from ${lectureIds.length} to ${MAX_IN_CLAUSE_SIZE}`);
    }
    if (customIds.length > MAX_IN_CLAUSE_SIZE) {
      console.warn(`[api/today/plans] customIds truncated from ${customIds.length} to ${MAX_IN_CLAUSE_SIZE}`);
    }

    // 필요한 콘텐츠만 직접 조회 (전체 조회 대신)
    // Split timing per content type to identify bottlenecks
    const [booksResult, lecturesResult, customContentsResult] = await Promise.all([
      safeBookIds.length > 0
        ? (async () => {
            console.time("[todayPlans] db - contents-books");
            try {
              const { data, error } = await supabase
                .from("books")
                .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,notes,created_at,updated_at")
                .eq("student_id", user.userId)
                .in("id", safeBookIds);
              console.timeEnd("[todayPlans] db - contents-books");
              if (error) {
                console.error("[api/today/plans] 책 조회 실패", error);
                return [];
              }
              return (data as Book[]) ?? [];
            } catch (err) {
              console.timeEnd("[todayPlans] db - contents-books");
              console.error("[api/today/plans] 책 조회 예외", err);
              return [];
            }
          })()
        : (() => {
            console.time("[todayPlans] db - contents-books");
            console.timeEnd("[todayPlans] db - contents-books");
            return Promise.resolve([]);
          })(),
      safeLectureIds.length > 0
        ? (async () => {
            console.time("[todayPlans] db - contents-lectures");
            try {
              const { data, error } = await supabase
                .from("lectures")
                .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,notes,created_at,updated_at")
                .eq("student_id", user.userId)
                .in("id", safeLectureIds);
              console.timeEnd("[todayPlans] db - contents-lectures");
              if (error) {
                console.error("[api/today/plans] 강의 조회 실패", error);
                return [];
              }
              return (data as Lecture[]) ?? [];
            } catch (err) {
              console.timeEnd("[todayPlans] db - contents-lectures");
              console.error("[api/today/plans] 강의 조회 예외", err);
              return [];
            }
          })()
        : (() => {
            console.time("[todayPlans] db - contents-lectures");
            console.timeEnd("[todayPlans] db - contents-lectures");
            return Promise.resolve([]);
          })(),
      safeCustomIds.length > 0
        ? (async () => {
            console.time("[todayPlans] db - contents-custom");
            try {
              const { data, error } = await supabase
                .from("student_custom_contents")
                .select("id,tenant_id,student_id,title,content_type,total_page_or_time,subject,created_at,updated_at")
                .eq("student_id", user.userId)
                .in("id", safeCustomIds);
              console.timeEnd("[todayPlans] db - contents-custom");
              if (error) {
                console.error("[api/today/plans] 커스텀 콘텐츠 조회 실패", error);
                return [];
              }
              return (data as CustomContent[]) ?? [];
            } catch (err) {
              console.timeEnd("[todayPlans] db - contents-custom");
              console.error("[api/today/plans] 커스텀 콘텐츠 조회 예외", err);
              return [];
            }
          })()
        : (() => {
            console.time("[todayPlans] db - contents-custom");
            console.timeEnd("[todayPlans] db - contents-custom");
            return Promise.resolve([]);
          })(),
    ]);
    const books = booksResult;
    const lectures = lecturesResult;
    const customContents = customContentsResult;
    console.timeEnd("[todayPlans] db - contents");

    // 데이터 enrich 시작
    console.time("[todayPlans] enrich");
    
    // Step 1: Build maps (O(n) where n = content count)
    console.time("[todayPlans] enrich - buildMaps");
    const contentMap = new Map<string, unknown>();
    books.forEach((book) => contentMap.set(`book:${book.id}`, book));
    lectures.forEach((lecture) => contentMap.set(`lecture:${lecture.id}`, lecture));
    customContents.forEach((custom) => contentMap.set(`custom:${custom.id}`, custom));
    console.timeEnd("[todayPlans] enrich - buildMaps");

    // 진행률 조회 (최적화: 필요한 콘텐츠만 조회)
    console.time("[todayPlans] db - progress (narrowed)");
    
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
            .eq("student_id", user.userId)
            .eq("content_type", "book")
            .in("content_id", bookProgressIds)
        );
      }
      if (lectureProgressIds.length > 0) {
        progressQueries.push(
          supabase
            .from("student_content_progress")
            .select("content_type,content_id,progress")
            .eq("student_id", user.userId)
            .eq("content_type", "lecture")
            .in("content_id", lectureProgressIds)
        );
      }
      if (customProgressIds.length > 0) {
        progressQueries.push(
          supabase
            .from("student_content_progress")
            .select("content_type,content_id,progress")
            .eq("student_id", user.userId)
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
    console.timeEnd("[todayPlans] db - progress (narrowed)");

    // Step 2: Build progress map (O(n) where n = progress records)
    console.time("[todayPlans] enrich - buildProgressMap");
    const progressMap = new Map<string, number | null>();
    progressData.forEach((row) => {
      if (row.content_type && row.content_id) {
        const key = `${row.content_type}:${row.content_id}`;
        progressMap.set(key, row.progress ?? null);
      }
    });
    console.timeEnd("[todayPlans] enrich - buildProgressMap");

    // 활성 세션 조회 (최적화: 해당 플랜의 세션만 조회)
    console.time("[todayPlans] db - sessions (narrowed)");
    const planIds = plans.map((p) => p.id);
    let activeSessions: Array<{
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
        .eq("student_id", user.userId)
        .in("plan_id", planIds)
        .is("ended_at", null);
      activeSessions = data ?? [];
    }
    console.timeEnd("[todayPlans] db - sessions (narrowed)");

    // Step 3: Build session map (O(n) where n = active sessions)
    console.time("[todayPlans] enrich - buildSessionMap");
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
    console.timeEnd("[todayPlans] enrich - buildSessionMap");

    // Step 4: Attach content/progress/session to plans (O(n) where n = plans)
    // Optimized: Pre-compute content keys to avoid repeated string concatenation
    console.time("[todayPlans] enrich - attachToPlans");
    const plansWithContent: PlanWithContent[] = plans.map((plan) => {
      // Pre-compute content key once per plan
      const contentKey = plan.content_type && plan.content_id 
        ? `${plan.content_type}:${plan.content_id}` 
        : null;
      
      // Direct Map lookups (O(1) each)
      const content = contentKey ? contentMap.get(contentKey) : undefined;
      const progress = contentKey ? (progressMap.get(contentKey) ?? null) : null;
      const session = sessionMap.get(plan.id);

      // denormalized 필드 제거 (destructuring is O(k) where k = field count, but k is constant)
      const {
        content_title,
        content_subject,
        content_subject_category,
        content_category,
        ...planWithoutDenormalized
      } = plan;

      // Build session object only if session exists (avoid unnecessary object creation)
      const sessionObj = session ? {
        isPaused: session.isPaused,
        startedAt: session.startedAt,
        pausedAt: session.pausedAt,
        resumedAt: session.resumedAt,
        pausedDurationSeconds: session.pausedDurationSeconds,
      } : undefined;

      return {
        ...planWithoutDenormalized,
        content: content as Book | Lecture | CustomContent | undefined,
        progress,
        session: sessionObj,
      };
    });
    console.timeEnd("[todayPlans] enrich - attachToPlans");

    // Step 5: Convert session map to object (O(n) where n = active sessions)
    console.time("[todayPlans] enrich - finalize");
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
    console.timeEnd("[todayPlans] enrich - finalize");
    console.timeEnd("[todayPlans] enrich");

    // 응답 직렬화
    console.time("[todayPlans] serialize");
    // 서버 현재 시간 추가
    const serverNow = Date.now();

    const response = apiSuccess<TodayPlansResponse>({
      plans: plansWithContent,
      sessions: sessionsObj,
      planDate: displayDate,
      isToday,
      serverNow,
      todayProgress: todayProgress ?? undefined,
    });
    console.timeEnd("[todayPlans] serialize");
    console.timeEnd("[todayPlans] total");
    return response;
  } catch (error) {
    console.timeEnd("[todayPlans] total");
    return handleApiError(error, "[api/today/plans] 오류");
  }
}
