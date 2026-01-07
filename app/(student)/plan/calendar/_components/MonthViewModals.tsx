"use client";

import { memo } from "react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, DailyScheduleInfo, AcademySchedule } from "@/lib/types/plan";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { formatDateString } from "@/lib/date/calendarUtils";
import { DayTimelineModal } from "./DayTimelineModal";
import { QuickAddPlanModal } from "./QuickAddPlanModal";
import { PlanDetailModal } from "./PlanDetailModal";

type MonthViewModalsProps = {
  // 타임라인 모달 props
  selectedDate: Date | null;
  isModalOpen: boolean;
  onModalOpenChange: (open: boolean) => void;
  plans: PlanWithContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  // 빠른 추가 모달 props
  quickAddDate: string | null;
  isQuickAddOpen: boolean;
  onQuickAddOpenChange: (open: boolean) => void;
  studentId?: string;
  tenantId?: string | null;
  onPlansUpdated?: () => void;
  // 플랜 상세 모달 props
  selectedPlan: PlanWithContent | null;
  isPlanDetailOpen: boolean;
  onPlanDetailOpenChange: (open: boolean) => void;
};

/**
 * MonthView에서 사용하는 모달들을 렌더링하는 컴포넌트
 */
function MonthViewModalsComponent({
  selectedDate,
  isModalOpen,
  onModalOpenChange,
  plans,
  exclusions,
  academySchedules,
  dayTypes,
  dailyScheduleMap,
  quickAddDate,
  isQuickAddOpen,
  onQuickAddOpenChange,
  studentId,
  tenantId,
  onPlansUpdated,
  selectedPlan,
  isPlanDetailOpen,
  onPlanDetailOpenChange,
}: MonthViewModalsProps) {
  return (
    <>
      {/* 타임라인 모달 */}
      {selectedDate && (() => {
        const selectedDateStr = formatDateString(selectedDate);
        const selectedDatePlans = plans.filter((plan) => plan.plan_date === selectedDateStr);

        return (
          <DayTimelineModal
            open={isModalOpen}
            onOpenChange={onModalOpenChange}
            date={selectedDate}
            plans={selectedDatePlans}
            exclusions={exclusions.filter((ex) => ex.exclusion_date === selectedDateStr)}
            academySchedules={academySchedules}
            dayTypeInfo={dayTypes.get(selectedDateStr)}
            dailySchedule={dailyScheduleMap.get(selectedDateStr)}
          />
        );
      })()}

      {/* 빠른 플랜 추가 모달 */}
      {quickAddDate && studentId && (
        <QuickAddPlanModal
          open={isQuickAddOpen}
          onOpenChange={onQuickAddOpenChange}
          date={quickAddDate}
          studentId={studentId}
          tenantId={tenantId ?? null}
          onSuccess={onPlansUpdated}
        />
      )}

      {/* 플랜 상세 모달 */}
      {selectedPlan && (
        <PlanDetailModal
          open={isPlanDetailOpen}
          onOpenChange={onPlanDetailOpenChange}
          plan={selectedPlan}
          studentId={studentId}
          onPlanUpdated={onPlansUpdated}
        />
      )}
    </>
  );
}

export const MonthViewModals = memo(MonthViewModalsComponent);
