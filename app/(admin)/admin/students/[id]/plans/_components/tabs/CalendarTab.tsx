"use client";

import dynamic from "next/dynamic";
import { useAdminPlan } from "../context/AdminPlanContext";
import { DayTimelineModal } from "../DayTimelineModal";

// 캘린더 뷰 동적 임포트
const AdminCalendarView = dynamic(
  () => import("../calendar-views/AdminCalendarView"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    ),
  }
);

interface CalendarTabProps {
  tab: "calendar";
}

/**
 * 캘린더 탭 컴포넌트
 *
 * 월간/간트 캘린더 뷰를 전체 화면으로 표시합니다.
 * AdminCalendarView 내부에서 월간/간트 뷰 전환이 가능합니다.
 */
export function CalendarTab(_props: CalendarTabProps) {
  const {
    studentId,
    tenantId,
    selectedPlannerId,
    selectedGroupId,
    selectedDate,
    handleDateChange,
    plannerExclusions,
    plannerDailySchedules,
    plannerCalculatedSchedule,
    plannerDateTimeSlots,
    dayTimelineModalDate,
    setDayTimelineModalDate,
    handleRefresh,
  } = useAdminPlan();

  // 플래너 레벨 스케줄 우선 사용 (플랜 그룹 없어도 주차/일차 표시)
  const effectiveDailySchedules = plannerCalculatedSchedule
    ? [plannerCalculatedSchedule]
    : plannerDailySchedules;

  // 플래너가 선택되지 않은 경우
  if (!selectedPlannerId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <p className="text-gray-500 mb-2">
          캘린더 뷰를 사용하려면 먼저 플래너를 선택해주세요.
        </p>
        <p className="text-sm text-gray-400">
          상단에서 플래너를 생성하거나 선택할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminCalendarView
        studentId={studentId}
        tenantId={tenantId}
        plannerId={selectedPlannerId}
        selectedGroupId={selectedGroupId}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        plannerExclusions={plannerExclusions ?? []}
        plannerDailySchedules={effectiveDailySchedules ?? []}
        dateTimeSlots={plannerDateTimeSlots}
        onTimelineClick={setDayTimelineModalDate}
        onRefresh={handleRefresh}
      />

      {/* 일별 타임라인 상세 모달 */}
      <DayTimelineModal
        isOpen={!!dayTimelineModalDate}
        onClose={() => setDayTimelineModalDate(null)}
        date={dayTimelineModalDate ?? ""}
        timeSlots={plannerDateTimeSlots?.[dayTimelineModalDate ?? ""] ?? []}
      />
    </div>
  );
}
