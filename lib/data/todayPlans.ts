import { getPlansForStudent } from "@/lib/data/studentPlans";
import type { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanWithContent } from "@/app/(student)/today/_utils/planGroupUtils";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";

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
};

export type GetTodayPlansOptions = {
  studentId: string;
  tenantId: string | null;
  date?: string | null;
  camp?: boolean;
  /**
   * If true, narrows progress and session queries to only the plans in the result set.
   * This optimization reduces query time when the student has many progress records or active sessions.
   */
  narrowQueries?: boolean;
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
  const { studentId, tenantId, date, camp = false, narrowQueries = false } = options;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);
  
  const requestedDateParam = normalizeIsoDate(date ?? null);
  const targetDate = requestedDateParam ?? todayDate;

  // 활성 플랜 그룹만 조회 (캠프 모드/일반 모드 필터링)
  const allActivePlanGroups = await getPlanGroupsForStudent({
    studentId,
    tenantId,
    status: "active",
  });

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
        plans = sortedPlans.filter((p) => p.plan_date === nearestDate);
      }
    }
  }

  if (plans.length === 0) {
    return {
      plans: [],
      sessions: {},
      planDate: displayDate,
      isToday,
      serverNow: Date.now(),
    };
  }

  // 콘텐츠 정보 조회 (최적화: 필요한 ID만 조회)
  const bookIds = [...new Set(
    plans
      .filter((p) => p.content_type === "book" && p.content_id)
      .map((p) => p.content_id as string)
  )];
  const lectureIds = [...new Set(
    plans
      .filter((p) => p.content_type === "lecture" && p.content_id)
      .map((p) => p.content_id as string)
  )];
  const customIds = [...new Set(
    plans
      .filter((p) => p.content_type === "custom" && p.content_id)
      .map((p) => p.content_id as string)
  )];

  const supabase = await createSupabaseServerClient();

  // 필요한 콘텐츠만 직접 조회 (전체 조회 대신)
  const [booksResult, lecturesResult, customContentsResult] = await Promise.all([
    bookIds.length > 0
      ? supabase
          .from("books")
          .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,notes,created_at,updated_at")
          .eq("student_id", studentId)
          .in("id", bookIds)
          .then(({ data, error }) => {
            if (error) {
              console.error("[data/todayPlans] 책 조회 실패", error);
              return [];
            }
            return (data as Book[]) ?? [];
          })
      : Promise.resolve([]),
    lectureIds.length > 0
      ? supabase
          .from("lectures")
          .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,notes,created_at,updated_at")
          .eq("student_id", studentId)
          .in("id", lectureIds)
          .then(({ data, error }) => {
            if (error) {
              console.error("[data/todayPlans] 강의 조회 실패", error);
              return [];
            }
            return (data as Lecture[]) ?? [];
          })
      : Promise.resolve([]),
    customIds.length > 0
      ? supabase
          .from("student_custom_contents")
          .select("id,tenant_id,student_id,title,content_type,total_page_or_time,subject,created_at,updated_at")
          .eq("student_id", studentId)
          .in("id", customIds)
          .then(({ data, error }) => {
            if (error) {
              console.error("[data/todayPlans] 커스텀 콘텐츠 조회 실패", error);
              return [];
            }
            return (data as CustomContent[]) ?? [];
          })
      : Promise.resolve([]),
  ]);
  const books = booksResult;
  const lectures = lecturesResult;
  const customContents = customContentsResult;

  // 데이터 enrich 시작
  const contentMap = new Map<string, unknown>();
  books.forEach((book) => contentMap.set(`book:${book.id}`, book));
  lectures.forEach((lecture) => contentMap.set(`lecture:${lecture.id}`, lecture));
  customContents.forEach((custom) => contentMap.set(`custom:${custom.id}`, custom));

  // 진행률 조회 (최적화: 필요한 콘텐츠만 조회)
  let progressData: Array<{ content_type: string; content_id: string; progress: number | null }> = [];
  
  if (narrowQueries && plans.length > 0) {
    // 필요한 콘텐츠의 (content_type, content_id) 쌍만 조회
    const contentKeys = new Set<string>();
    plans.forEach((plan) => {
      if (plan.content_type && plan.content_id) {
        contentKeys.add(`${plan.content_type}:${plan.content_id}`);
      }
    });

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
  } else {
    // 기존 방식: 모든 진행률 조회
    const { data } = await supabase
      .from("student_content_progress")
      .select("content_type,content_id,progress")
      .eq("student_id", studentId);
    progressData = data ?? [];
  }

  const progressMap = new Map<string, number | null>();
  progressData.forEach((row) => {
    if (row.content_type && row.content_id) {
      const key = `${row.content_type}:${row.content_id}`;
      progressMap.set(key, row.progress ?? null);
    }
  });

  // 활성 세션 조회 (최적화: 필요한 플랜 ID만 조회)
  let activeSessions: Array<{
    plan_id: string | null;
    started_at: string | null;
    paused_at: string | null;
    resumed_at: string | null;
    paused_duration_seconds: number | null;
  }> = [];

  if (narrowQueries && plans.length > 0) {
    // 해당 플랜의 세션만 조회
    const planIds = plans.map((p) => p.id);
    const { data } = await supabase
      .from("student_study_sessions")
      .select("plan_id,started_at,paused_at,resumed_at,paused_duration_seconds")
      .eq("student_id", studentId)
      .in("plan_id", planIds)
      .is("ended_at", null);
    activeSessions = data ?? [];
  } else {
    // 기존 방식: 모든 활성 세션 조회
    const { data } = await supabase
      .from("student_study_sessions")
      .select("plan_id,started_at,paused_at,resumed_at,paused_duration_seconds")
      .eq("student_id", studentId)
      .is("ended_at", null);
    activeSessions = data ?? [];
  }

  const sessionMap = new Map<string, {
    isPaused: boolean;
    startedAt?: string | null;
    pausedAt?: string | null;
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  }>();
  activeSessions.forEach((session) => {
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

  // 플랜 데이터를 PlanWithContent 형식으로 변환
  const plansWithContent: PlanWithContent[] = plans.map((plan) => {
    const contentKey = `${plan.content_type}:${plan.content_id}`;
    const content = contentMap.get(contentKey);
    const progress = progressMap.get(contentKey) ?? null;
    const session = sessionMap.get(plan.id);

    // denormalized 필드 제거
    const {
      content_title,
      content_subject,
      content_subject_category,
      content_category,
      ...planWithoutDenormalized
    } = plan;

    return {
      ...planWithoutDenormalized,
      content: content as Book | Lecture | CustomContent | undefined,
      progress,
      session: session ? {
        isPaused: session.isPaused,
        startedAt: session.startedAt,
        pausedAt: session.pausedAt,
        resumedAt: session.resumedAt,
        pausedDurationSeconds: session.pausedDurationSeconds,
      } : undefined,
    };
  });

  // 세션 데이터를 객체로 변환
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

  return {
    plans: plansWithContent,
    sessions: sessionsObj,
    planDate: displayDate,
    isToday,
    serverNow: Date.now(),
  };
}

