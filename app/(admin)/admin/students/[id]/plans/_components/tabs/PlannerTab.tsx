"use client";

import { UnfinishedDock } from "../UnfinishedDock";
import { DailyDock } from "../DailyDock";
import { WeeklyDock } from "../WeeklyDock";
import { WeeklyCalendar } from "../WeeklyCalendar";
import { PlanGroupSummaryCard } from "../PlanGroupSummaryCard";
import { AllGroupsSummaryCard } from "../AllGroupsSummaryCard";
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanActions,
} from "../context/AdminPlanContext";

interface PlannerTabProps {
  tab: "planner";
}

/**
 * 플래너 탭 컴포넌트 (메인 Dock 뷰)
 *
 * 포함 컴포넌트:
 * - UnfinishedDock: 미완료 플랜
 * - WeeklyCalendar: 주간 캘린더 미니뷰
 * - PlanGroupSummaryCard: 특정 플랜 그룹 요약 (그룹 선택 시)
 * - AllGroupsSummaryCard: 전체 플랜 그룹 통합 요약 (전체 보기 시)
 * - DailyDock: 일일 플랜
 * - WeeklyDock: 주간 플랜
 *
 * 성능 최적화:
 * - useAdminPlanBasic: 정적 정보 (studentId, planner data)
 * - useAdminPlanFilter: 필터 상태 (date, group)
 * - useAdminPlanActions: 핸들러 함수
 * - Modal Context 미사용 → 모달 상태 변경 시 리렌더링 없음
 */
export function PlannerTab({ tab: _tab }: PlannerTabProps) {
  // 분리된 Context 사용 (Modal 제외 → 모달 열림/닫힘에 리렌더링 안 함)
  const {
    studentId,
    tenantId,
    selectedPlannerId,
    activePlanGroupId,
    allPlanGroups,
    plannerDailySchedules,
    plannerExclusions,
    plannerCalculatedSchedule,
  } = useAdminPlanBasic();

  const {
    selectedGroupId,
    selectedDate,
    handleDateChange,
    contentTypeFilter,
    handleRefresh,
    refreshDailyAndWeekly,
    refreshDailyAndUnfinished,
  } = useAdminPlanFilter();

  const {
    handleOpenRedistribute,
    handleOpenEdit,
    handleOpenReorder,
    handleOpenMoveToGroup,
    handleOpenCopy,
    handleOpenStatusChange,
  } = useAdminPlanActions();

  // 플래너 레벨 스케줄 우선 사용 (플랜 그룹 없어도 주차/일차 표시)
  const effectiveDailySchedules = plannerCalculatedSchedule
    ? [plannerCalculatedSchedule]
    : plannerDailySchedules;

  // 선택된 플랜 그룹의 기간 정보 추출 (전체 보기 시 전체 기간)
  const selectedPlanGroup = selectedGroupId
    ? allPlanGroups?.find((group) => group.id === selectedGroupId)
    : null;

  // 전체 보기 시 모든 그룹의 기간을 포함
  const plannerPeriodStart = selectedPlanGroup?.periodStart
    ?? allPlanGroups?.reduce<string | undefined>((earliest, group) => {
        if (!group.periodStart) return earliest;
        if (!earliest || group.periodStart < earliest) return group.periodStart;
        return earliest;
      }, undefined);

  const plannerPeriodEnd = selectedPlanGroup?.periodEnd
    ?? allPlanGroups?.reduce<string | undefined>((latest, group) => {
        if (!group.periodEnd) return latest;
        if (!latest || group.periodEnd > latest) return group.periodEnd;
        return latest;
      }, undefined);

  return (
    <div className="space-y-4">
      {/* 미완료 Dock */}
      <UnfinishedDock
        studentId={studentId}
        tenantId={tenantId}
        plannerId={selectedPlannerId}
        selectedGroupId={selectedGroupId}
        contentTypeFilter={contentTypeFilter}
        onRedistribute={handleOpenRedistribute}
        onEdit={handleOpenEdit}
        onReorder={() => handleOpenReorder("unfinished")}
        onMoveToGroup={handleOpenMoveToGroup}
        onCopy={handleOpenCopy}
        onStatusChange={handleOpenStatusChange}
        onRefresh={handleRefresh}
        onRefreshDailyAndUnfinished={refreshDailyAndUnfinished}
      />

      {/* 주간 캘린더 미니뷰 */}
      <WeeklyCalendar
        studentId={studentId}
        selectedDate={selectedDate}
        onDateSelect={handleDateChange}
        plannerId={selectedPlannerId}
        dailySchedules={effectiveDailySchedules}
        exclusions={plannerExclusions}
        plannerPeriodStart={plannerPeriodStart}
        plannerPeriodEnd={plannerPeriodEnd}
      />

      {/* 플랜 그룹 요약 카드: selectedGroupId 기준 (null = 전체 보기) */}
      {selectedGroupId ? (
        <PlanGroupSummaryCard
          planGroupId={selectedGroupId}
          tenantId={tenantId}
        />
      ) : (
        selectedPlannerId && (
          <AllGroupsSummaryCard
            plannerId={selectedPlannerId}
            tenantId={tenantId}
          />
        )
      )}

      {/* Daily & Weekly Docks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Dock */}
        <DailyDock
          studentId={studentId}
          tenantId={tenantId}
          plannerId={selectedPlannerId}
          selectedDate={selectedDate}
          selectedGroupId={selectedGroupId}
          contentTypeFilter={contentTypeFilter}
          onRedistribute={handleOpenRedistribute}
          onEdit={handleOpenEdit}
          onReorder={() => handleOpenReorder("daily")}
          onMoveToGroup={handleOpenMoveToGroup}
          onCopy={handleOpenCopy}
          onStatusChange={handleOpenStatusChange}
          onRefresh={handleRefresh}
          onRefreshDailyAndWeekly={refreshDailyAndWeekly}
        />

        {/* Weekly Dock */}
        <WeeklyDock
          studentId={studentId}
          tenantId={tenantId}
          plannerId={selectedPlannerId}
          selectedDate={selectedDate}
          selectedGroupId={selectedGroupId}
          contentTypeFilter={contentTypeFilter}
          onRedistribute={handleOpenRedistribute}
          onEdit={handleOpenEdit}
          onReorder={() => handleOpenReorder("weekly")}
          onMoveToGroup={handleOpenMoveToGroup}
          onCopy={handleOpenCopy}
          onStatusChange={handleOpenStatusChange}
          onRefresh={handleRefresh}
          onRefreshDailyAndWeekly={refreshDailyAndWeekly}
        />
      </div>
    </div>
  );
}
