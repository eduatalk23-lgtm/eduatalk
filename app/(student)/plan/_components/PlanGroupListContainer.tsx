"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePlanGroups, type PlanGroupFilters } from "@/lib/hooks/usePlanGroups";
import { getProgressRangeFromPreset, isDateInRange } from "@/lib/utils/dateRangePresets";
import { PlanGroupList } from "./PlanGroupList";
import { PlanGroupStatsCard } from "./PlanGroupStatsCard";
import { RescheduleRecommendations } from "./RescheduleRecommendations";
import { AdaptiveScheduleInsights } from "./AdaptiveScheduleInsights";
import { WeakSubjectReinforcementCard } from "./WeakSubjectReinforcementCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";

type PlanGroupListContainerProps = {
  studentId: string;
  planPurpose?: string;
  sortOrder?: "asc" | "desc";
  /** 상태 필터 */
  statusFilter?: string;
  /** 진행률 필터 프리셋 (0-25, 25-50, 등) */
  progressFilter?: string;
  /** 날짜 범위 필터 */
  dateRange?: { start: string; end: string };
};

export function PlanGroupListContainer({
  studentId,
  planPurpose,
  sortOrder = "desc",
  statusFilter,
  progressFilter,
  dateRange,
}: PlanGroupListContainerProps) {
  // 플랜 그룹 필터 구성
  const filters: PlanGroupFilters = useMemo(
    () => ({
      studentId,
      includeDeleted: false,
      ...(planPurpose && { planPurpose }),
      ...(statusFilter && { status: statusFilter }),
      ...(dateRange && { dateRange }),
    }),
    [studentId, planPurpose, statusFilter, dateRange]
  );

  // 플랜 그룹 데이터 조회
  const { data: planGroupsWithStats, isLoading } = usePlanGroups({
    filters,
  });

  // 진행률 범위 파싱
  const progressRange = useMemo(
    () => getProgressRangeFromPreset(progressFilter),
    [progressFilter]
  );

  // 캠프 모드 플랜 제외, 필터링 및 정렬
  const processedPlanGroups = useMemo(() => {
    if (!planGroupsWithStats) {
      return [];
    }

    // 1. 캠프 모드 플랜 제외 (캠프 관련 플랜은 /camp 경로에서만 확인)
    let filtered = planGroupsWithStats.filter(
      (group) =>
        group.plan_type !== "camp" &&
        !group.camp_template_id &&
        !group.camp_invitation_id
    );

    // 2. 상태 필터 (DB에서 이미 적용되었지만 클라이언트에서도 확인)
    if (statusFilter) {
      filtered = filtered.filter((group) => group.status === statusFilter);
    }

    // 3. 날짜 범위 필터 (생성일 기준)
    if (dateRange) {
      filtered = filtered.filter((group) =>
        group.created_at ? isDateInRange(group.created_at, dateRange) : false
      );
    }

    // 4. 진행률 필터 (클라이언트에서 계산)
    if (progressRange) {
      filtered = filtered.filter((group) => {
        // 전체 진행률 계산: completedCount / totalCount * 100
        const progress =
          group.totalCount > 0
            ? (group.completedCount / group.totalCount) * 100
            : 0;
        return progress >= progressRange.min && progress <= progressRange.max;
      });
    }

    // 5. 생성일 기준 정렬
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return sorted;
  }, [planGroupsWithStats, sortOrder, statusFilter, dateRange, progressRange]);

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
        description={
          <>
            <Link
              href="/plan/new-group"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              새로운 플랜 그룹
            </Link>
            을 만들어 기간별 학습 계획을 세워보세요.
          </>
        }
        actionLabel="플랜 그룹 생성하기"
        actionHref="/plan/new-group"
      />
    );
  }

  return (
    <>
      {/* 적응형 스케줄 인사이트 - 학습 패턴 분석 */}
      <AdaptiveScheduleInsights
        studentId={studentId}
        daysBack={30}
        compact={false}
      />

      {/* 취약 과목 강화 스케줄 */}
      <WeakSubjectReinforcementCard
        studentId={studentId}
        daysBack={30}
        targetCompletionRate={80}
      />

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

