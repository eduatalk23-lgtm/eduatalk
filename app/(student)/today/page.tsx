export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { perfTime } from "@/lib/utils/perfLog";
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { todayPlansQueryOptions } from "@/lib/hooks/useTodayPlans";
import { TodayHeader } from "./_components/TodayHeader";
import { TodayPlansSection } from "./_components/TodayPlansSection";
import { TodayAchievementsSection } from "./_components/TodayAchievementsSection";
import { TodayAchievementsAsyncWithSuspense } from "./_components/TodayAchievementsAsync";
import { TodayPageContextProvider } from "./_components/TodayPageContext";
import { CurrentLearningSection } from "./_components/CurrentLearningSection";
import { CompletionToast } from "./_components/CompletionToast";
import { EmptyState } from "@/components/molecules/EmptyState";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { formatDateString } from "@/lib/date/calendarUtils";
import { getPlanById } from "@/lib/data/studentPlans";
import { getContainerClass } from "@/lib/constants/layout";

type TodayPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const pageTimer = perfTime("[today] render - page");
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    pageTimer.end();
    redirect("/login");
  }

  const user = await getCurrentUser();
  const tenantContext = await getTenantContext();

  const resolveSearchParams = async () => {
    return await searchParams;
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
    pageTimer.end();
    return (
      <div className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          <TodayHeader />
          <EmptyState
            icon="📚"
            title="활성화된 플랜 그룹이 없습니다"
            description="플랜 그룹을 생성하고 활성화하면 여기서 확인할 수 있습니다."
          />
        </div>
      </div>
    );
  }

  // React Query를 사용하여 데이터 프리패칭
  const queryClient = getQueryClient();
  const prefetchTimer = perfTime("[today] prefetch - todayPlans");

  try {
    // Today Plans 프리패칭
    // Statistics는 Suspense로 별도 처리하므로 includeProgress: false
    await queryClient.prefetchQuery(
      todayPlansQueryOptions(
        userId,
        tenantContext?.tenantId || null,
        targetProgressDate,
        {
          camp: false, // 일반 모드
          includeProgress: false, // Statistics는 Suspense로 별도 처리
        }
      )
    );
  } catch (error) {
    // Prefetch 실패 시에도 페이지는 렌더링되도록 에러만 로깅
    console.error("[TodayPage] todayPlans prefetch 실패", error);
  }

  prefetchTimer.end();

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

  // 초기 progress는 기본값 (Suspense로 실제 값이 로딩됨)
  const initialProgress = {
    todayStudyMinutes: 0,
    planCompletedCount: 0,
    planTotalCount: 0,
    achievementScore: 0,
  };

  const page = (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodayPageContextProvider
        initialProgressDate={targetProgressDate}
        initialProgress={initialProgress}
      >
        <div className={getContainerClass("DASHBOARD", "md")}>
          <div className="flex flex-col gap-6">
            <TodayHeader />
            <CurrentLearningSection />
            <CompletionToast completedPlanId={completedPlanIdParam} planTitle={completedPlanTitle} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <TodayPlansSection
                  initialMode={requestedView}
                  initialPlanDate={requestedDate}
                  userId={userId}
                />
              </div>
              <div className="lg:col-span-4">
                <div className="sticky top-6 flex flex-col gap-4">
                  {/* Statistics를 Suspense로 비동기 처리 */}
                  <TodayAchievementsAsyncWithSuspense selectedDate={targetProgressDate} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </TodayPageContextProvider>
    </HydrationBoundary>
  );
  pageTimer.end();
  return page;
}
