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
import { ViewSwitcher, MatrixView } from "@/components/plan";
import type {
  ViewType,
  MatrixTimeSlot,
  MatrixPlanItem,
} from "@/lib/types/plan/views";

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

/**
 * 기본 시간 슬롯 생성
 */
function getDefaultTimeSlots(): MatrixTimeSlot[] {
  return [
    { id: "slot-1", name: "1교시", startTime: "08:00", endTime: "08:50", order: 1, type: "study", isDefault: true, isActive: true },
    { id: "slot-2", name: "2교시", startTime: "09:00", endTime: "09:50", order: 2, type: "study", isDefault: true, isActive: true },
    { id: "slot-3", name: "3교시", startTime: "10:00", endTime: "10:50", order: 3, type: "study", isDefault: true, isActive: true },
    { id: "slot-4", name: "4교시", startTime: "11:00", endTime: "11:50", order: 4, type: "study", isDefault: true, isActive: true },
    { id: "slot-5", name: "점심", startTime: "12:00", endTime: "13:00", order: 5, type: "meal", isDefault: true, isActive: true },
    { id: "slot-6", name: "5교시", startTime: "13:00", endTime: "13:50", order: 6, type: "study", isDefault: true, isActive: true },
    { id: "slot-7", name: "6교시", startTime: "14:00", endTime: "14:50", order: 7, type: "study", isDefault: true, isActive: true },
    { id: "slot-8", name: "7교시", startTime: "15:00", endTime: "15:50", order: 8, type: "study", isDefault: true, isActive: true },
    { id: "slot-9", name: "자습1", startTime: "16:00", endTime: "17:50", order: 9, type: "study", isDefault: true, isActive: true },
    { id: "slot-10", name: "저녁", startTime: "18:00", endTime: "19:00", order: 10, type: "meal", isDefault: true, isActive: true },
    { id: "slot-11", name: "자습2", startTime: "19:00", endTime: "20:50", order: 11, type: "study", isDefault: true, isActive: true },
    { id: "slot-12", name: "자습3", startTime: "21:00", endTime: "22:00", order: 12, type: "study", isDefault: true, isActive: true },
  ];
}

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
}

function ViewRenderer({
  plans,
  adHocPlans,
  timeSlots,
  renderCalendarView,
  onPlanClick,
  onSimpleComplete,
  onCellClick,
}: ViewRendererProps) {
  const { currentView, settings } = useView();

  // 모든 플랜을 MatrixPlanItem으로 변환
  const matrixPlans = useMemo(() => {
    const allPlans = [
      ...plans.map((p) => ({ ...p, plan_type: "student_plan" as const })),
      ...adHocPlans.map((p) => ({ ...p, plan_type: "ad_hoc_plan" as const })),
    ];
    return allPlans.map(toMatrixPlanItem);
  }, [plans, adHocPlans]);

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
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        />
      );

    case "timeline":
      // TODO: 타임라인 뷰 구현
      return (
        <div className="p-8 text-center text-gray-500">
          타임라인 뷰는 준비 중입니다.
        </div>
      );

    case "table":
      // TODO: 테이블 뷰 구현
      return (
        <div className="p-8 text-center text-gray-500">
          테이블 뷰는 준비 중입니다.
        </div>
      );

    case "list":
      // TODO: 리스트 뷰 구현
      return (
        <div className="p-8 text-center text-gray-500">
          리스트 뷰는 준비 중입니다.
        </div>
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
        />
      </div>
    </ViewProvider>
  );
}
