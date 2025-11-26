export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { TodayHeader } from "./_components/TodayHeader";
import { TodayPageContent } from "./_components/TodayPageContent";
import { CurrentLearningSection } from "./_components/CurrentLearningSection";

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

  // 진행률 계산
  const todayProgressPromise = calculateTodayProgress(
    userId,
    tenantContext?.tenantId || null,
    targetProgressDate
  ).catch((error) => {
    console.error("[TodayPage] 진행률 계산 실패", error);
    return {
      todayStudyMinutes: 0,
      planCompletedCount: 0,
      planTotalCount: 0,
      goalProgressSummary: [],
      achievementScore: 0,
    };
  });

  const [todayProgress] = await Promise.all([todayProgressPromise]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <TodayHeader />
        <CurrentLearningSection />
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
}
