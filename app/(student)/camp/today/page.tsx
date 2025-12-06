export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { TodayHeader } from "@/app/(student)/today/_components/TodayHeader";
import { TodayPageContent } from "@/app/(student)/today/_components/TodayPageContent";
import { CurrentLearningSection } from "@/app/(student)/today/_components/CurrentLearningSection";
import { CompletionToast } from "@/app/(student)/today/_components/CompletionToast";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "@/lib/data/campTemplates";
import { getPlanById } from "@/lib/data/studentPlans";
import { getTodayPlans } from "@/lib/data/todayPlans";

type CampTodayPageProps = {
  searchParams?:
    | ReadonlyURLSearchParams
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | Promise<
        | ReadonlyURLSearchParams
        | URLSearchParams
        | Record<string, string | string[] | undefined>
      >;
};

export default async function CampTodayPage({ searchParams }: CampTodayPageProps) {
  console.time("[camp/today] total");
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  const user = await getCurrentUser();
  const tenantContext = await getTenantContext();

  const resolveSearchParams = async () => {
    if (
      searchParams &&
      typeof (searchParams as Promise<unknown>)?.then === "function"
    ) {
      return (await searchParams) as
        | ReadonlyURLSearchParams
        | URLSearchParams
        | Record<string, string | string[] | undefined>
        | undefined;
    }
    return searchParams;
  };

  const resolvedSearchParams = await resolveSearchParams();

  const isSearchParamsLike = (
    value: unknown
  ): value is URLSearchParams | ReadonlyURLSearchParams => {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as URLSearchParams).get === "function"
    );
  };

  const normalizeParam = (
    value: string | string[] | undefined | null
  ): string | undefined => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value ?? undefined;
  };

  const getParam = (key: string): string | undefined => {
    if (isSearchParamsLike(resolvedSearchParams)) {
      return resolvedSearchParams.get(key) ?? undefined;
    }
    if (
      resolvedSearchParams &&
      typeof resolvedSearchParams === "object" &&
      !Array.isArray(resolvedSearchParams)
    ) {
      const record = resolvedSearchParams as Record<
        string,
        string | string[] | undefined
      >;
      return normalizeParam(record[key]);
    }
    return undefined;
  };

  const dateParam = getParam("date");
  const viewParam = getParam("view");
  const completedPlanIdParam = getParam("completedPlanId");

  const requestedDate =
    typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : undefined;

  const requestedView =
    viewParam === "single" || viewParam === "daily" ? viewParam : "daily";

  // 오늘 날짜 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  const targetProgressDate = requestedDate ?? todayDate;

  // 활성화된 캠프 플랜 그룹 확인
  console.time("[camp/today] db - planGroups");
  const supabase = await createSupabaseServerClient();
  const allActivePlanGroups = await getPlanGroupsForStudent({
    studentId: userId,
    status: "active",
  });
  console.timeEnd("[camp/today] db - planGroups");

  // 캠프 모드 플랜 그룹만 필터링
  const campModePlanGroups = allActivePlanGroups.filter(
    (group) =>
      group.plan_type === "camp" ||
      group.camp_template_id !== null ||
      group.camp_invitation_id !== null
  );

  // 템플릿 존재 여부 확인 (삭제된 템플릿의 플랜 그룹 제외)
  console.time("[camp/today] db - templates");
  const activeCampPlanGroups = await Promise.all(
    campModePlanGroups.map(async (group) => {
      // camp_template_id가 있는 경우 템플릿 존재 여부 확인
      if (group.camp_template_id) {
        const template = await getCampTemplate(group.camp_template_id);
        // 템플릿이 존재하지 않으면 null 반환 (필터링됨)
        return template ? group : null;
      }
      // camp_template_id가 없으면 그대로 반환
      return group;
    })
  ).then((groups) => groups.filter((group): group is NonNullable<typeof group> => group !== null));
  console.timeEnd("[camp/today] db - templates");

  // 활성 캠프 플랜 그룹이 없을 때 안내 메시지 표시
  if (activeCampPlanGroups.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">캠프 학습관리</h1>
              <p className="text-sm text-gray-600 mt-1">
                캠프 플랜을 확인하고 학습을 진행하세요
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <div className="mx-auto flex max-w-md flex-col gap-4">
              <div className="text-6xl">🏕️</div>
              <h3 className="text-lg font-semibold text-gray-900">
                활성화된 캠프 플랜 그룹이 없습니다
              </h3>
              <p className="text-sm text-gray-500">
                캠프 프로그램에 참여하고 플랜이 활성화되면 여기서 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 완료된 플랜 정보 조회 (토스트용)
  let completedPlanTitle: string | null = null;
  if (completedPlanIdParam) {
    console.time("[camp/today] db - completedPlan");
    try {
      const completedPlan = await getPlanById(
        completedPlanIdParam,
        userId,
        tenantContext?.tenantId || null
      );
      if (completedPlan) {
        completedPlanTitle = completedPlan.content_title || null;
      }
    } catch (error) {
      console.error("[CampTodayPage] 완료된 플랜 정보 조회 실패", error);
    }
    console.timeEnd("[camp/today] db - completedPlan");
  }

  // Single server-side fetch for today's plans to avoid double-fetch
  // TodayPageContent is rendered twice (main + sidebar), and without this,
  // each instance would trigger its own client-side fetch via PlanViewContainer
  // This also includes todayProgress calculation, eliminating the need for a separate progress query
  console.time("[camp/today] db - todayPlans");
  const todayPlansData = await getTodayPlans({
    studentId: userId,
    tenantId: tenantContext?.tenantId || null,
    date: requestedDate,
    camp: true,
    includeProgress: true, // Include progress to avoid separate /api/today/progress call
    narrowQueries: true, // Optimize: only fetch progress/sessions for relevant plans
  });
  console.timeEnd("[camp/today] db - todayPlans");

  // Extract todayProgress from the result (computed in-memory, no additional DB query)
  // This replaces the previous ~0.6-1.28s calculateTodayProgress call
  const todayProgress: TodayProgress = todayPlansData.todayProgress ?? {
    todayStudyMinutes: 0,
    planCompletedCount: 0,
    planTotalCount: 0,
    goalProgressSummary: [],
    achievementScore: 0,
  };

  console.timeEnd("[camp/today] total");
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">캠프 학습관리</h1>
            <p className="text-sm text-gray-600 mt-1">
              캠프 플랜을 확인하고 학습을 진행하세요
            </p>
          </div>
        </div>
        <CurrentLearningSection campMode={true} />
        <CompletionToast completedPlanId={completedPlanIdParam} planTitle={completedPlanTitle} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <TodayPageContent
              initialMode={requestedView}
              initialPlanDate={requestedDate}
              initialProgressDate={targetProgressDate}
              initialProgress={todayProgress}
              showAchievements={false}
              userId={userId}
              campMode={true}
              initialPlansData={todayPlansData}
            />
          </div>
          <div className="lg:col-span-4">
            <div className="sticky top-6 flex flex-col gap-4">
              <TodayPageContent
                initialMode={requestedView}
                initialPlanDate={requestedDate}
                initialProgressDate={targetProgressDate}
                initialProgress={todayProgress}
                showPlans={false}
                userId={userId}
                campMode={true}
                initialPlansData={todayPlansData}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

