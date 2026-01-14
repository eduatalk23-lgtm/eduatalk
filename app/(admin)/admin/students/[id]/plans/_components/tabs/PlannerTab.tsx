"use client";

import { UnfinishedDock } from "../UnfinishedDock";
import { DailyDock } from "../DailyDock";
import { WeeklyDock } from "../WeeklyDock";
import { WeeklyCalendar } from "../WeeklyCalendar";
import { PlanGroupSummaryCard } from "../PlanGroupSummaryCard";
import { DayTimelineModal } from "../DayTimelineModal";
import { useAdminPlan } from "../context/AdminPlanContext";

interface PlannerTabProps {
  tab: "planner";
}

/**
 * 플래너 탭 컴포넌트 (메인 Dock 뷰)
 *
 * 포함 컴포넌트:
 * - UnfinishedDock: 미완료 플랜
 * - WeeklyCalendar: 주간 캘린더 미니뷰
 * - PlanGroupSummaryCard: 플랜 그룹 요약 (activePlanGroupId 있을 때)
 * - DailyDock: 일일 플랜
 * - WeeklyDock: 주간 플랜
 */
export function PlannerTab({ tab: _tab }: PlannerTabProps) {
  const {
    studentId,
    tenantId,
    selectedPlannerId,
    activePlanGroupId,
    selectedGroupId,
    selectedDate,
    handleDateChange,
    contentTypeFilter,
    plannerDailySchedules,
    plannerExclusions,
    plannerCalculatedSchedule,
    plannerDateTimeSlots,
    dayTimelineModalDate,
    setDayTimelineModalDate,
    handleRefresh,
    handleOpenRedistribute,
    handleOpenEdit,
    handleOpenReorder,
    handleOpenMoveToGroup,
    handleOpenCopy,
    handleOpenStatusChange,
  } = useAdminPlan();

  // 플래너 레벨 스케줄 우선 사용 (플랜 그룹 없어도 주차/일차 표시)
  const effectiveDailySchedules = plannerCalculatedSchedule
    ? [plannerCalculatedSchedule]
    : plannerDailySchedules;

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
      />

      {/* 주간 캘린더 미니뷰 */}
      <WeeklyCalendar
        studentId={studentId}
        selectedDate={selectedDate}
        onDateSelect={handleDateChange}
        plannerId={selectedPlannerId}
        dailySchedules={effectiveDailySchedules}
        exclusions={plannerExclusions}
        dateTimeSlots={plannerDateTimeSlots}
        onTimelineClick={setDayTimelineModalDate}
      />

      {/* 일별 타임라인 상세 모달 */}
      <DayTimelineModal
        isOpen={!!dayTimelineModalDate}
        onClose={() => setDayTimelineModalDate(null)}
        date={dayTimelineModalDate ?? ""}
        timeSlots={plannerDateTimeSlots?.[dayTimelineModalDate ?? ""] ?? []}
      />

      {/* 플랜 그룹 요약 카드 */}
      {activePlanGroupId && (
        <PlanGroupSummaryCard
          planGroupId={activePlanGroupId}
          tenantId={tenantId}
        />
      )}

      {/* Daily & Weekly Docks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Dock */}
        <DailyDock
          studentId={studentId}
          tenantId={tenantId}
          plannerId={selectedPlannerId}
          selectedDate={selectedDate}
          activePlanGroupId={activePlanGroupId}
          selectedGroupId={selectedGroupId}
          contentTypeFilter={contentTypeFilter}
          onRedistribute={handleOpenRedistribute}
          onEdit={handleOpenEdit}
          onReorder={() => handleOpenReorder("daily")}
          onMoveToGroup={handleOpenMoveToGroup}
          onCopy={handleOpenCopy}
          onStatusChange={handleOpenStatusChange}
          onRefresh={handleRefresh}
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
        />
      </div>
    </div>
  );
}
