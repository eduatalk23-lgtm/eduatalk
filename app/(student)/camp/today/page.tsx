export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { TodayHeader } from "@/app/(student)/today/_components/TodayHeader";
import { TodayPageContent } from "@/app/(student)/today/_components/TodayPageContent";
import { CurrentLearningSection } from "@/app/(student)/today/_components/CurrentLearningSection";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "@/lib/data/campTemplates";

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

  // 활성화된 캠프 플랜 그룹 확인
  const supabase = await createSupabaseServerClient();
  const allActivePlanGroups = await getPlanGroupsForStudent({
    studentId: userId,
    status: "active",
  });

  // 캠프 모드 플랜 그룹만 필터링
  const campModePlanGroups = allActivePlanGroups.filter(
    (group) =>
      group.plan_type === "camp" ||
      group.camp_template_id !== null ||
      group.camp_invitation_id !== null
  );

  // 템플릿 존재 여부 확인 (삭제된 템플릿의 플랜 그룹 제외)
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

  // 진행률 계산 (캠프 모드 필터링은 calculateTodayProgress 내부에서 처리 필요)
  // TODO: calculateTodayProgress에 캠프 모드 필터링 추가 필요
  const todayProgressPromise = calculateTodayProgress(
    userId,
    tenantContext?.tenantId || null,
    targetProgressDate
  ).catch((error) => {
    console.error("[CampTodayPage] 진행률 계산 실패", error);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">캠프 학습관리</h1>
            <p className="text-sm text-gray-600 mt-1">
              캠프 플랜을 확인하고 학습을 진행하세요
            </p>
          </div>
        </div>
        <CurrentLearningSection campMode={true} />
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

