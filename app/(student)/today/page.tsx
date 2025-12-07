export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getTodayPlans } from "@/lib/data/todayPlans";
import { perfTime } from "@/lib/utils/perfLog";
import { TodayHeader } from "./_components/TodayHeader";
import { TodayPageContent } from "./_components/TodayPageContent";
import { CurrentLearningSection } from "./_components/CurrentLearningSection";
import { CompletionToast } from "./_components/CompletionToast";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { formatDateString } from "@/lib/date/calendarUtils";
import { getPlanById } from "@/lib/data/studentPlans";

type TodayPageProps = {
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

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const pageTimer = perfTime("[today] render - page");
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
  const todayDate = formatDateString(today);

  const targetProgressDate = requestedDate ?? todayDate;

  // 활성화된 일반 플랜 그룹 확인
  const allActivePlanGroups = await getPlanGroupsForStudent({
    studentId: userId,
    status: "active",
  });

  // 일반 모드 플랜 그룹만 필터링 (캠프 모드 제외)
  const activePlanGroups = allActivePlanGroups.filter(
    (group) =>
      group.plan_type !== "camp" &&
      group.camp_template_id === null &&
      group.camp_invitation_id === null
  );

  // 활성 일반 플랜 그룹이 없을 때 안내 메시지 표시
  if (activePlanGroups.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <TodayHeader />
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <div className="mx-auto flex max-w-md flex-col gap-4">
              <div className="text-6xl">📚</div>
              <h3 className="text-lg font-semibold text-gray-900">
                활성화된 플랜 그룹이 없습니다
              </h3>
              <p className="text-sm text-gray-500">
                플랜 그룹을 생성하고 활성화하면 여기서 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: todayPlans 캐시 사용
  const todayPlansTimer = perfTime("[today] data - todayPlans");
  const todayPlansDataPromise = getTodayPlans({
    studentId: userId,
    tenantId: tenantContext?.tenantId || null,
    date: targetProgressDate,
    camp: false, // 일반 모드
    includeProgress: true,
    narrowQueries: true,
    useCache: true,
    cacheTtlSeconds: 120,
  }).catch((error) => {
    console.error("[TodayPage] todayPlans 조회 실패", error);
    return null;
  });

  // 완료된 플랜 정보 조회 (토스트용)
  let completedPlanTitle: string | null = null;
  if (completedPlanIdParam) {
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
      console.error("[TodayPage] 완료된 플랜 정보 조회 실패", error);
    }
  }

  const [todayPlansData] = await Promise.all([todayPlansDataPromise]);
  todayPlansTimer.end();

  // todayPlansData에서 todayProgress 추출 (없으면 기본값)
  const todayProgress = todayPlansData?.todayProgress ?? {
    todayStudyMinutes: 0,
    planCompletedCount: 0,
    planTotalCount: 0,
    achievementScore: 0,
  };

  const page = (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <TodayHeader />
        <CurrentLearningSection />
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  pageTimer.end();
  return page;
}
