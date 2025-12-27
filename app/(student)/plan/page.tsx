
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { planGroupsQueryOptions } from "@/lib/query-options/planGroups";
import type { PlanGroupFilters } from "@/lib/data/planGroups";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PageHeader } from "@/components/layout/PageHeader";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";
import { PlanGroupListContainer } from "./_components/PlanGroupListContainer";
import { FilterBar } from "./_components/FilterBar";
import { QuickCreateButton } from "./_components/QuickCreateButton";

type PlanPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PlanListPage({ searchParams }: PlanPageProps) {
  const params = await searchParams;
  const createdCount = params?.created;
  const planPurpose = params?.planPurpose;
  const sortOrder = (params?.sortOrder === "asc" || params?.sortOrder === "desc") 
    ? params.sortOrder 
    : "desc" as "asc" | "desc"; // 기본값: 최신순(내림차순)

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();

  // 플랜 그룹 필터 구성
  const planGroupFilters: PlanGroupFilters = {
    studentId: user.userId,
    tenantId: tenantContext?.tenantId ?? null,
    includeDeleted: false,
  };

  if (planPurpose) {
    planGroupFilters.planPurpose = planPurpose;
  }

  // React Query를 사용하여 데이터 프리패칭
  const queryClient = getQueryClient();

  try {
    // Plan Groups 프리패칭
    await queryClient.prefetchQuery(planGroupsQueryOptions(planGroupFilters));
  } catch (error) {
    // Prefetch 실패 시에도 페이지는 렌더링되도록 에러만 로깅
    console.error("[PlanPage] planGroups prefetch 실패", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ScrollToTop />
      <section className={getContainerClass("CAMP_PLAN", "md")}>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="학생별 플랜 목록"
            description="기간별로 생성된 학습 계획을 확인하고 관리하세요."
            action={
              <div className="flex items-center gap-2">
                <Link
                  href="/plan/content-add"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-600 bg-white px-4 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
                  aria-label="콘텐츠 추가"
                >
                  + 콘텐츠
                </Link>
                <QuickCreateButton />
                <Link
                  href="/plan/new-group"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                  aria-label="새 플랜 그룹 생성"
                >
                  + 플랜 생성
                </Link>
              </div>
            }
          />

          {createdCount && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {createdCount}개의 학습 플랜이 성공적으로 생성되었습니다!
            </div>
          )}

          {/* 필터 바 */}
          <Suspense fallback={<SuspenseFallback />}>
            <FilterBar
              currentPlanPurpose={planPurpose}
              currentSortOrder={sortOrder}
            />
          </Suspense>

          {/* 플랜 목록 컨테이너 (클라이언트 컴포넌트) */}
          <PlanGroupListContainer
            studentId={user.userId}
            planPurpose={planPurpose}
            sortOrder={sortOrder}
          />
        </div>
      </section>
    </HydrationBoundary>
  );
}
