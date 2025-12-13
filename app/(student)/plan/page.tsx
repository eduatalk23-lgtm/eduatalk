import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanGroupList } from "./_components/PlanGroupList";
import { PlanGroupStatsCard } from "./_components/PlanGroupStatsCard";
import { FilterBar } from "./_components/FilterBar";
import { RescheduleRecommendations } from "./_components/RescheduleRecommendations";
import { getPlanGroupsWithStats, PlanGroupFilters } from "@/lib/data/planGroups";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PageHeader } from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";

type PlanPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PlanListPage({ searchParams }: PlanPageProps) {
  const params = await searchParams;
  const createdCount = params?.created;
  const planPurpose = params?.planPurpose;
  const sortOrder = params?.sortOrder || "desc"; // 기본값: 최신순(내림차순)

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 플랜 그룹 필터 구성
  const planGroupFilters: PlanGroupFilters = {
    studentId: user.id,
    includeDeleted: false,
  };

  if (planPurpose) {
    planGroupFilters.planPurpose = planPurpose;
  }

  // 통합 함수 사용 (통계 포함)
  const planGroupsWithStats = await getPlanGroupsWithStats(planGroupFilters);

  // 캠프 모드 플랜 제외 (캠프 관련 플랜은 /camp 경로에서만 확인)
  const nonCampPlanGroups = planGroupsWithStats.filter(
    (group) => 
      group.plan_type !== "camp" && 
      !group.camp_template_id && 
      !group.camp_invitation_id
  );

  // 생성일 기준 정렬
  const sortedPlanGroups = [...nonCampPlanGroups].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

  // PlanGroupList에 전달할 형식으로 변환
  const planGroups = sortedPlanGroups;
  
  const planCounts = new Map<string, number>();
  const planProgressData = new Map<string, { completedCount: number; totalCount: number }>();

  // 필터링된 플랜 그룹만 통계에 포함
  nonCampPlanGroups.forEach((group) => {
    planCounts.set(group.id, group.planCount);
    planProgressData.set(group.id, {
      completedCount: group.completedCount,
      totalCount: group.totalCount,
    });
  });

  // 통계 계산
  const stats = {
    total: planGroups.length,
    active: planGroups.filter((g) => g.status === "active").length,
    paused: planGroups.filter((g) => g.status === "paused" || g.status === "cancelled").length,
    completed: planGroups.filter((g) => g.status === "completed").length,
  };

  return (
    <>
      <ScrollToTop />
      <section className={getContainerClass("CAMP_PLAN", "md")}>
        <div className="flex flex-col gap-6">
        <PageHeader
          title="학생별 플랜 목록"
          description="기간별로 생성된 학습 계획을 확인하고 관리하세요."
          action={
            <Link
              href="/plan/new-group"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              aria-label="새 플랜 그룹 생성"
            >
              + 플랜 생성
            </Link>
          }
        />

        {createdCount && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {createdCount}개의 학습 플랜이 성공적으로 생성되었습니다!
          </div>
        )}

        {/* 필터 바 */}
        {planGroups.length > 0 && (
          <Suspense fallback={<SuspenseFallback />}>
            <FilterBar
              currentPlanPurpose={planPurpose}
              currentSortOrder={sortOrder}
            />
          </Suspense>
        )}

        {/* 재조정 추천 */}
        <RescheduleRecommendations studentId={user.id} />

        {/* 통계 카드 */}
        {planGroups.length > 0 && (
          <PlanGroupStatsCard
            totalGroups={stats.total}
            activeCount={stats.active}
            pausedCount={stats.paused}
            completedCount={stats.completed}
          />
        )}

        {/* 플랜 목록 섹션 */}
        <div className="flex flex-col gap-4">
          {planGroups.length > 0 ? (
            <PlanGroupList 
              groups={planGroups} 
              planCounts={planCounts}
              planProgressData={planProgressData}
            />
          ) : (
            <EmptyState
              icon="📋"
              title="등록된 플랜 그룹이 없습니다"
              description="새로운 플랜 그룹을 만들어 기간별 학습 계획을 세워보세요."
              actionLabel="플랜 그룹 생성하기"
              actionHref="/plan/new-group"
            />
          )}
        </div>
      </div>
    </section>
    </>
  );
}
