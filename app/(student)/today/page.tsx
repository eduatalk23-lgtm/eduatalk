
import { redirect } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { perfTime } from "@/lib/utils/perfLog";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { todayPlansQueryOptions } from "@/lib/query-options/todayPlans";
import { TodayHeader } from "./_components/TodayHeader";
import { TodayPlansSection } from "./_components/TodayPlansSection";
import { TodayPageContextProvider } from "./_components/TodayPageContext";
import { CurrentLearningSection } from "./_components/CurrentLearningSection";
import { CompletionToast } from "./_components/CompletionToast";
import { EmptyState } from "@/components/molecules/EmptyState";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { formatDateString } from "@/lib/date/calendarUtils";
import { getPlanById } from "@/lib/data/studentPlans";
import { getContainerClass } from "@/lib/constants/layout";
import { getTodayContainerPlans } from "@/lib/domains/today/actions/containerPlans";
import { ContainerView } from "./_components/containers/ContainerView";
import { AddPlanButton } from "./_components/AddPlanButton";
import { PromotionSuggestionCard } from "./_components/PromotionSuggestionCard";
import { GamificationWidget } from "./_components/GamificationWidget";

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
  const completedPlanIdParam = getParam("completedPlanId");

  const requestedDate =
    typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : undefined;

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

  // 오늘 날짜의 daily_schedule 추출 (타임라인 표시용)
  const todayDailySchedule = activePlanGroups[0]?.daily_schedule?.find(
    (ds) => ds.date === targetProgressDate
  ) ?? null;

  // Container 기반 플랜 데이터 조회
  const containerResult = await getTodayContainerPlans(targetProgressDate);

  // 활성 플랜 그룹이 없을 때 안내 메시지 표시
  if (activePlanGroups.length === 0) {
    pageTimer.end();
    return (
      <div className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">오늘의 학습</h1>
            <AddPlanButton
              studentId={userId}
              tenantId={tenantContext?.tenantId || null}
              defaultDate={targetProgressDate}
            />
          </div>
          <TodayHeader />
          <EmptyState
            icon="📚"
            title="활성화된 플랜 그룹이 없습니다"
            description="플랜 그룹을 생성하고 활성화하거나, 위의 '플랜 추가' 버튼으로 일회성 플랜을 추가해보세요."
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
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">오늘의 학습</h1>
              <AddPlanButton
                studentId={userId}
                tenantId={tenantContext?.tenantId || null}
                defaultDate={targetProgressDate}
              />
            </div>
            <TodayHeader selectedDate={requestedDate} />
            <CurrentLearningSection />
            <CompletionToast completedPlanId={completedPlanIdParam} planTitle={completedPlanTitle} />
            <PromotionSuggestionCard
              studentId={userId}
              tenantId={tenantContext?.tenantId || null}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <TodayPlansSection
                  userId={userId}
                  tenantId={tenantContext?.tenantId || null}
                  dailySchedule={todayDailySchedule}
                />
              </div>
              <div className="lg:col-span-6 flex flex-col gap-6">
                <GamificationWidget
                  studentId={userId}
                  tenantId={tenantContext?.tenantId || ""}
                />
                {containerResult.success && containerResult.data && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <ContainerView
                      data={containerResult.data}
                      date={containerResult.date ?? targetProgressDate}
                    />
                  </div>
                )}
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
