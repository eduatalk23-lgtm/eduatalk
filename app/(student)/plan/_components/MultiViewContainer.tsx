"use client";

/**
 * MultiViewContainer - 다중 뷰 컨테이너
 *
 * 플랜을 다양한 형태로 볼 수 있는 다중 뷰 시스템의 래퍼 컴포넌트입니다.
 * - 캘린더 뷰: 월간/주간/일간 캘린더
 * - 매트릭스 뷰: 시간×요일 격자 (Notion 스타일)
 * - 타임라인 뷰: 시간순 리스트
 * - 리스트 뷰: 간단한 목록
 */

import { useCallback, useMemo } from "react";
import { ViewProvider, useView } from "@/lib/domains/plan/views";
import {
  ViewSwitcher,
  MatrixView,
  TimelineView,
  TableView,
  ListView,
} from "@/components/plan";
import type {
  ViewType,
  MatrixTimeSlot,
  MatrixPlanItem,
} from "@/lib/types/plan/views";
import { getDefaultTimeSlots } from "@/lib/config/timeSlots";
import type { TimelinePlanItem } from "@/components/plan/TimelineView";
import type { TablePlanItem } from "@/components/plan/TableView";
import type { ListPlanItem, GroupBy } from "@/components/plan/ListView";

// ============================================
// 타입 정의
// ============================================

interface PlanData {
  id: string;
  title?: string;
  subject?: string;
  subject_category?: string;
  status?: string;
  plan_date?: string;
  start_time?: string;
  end_time?: string;
  progress?: number;
  display_color?: string;
  plan_type?: "student_plan" | "ad_hoc_plan";
  is_simple_completion?: boolean;
}

interface MultiViewContainerProps {
  /** 플랜 데이터 */
  plans: PlanData[];
  /** 애드혹 플랜 데이터 */
  adHocPlans?: PlanData[];
  /** 시간 슬롯 */
  timeSlots?: MatrixTimeSlot[];
  /** 날짜 범위 */
  minDate?: string;
  maxDate?: string;
  /** 캘린더 뷰 렌더 함수 (기존 캘린더 컴포넌트 사용) */
  renderCalendarView?: () => React.ReactNode;
  /** 플랜 클릭 핸들러 */
  onPlanClick?: (plan: PlanData) => void;
  /** 간단 완료 핸들러 */
  onSimpleComplete?: (planId: string, planType: string) => void;
  /** 빈 셀 클릭 핸들러 */
  onCellClick?: (slotId: string, date: string) => void;
  /** 플랜 이동 핸들러 */
  onPlanMove?: (
    planId: string,
    planType: string,
    targetDate: string,
    targetStartTime: string,
    targetEndTime: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** 드래그앤드롭 활성화 */
  enableDragDrop?: boolean;
  /** 학생 ID */
  studentId?: string;
  /** 테넌트 ID */
  tenantId?: string;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 주의 시작 날짜 계산 (월요일 기준)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 조정
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 기본 시간 슬롯은 lib/config/timeSlots.ts에서 import

/**
 * 플랜을 MatrixPlanItem으로 변환
 */
function toMatrixPlanItem(plan: PlanData): MatrixPlanItem {
  return {
    id: plan.id,
    title: plan.title || "제목 없음",
    subject: plan.subject,
    subjectCategory: plan.subject_category,
    status: (plan.status as MatrixPlanItem["status"]) || "pending",
    startTime: plan.start_time,
    endTime: plan.end_time,
    progress: plan.progress,
    color: plan.display_color,
    planType: plan.plan_type || "student_plan",
    isSimpleCompletion: plan.is_simple_completion,
  };
}

/**
 * 플랜을 TimelinePlanItem으로 변환
 */
function toTimelinePlanItem(plan: PlanData): TimelinePlanItem {
  return {
    ...toMatrixPlanItem(plan),
    date: plan.plan_date || new Date().toISOString().split("T")[0],
  };
}

/**
 * 플랜을 TablePlanItem으로 변환
 */
function toTablePlanItem(plan: PlanData): TablePlanItem {
  return {
    ...toMatrixPlanItem(plan),
    date: plan.plan_date || new Date().toISOString().split("T")[0],
  };
}

/**
 * 플랜을 ListPlanItem으로 변환
 */
function toListPlanItem(plan: PlanData): ListPlanItem {
  return {
    ...toMatrixPlanItem(plan),
    date: plan.plan_date || new Date().toISOString().split("T")[0],
  };
}

// ============================================
// 뷰 스위처 래퍼
// ============================================

function ViewSwitcherWrapper() {
  const {
    currentView,
    setViewType,
    savedViews,
    selectedViewId,
    saveView,
    loadView,
    deleteView,
    setDefaultView,
  } = useView();

  return (
    <ViewSwitcher
      currentView={currentView}
      onViewChange={setViewType}
      savedViews={savedViews}
      selectedViewId={selectedViewId}
      onSaveView={saveView}
      onLoadView={loadView}
      onDeleteView={deleteView}
      onSetDefaultView={setDefaultView}
    />
  );
}

// ============================================
// 뷰 렌더러
// ============================================

interface ViewRendererProps {
  plans: PlanData[];
  adHocPlans: PlanData[];
  timeSlots: MatrixTimeSlot[];
  renderCalendarView?: () => React.ReactNode;
  onPlanClick?: (plan: PlanData) => void;
  onSimpleComplete?: (planId: string, planType: string) => void;
  onCellClick?: (slotId: string, date: string) => void;
  onPlanMove?: (
    planId: string,
    planType: string,
    targetDate: string,
    targetStartTime: string,
    targetEndTime: string
  ) => Promise<{ success: boolean; error?: string }>;
  enableDragDrop?: boolean;
}

function ViewRenderer({
  plans,
  adHocPlans,
  timeSlots,
  renderCalendarView,
  onPlanClick,
  onSimpleComplete,
  onCellClick,
  onPlanMove,
  enableDragDrop = false,
}: ViewRendererProps) {
  const { currentView, settings } = useView();

  // 모든 플랜 합치기 (plan_type 추가)
  const allPlans = useMemo(() => [
    ...plans.map((p) => ({ ...p, plan_type: "student_plan" as const })),
    ...adHocPlans.map((p) => ({ ...p, plan_type: "ad_hoc_plan" as const })),
  ], [plans, adHocPlans]);

  // 매트릭스 뷰용 플랜 변환
  const matrixPlans = useMemo(() => allPlans.map(toMatrixPlanItem), [allPlans]);

  // 현재 주 시작 날짜
  const weekStart = useMemo(() => getWeekStart(new Date()), []);

  // 플랜 클릭 핸들러
  const handlePlanClick = useCallback(
    (item: MatrixPlanItem) => {
      const originalPlan = [...plans, ...adHocPlans].find((p) => p.id === item.id);
      if (originalPlan && onPlanClick) {
        onPlanClick(originalPlan);
      }
    },
    [plans, adHocPlans, onPlanClick]
  );

  // 플랜 이동 핸들러
  const handlePlanMove = useCallback(
    async (
      planId: string,
      planType: string,
      _targetSlotId: string,
      targetDate: string,
      targetStartTime: string,
      targetEndTime: string
    ) => {
      if (!onPlanMove) {
        return { success: false, error: "이동 핸들러가 없습니다." };
      }
      return onPlanMove(planId, planType, targetDate, targetStartTime, targetEndTime);
    },
    [onPlanMove]
  );

  // 뷰 타입별 렌더링
  switch (currentView) {
    case "calendar":
      // 기존 캘린더 컴포넌트 사용
      return renderCalendarView ? (
        <>{renderCalendarView()}</>
      ) : (
        <div className="p-8 text-center text-gray-500">
          캘린더 뷰가 구성되지 않았습니다.
        </div>
      );

    case "matrix":
      return (
        <MatrixView
          slots={timeSlots}
          plans={matrixPlans}
          weekStart={weekStart}
          showWeekends={settings.matrix?.showWeekends ?? false}
          showEmptySlots={settings.display?.showEmptySlots ?? true}
          onPlanClick={handlePlanClick}
          onCellClick={onCellClick}
          enableSimpleComplete={true}
          onSimpleComplete={onSimpleComplete}
          enableDragDrop={enableDragDrop}
          onPlanMove={handlePlanMove}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        />
      );

    case "timeline":
      return (
        <TimelineView
          plans={allPlans.map(toTimelinePlanItem)}
          onPlanClick={(plan) => {
            const originalPlan = [...plans, ...adHocPlans].find((p) => p.id === plan.id);
            if (originalPlan && onPlanClick) {
              onPlanClick(originalPlan);
            }
          }}
          enableSimpleComplete={true}
          onSimpleComplete={onSimpleComplete}
          showCompleted={settings.display?.showCompleted ?? true}
          showEmptyDays={settings.display?.showEmptySlots ?? false}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
        />
      );

    case "table":
      return (
        <TableView
          plans={allPlans.map(toTablePlanItem)}
          onPlanClick={(plan) => {
            const originalPlan = [...plans, ...adHocPlans].find((p) => p.id === plan.id);
            if (originalPlan && onPlanClick) {
              onPlanClick(originalPlan);
            }
          }}
          enableSimpleComplete={true}
          onSimpleComplete={onSimpleComplete}
          initialSortField={settings.sort?.field === "start_time" ? "startTime" : settings.sort?.field as "date" | "startTime" | "title" | "subject" | "status" | "progress" | undefined}
          initialSortDirection={settings.sort?.direction}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
        />
      );

    case "list":
      return (
        <ListView
          plans={allPlans.map(toListPlanItem)}
          onPlanClick={(plan) => {
            const originalPlan = [...plans, ...adHocPlans].find((p) => p.id === plan.id);
            if (originalPlan && onPlanClick) {
              onPlanClick(originalPlan);
            }
          }}
          enableSimpleComplete={true}
          onSimpleComplete={onSimpleComplete}
          groupBy={(settings.groupBy || "date") as GroupBy}
          showCompleted={settings.display?.showCompleted ?? true}
          compact={settings.display?.compactMode ?? false}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
        />
      );

    default:
      return null;
  }
}

// ============================================
// 메인 컴포넌트
// ============================================

export function MultiViewContainer({
  plans,
  adHocPlans = [],
  timeSlots,
  renderCalendarView,
  onPlanClick,
  onSimpleComplete,
  onCellClick,
  onPlanMove,
  enableDragDrop = false,
  className,
}: MultiViewContainerProps) {
  // 시간 슬롯 (제공되지 않으면 기본값 사용)
  const slots = useMemo(
    () => timeSlots || getDefaultTimeSlots(),
    [timeSlots]
  );

  return (
    <ViewProvider initialView="calendar">
      <div className={className}>
        {/* 뷰 스위처 */}
        <div className="mb-4 flex justify-end">
          <ViewSwitcherWrapper />
        </div>

        {/* 뷰 렌더러 */}
        <ViewRenderer
          plans={plans}
          adHocPlans={adHocPlans}
          timeSlots={slots}
          renderCalendarView={renderCalendarView}
          onPlanClick={onPlanClick}
          onSimpleComplete={onSimpleComplete}
          onCellClick={onCellClick}
          onPlanMove={onPlanMove}
          enableDragDrop={enableDragDrop}
        />
      </div>
    </ViewProvider>
  );
}
