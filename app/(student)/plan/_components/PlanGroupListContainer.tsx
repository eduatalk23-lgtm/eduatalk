"use client";

import { useMemo } from "react";
import { usePlanGroups, type PlanGroupFilters } from "@/lib/hooks/usePlanGroups";
import { PlanGroupList } from "./PlanGroupList";
import { PlanGroupStatsCard } from "./PlanGroupStatsCard";
import { RescheduleRecommendations } from "./RescheduleRecommendations";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";

type PlanGroupListContainerProps = {
  studentId: string;
  planPurpose?: string;
  sortOrder?: "asc" | "desc";
};

export function PlanGroupListContainer({
  studentId,
  planPurpose,
  sortOrder = "desc",
}: PlanGroupListContainerProps) {
  // 플랜 그룹 필터 구성
  const filters: PlanGroupFilters = useMemo(
    () => ({
      studentId,
      includeDeleted: false,
      ...(planPurpose && { planPurpose }),
    }),
    [studentId, planPurpose]
  );

  // 플랜 그룹 데이터 조회
  const { data: planGroupsWithStats, isLoading } = usePlanGroups({
    filters,
  });

  // 캠프 모드 플랜 제외 및 정렬
  const processedPlanGroups = useMemo(() => {
    if (!planGroupsWithStats) {
      return [];
    }

    // 캠프 모드 플랜 제외 (캠프 관련 플랜은 /camp 경로에서만 확인)
    const nonCampPlanGroups = planGroupsWithStats.filter(
      (group) =>
        group.plan_type !== "camp" &&
        !group.camp_template_id &&
        !group.camp_invitation_id
    );

    // 생성일 기준 정렬
    const sorted = [...nonCampPlanGroups].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return sorted;
  }, [planGroupsWithStats, sortOrder]);

  // 통계 데이터 생성
  const { planCounts, planProgressData, stats } = useMemo(() => {
    const counts = new Map<string, number>();
    const progress = new Map<
      string,
      { completedCount: number; totalCount: number }
    >();

    processedPlanGroups.forEach((group) => {
      counts.set(group.id, group.planCount);
      progress.set(group.id, {
        completedCount: group.completedCount,
        totalCount: group.totalCount,
      });
    });

    const statistics = {
      total: processedPlanGroups.length,
      active: processedPlanGroups.filter((g) => g.status === "active").length,
      paused: processedPlanGroups.filter(
        (g) => g.status === "paused" || g.status === "cancelled"
      ).length,
      completed: processedPlanGroups.filter(
        (g) => g.status === "completed"
      ).length,
    };

    return {
      planCounts: counts,
      planProgressData: progress,
      stats: statistics,
    };
  }, [processedPlanGroups]);

  // 로딩 상태
  if (isLoading) {
    return <SuspenseFallback />;
  }

  // 빈 상태
  if (processedPlanGroups.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="등록된 플랜 그룹이 없습니다"
        description="새로운 플랜 그룹을 만들어 기간별 학습 계획을 세워보세요."
        actionLabel="플랜 그룹 생성하기"
        actionHref="/plan/new-group"
      />
    );
  }

  return (
    <>
      {/* 재조정 추천 - 플랜 그룹이 있을 때만 표시 */}
      <RescheduleRecommendations
        key={processedPlanGroups.length}
        studentId={studentId}
      />

      {/* 통계 카드 */}
      <PlanGroupStatsCard
        totalGroups={stats.total}
        activeCount={stats.active}
        pausedCount={stats.paused}
        completedCount={stats.completed}
      />

      {/* 플랜 목록 섹션 */}
      <div className="flex flex-col gap-4">
        <PlanGroupList
          key={processedPlanGroups.length}
          groups={processedPlanGroups}
          planCounts={planCounts}
          planProgressData={planProgressData}
        />
      </div>
    </>
  );
}

