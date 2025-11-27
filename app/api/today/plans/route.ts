import { getPlansForStudent } from "@/lib/data/studentPlans";
import {
  getBooks,
  getLectures,
  getCustomContents,
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
    let planGroupIds: string[] | undefined = undefined;
    const allActivePlanGroups = await getPlanGroupsForStudent({
      studentId: user.userId,
      tenantId: tenantContext?.tenantId || null,
      status: "active",
    });

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
    let plans = await getPlansForStudent({
      studentId: user.userId,
      tenantId: tenantContext?.tenantId || null,
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
      return apiSuccess<TodayPlansResponse>({
        plans: [],
        sessions: {},
        planDate: displayDate,
        isToday,
      });
    }

    // 콘텐츠 정보 조회
    const bookIds = plans
      .filter((p) => p.content_type === "book" && p.content_id)
      .map((p) => p.content_id);
    const lectureIds = plans
      .filter((p) => p.content_type === "lecture" && p.content_id)
      .map((p) => p.content_id);
    const customIds = plans
      .filter((p) => p.content_type === "custom" && p.content_id)
      .map((p) => p.content_id);

    const [books, lectures, customContents] = await Promise.all([
      bookIds.length > 0
        ? getBooks(user.userId, tenantContext?.tenantId || null)
        : Promise.resolve([]),
      lectureIds.length > 0
        ? getLectures(user.userId, tenantContext?.tenantId || null)
        : Promise.resolve([]),
      customIds.length > 0
        ? getCustomContents(user.userId, tenantContext?.tenantId || null)
        : Promise.resolve([]),
    ]);

    const contentMap = new Map<string, unknown>();
    books.forEach((book) => contentMap.set(`book:${book.id}`, book));
    lectures.forEach((lecture) => contentMap.set(`lecture:${lecture.id}`, lecture));
    customContents.forEach((custom) => contentMap.set(`custom:${custom.id}`, custom));

    // 진행률 조회
    const supabase = await createSupabaseServerClient();
    const { data: progressData } = await supabase
      .from("student_content_progress")
      .select("content_type,content_id,progress")
      .eq("student_id", user.userId);

    const progressMap = new Map<string, number | null>();
    progressData?.forEach((row) => {
      if (row.content_type && row.content_id) {
        const key = `${row.content_type}:${row.content_id}`;
        progressMap.set(key, row.progress ?? null);
      }
    });

    // 활성 세션 조회
    const { data: activeSessions } = await supabase
      .from("student_study_sessions")
      .select("plan_id,paused_at,resumed_at")
      .eq("student_id", user.userId)
      .is("ended_at", null);

    const sessionMap = new Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>();
    activeSessions?.forEach((session) => {
      if (session.plan_id) {
        const isPaused = !!session.paused_at && !session.resumed_at;
        sessionMap.set(session.plan_id, {
          isPaused,
          pausedAt: session.paused_at,
          resumedAt: session.resumed_at,
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
        content,
        progress,
        session: session ? {
          isPaused: session.isPaused,
          pausedAt: session.pausedAt,
          resumedAt: session.resumedAt,
        } : undefined,
      };
    });

    // 세션 데이터를 객체로 변환
    const sessionsObj: Record<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }> = {};
    sessionMap.forEach((value, key) => {
      sessionsObj[key] = value;
    });

    return apiSuccess<TodayPlansResponse>({
      plans: plansWithContent,
      sessions: sessionsObj,
      planDate: displayDate,
      isToday,
    });
  } catch (error) {
    return handleApiError(error, "[api/today/plans] 오류");
  }
}
