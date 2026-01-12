"use client";

/**
 * 관리자 캘린더 뷰 메인 컨테이너
 *
 * 월간/간트 뷰를 전환하고, 캘린더 데이터를 관리합니다.
 * 제외일 설정/해제 기능을 포함합니다.
 */

import { useState, useMemo, useCallback, useTransition } from "react";
import { Calendar, BarChart3, ChevronLeft, ChevronRight, CheckSquare } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  format,
  parseISO,
} from "date-fns";
import { ko } from "date-fns/locale";

import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { DailyScheduleInfo } from "@/lib/types/plan/domain";
import {
  removePlannerExclusionAction,
  deletePlanWithLogging,
} from "@/lib/domains/admin-plan/actions";
import { AdminCalendarDragProvider } from "./_context/AdminCalendarDragContext";
import { useAdminCalendarData } from "./_hooks/useAdminCalendarData";
import { useCalendarSelection } from "./_hooks/useCalendarSelection";
import AdminCalendarContextMenu from "./AdminCalendarContextMenu";
import AddExclusionModal from "./AddExclusionModal";
import BatchActionsToolbar from "./BatchActionsToolbar";
import type {
  AdminCalendarViewProps,
  ExclusionsByDate,
  DailySchedulesByDate,
  ContextMenuState,
} from "./_types/adminCalendar";

// 동적 임포트로 코드 스플리팅
import dynamic from "next/dynamic";

// 플랜 편집 모달 동적 임포트
const EditPlanModal = dynamic(
  () => import("../modals/EditPlanModal").then((mod) => ({ default: mod.EditPlanModal })),
  { ssr: false }
);

const AdminMonthView = dynamic(() => import("./AdminMonthView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  ),
});

const AdminGanttView = dynamic(() => import("./AdminGanttView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  ),
});

type CalendarViewMode = "month" | "gantt";

export default function AdminCalendarView({
  studentId,
  tenantId,
  plannerId,
  selectedGroupId,
  selectedDate,
  onDateChange,
  plannerExclusions,
  plannerDailySchedules,
  onRefresh,
}: AdminCalendarViewProps) {
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    date: null,
    hasExclusion: false,
  });

  // 제외일 추가 모달 상태
  const [addExclusionModal, setAddExclusionModal] = useState<{
    isOpen: boolean;
    date: string;
  }>({
    isOpen: false,
    date: "",
  });

  // 플랜 편집 모달 상태
  const [editPlanModal, setEditPlanModal] = useState<{
    isOpen: boolean;
    planId: string;
  }>({
    isOpen: false,
    planId: "",
  });

  // 플랜 삭제 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    planId: string;
    planTitle: string;
  }>({
    isOpen: false,
    planId: "",
    planTitle: "",
  });

  // 삭제 진행 상태
  const [isDeleting, startDeleteTransition] = useTransition();

  // 제외일 삭제 트랜지션
  const [isRemovingExclusion, startRemoveTransition] = useTransition();
  const toast = useToast();

  // 현재 월 상태
  const [currentMonth, setCurrentMonth] = useState(() => {
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  });

  // 간트 뷰 날짜 범위
  const [ganttDateRange, setGanttDateRange] = useState(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  });

  // 제외일 맵 생성
  const exclusionsByDate = useMemo<ExclusionsByDate>(() => {
    const map: ExclusionsByDate = {};
    for (const exc of plannerExclusions) {
      map[exc.exclusionDate] = {
        id: `exc-${exc.exclusionDate}`,
        tenant_id: tenantId,
        student_id: studentId,
        plan_group_id: null,
        exclusion_date: exc.exclusionDate,
        exclusion_type: exc.exclusionType as "휴가" | "개인사정" | "휴일지정" | "기타",
        reason: exc.reason || null,
        created_at: new Date().toISOString(),
      };
    }
    return map;
  }, [plannerExclusions, studentId, tenantId]);

  // 일일 스케줄 맵 생성
  const dailySchedulesByDate = useMemo<DailySchedulesByDate>(() => {
    const map: DailySchedulesByDate = {};
    for (const scheduleArray of plannerDailySchedules) {
      for (const schedule of scheduleArray) {
        if (schedule?.date) {
          map[schedule.date] = schedule;
        }
      }
    }
    return map;
  }, [plannerDailySchedules]);

  // 월 변경 핸들러
  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleMonthChange = useCallback((date: Date) => {
    setCurrentMonth(date);
  }, []);

  // 날짜 선택 핸들러
  const handleDateSelect = useCallback(
    (date: string) => {
      onDateChange(date);
    },
    [onDateChange]
  );

  // 플랜 클릭 핸들러 (상세 보기 → 편집 모달 열기)
  const handlePlanClick = useCallback((planId: string) => {
    setEditPlanModal({ isOpen: true, planId });
  }, []);

  // 플랜 편집 핸들러
  const handlePlanEdit = useCallback((planId: string) => {
    setEditPlanModal({ isOpen: true, planId });
  }, []);

  // 플랜 편집 모달 닫기
  const handleCloseEditPlanModal = useCallback(() => {
    setEditPlanModal({ isOpen: false, planId: "" });
  }, []);

  // 컨텍스트 메뉴 열기 핸들러 (우클릭)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, date: string, hasExclusion: boolean) => {
      e.preventDefault();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        date,
        hasExclusion,
      });
    },
    []
  );

  // 컨텍스트 메뉴 닫기
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 제외일 추가 모달 열기
  const handleOpenAddExclusionModal = useCallback((date: string) => {
    setAddExclusionModal({ isOpen: true, date });
  }, []);

  // 제외일 추가 모달 닫기
  const handleCloseAddExclusionModal = useCallback(() => {
    setAddExclusionModal({ isOpen: false, date: "" });
  }, []);

  // 제외일 삭제 핸들러
  const handleRemoveExclusion = useCallback(
    (date: string) => {
      const exclusion = exclusionsByDate[date];
      if (!exclusion) return;

      startRemoveTransition(async () => {
        try {
          await removePlannerExclusionAction(exclusion.id);
          toast.showToast(`${date} 제외일이 해제되었습니다.`, "success");
          onRefresh();
        } catch (error) {
          console.error("제외일 삭제 오류:", error);
          toast.showToast(
            error instanceof Error ? error.message : "제외일 해제에 실패했습니다.",
            "error"
          );
        }
      });
    },
    [exclusionsByDate, toast, onRefresh]
  );

  // 제외일 토글 핸들러 (하위 컴포넌트에서 사용)
  const handleExclusionToggle = useCallback(
    (date: string, hasExclusion: boolean) => {
      if (hasExclusion) {
        handleRemoveExclusion(date);
      } else {
        handleOpenAddExclusionModal(date);
      }
    },
    [handleRemoveExclusion, handleOpenAddExclusionModal]
  );

  // 플랜 데이터 페칭
  const {
    plansByDate: rawPlansByDate,
    plans: rawPlans,
    isLoading: isPlansLoading,
    isError: isPlansError,
    invalidate: invalidatePlans,
  } = useAdminCalendarData({
    studentId,
    currentMonth,
    plannerId: plannerId || undefined,
  });

  // 그룹 필터링 적용
  const plans = useMemo(() => {
    if (selectedGroupId === null || selectedGroupId === undefined) return rawPlans;
    return rawPlans.filter(plan => plan.plan_group_id === selectedGroupId);
  }, [rawPlans, selectedGroupId]);

  // 필터링된 플랜으로 날짜별 그룹핑
  const plansByDate = useMemo(() => {
    if (selectedGroupId === null || selectedGroupId === undefined) return rawPlansByDate;
    const filtered: Record<string, typeof rawPlans> = {};
    for (const [date, datePlans] of Object.entries(rawPlansByDate)) {
      const filteredPlans = datePlans.filter(plan => plan.plan_group_id === selectedGroupId);
      if (filteredPlans.length > 0) {
        filtered[date] = filteredPlans;
      }
    }
    return filtered;
  }, [rawPlansByDate, selectedGroupId]);

  // 선택 상태 관리
  const {
    selectedIds,
    selectedPlans,
    selectedCount,
    isSelectionMode,
    isSelected,
    toggleSelection,
    selectRange,
    selectAll,
    clearSelection,
    toggleSelectionMode,
  } = useCalendarSelection({ plans });

  // 플랜 선택 핸들러 (Shift 클릭 지원)
  const handlePlanSelect = useCallback(
    (planId: string, shiftKey: boolean) => {
      if (shiftKey) {
        selectRange(planId);
      } else {
        toggleSelection(planId);
      }
    },
    [selectRange, toggleSelection]
  );

  // 간트 뷰 행 데이터 (콘텐츠별 그룹핑)
  const ganttRows = useMemo(() => {
    // 콘텐츠별 그룹핑
    const groupedByContent = new Map<string, typeof plans>();

    for (const plan of plans) {
      const key = plan.content_id || plan.custom_title || plan.id;
      const label = plan.custom_title || plan.content_title || "플랜";

      if (!groupedByContent.has(key)) {
        groupedByContent.set(key, []);
      }
      groupedByContent.get(key)!.push(plan);
    }

    return Array.from(groupedByContent.entries()).map(([id, groupPlans]) => ({
      id,
      label: groupPlans[0]?.custom_title || groupPlans[0]?.content_title || "플랜",
      type: "content" as const,
      plans: groupPlans,
    }));
  }, [plans]);

  // 통합 새로고침 핸들러
  const handleRefreshAll = useCallback(() => {
    invalidatePlans();
    onRefresh();
  }, [invalidatePlans, onRefresh]);

  // 플랜 삭제 다이얼로그 열기
  const handlePlanDelete = useCallback(
    (planId: string) => {
      // plans에서 해당 플랜 찾아서 제목 가져오기
      const plan = plans.find((p) => p.id === planId);
      const title = plan?.custom_title || plan?.content_title || "플랜";
      setDeleteDialog({
        isOpen: true,
        planId,
        planTitle: title,
      });
    },
    [plans]
  );

  // 플랜 삭제 다이얼로그 닫기
  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialog({ isOpen: false, planId: "", planTitle: "" });
  }, []);

  // 플랜 삭제 확인 핸들러
  const handleConfirmDelete = useCallback(() => {
    if (!deleteDialog.planId) return;

    startDeleteTransition(async () => {
      try {
        const result = await deletePlanWithLogging({
          planId: deleteDialog.planId,
          planType: "plan",
          studentId,
          tenantId,
          reason: "관리자 캘린더에서 삭제",
        });

        if (result.success) {
          toast.showToast(`"${deleteDialog.planTitle}" 플랜이 삭제되었습니다.`, "success");
          handleCloseDeleteDialog();
          handleRefreshAll();
        } else {
          toast.showToast(result.error || "플랜 삭제에 실패했습니다.", "error");
        }
      } catch (error) {
        console.error("플랜 삭제 오류:", error);
        toast.showToast(
          error instanceof Error ? error.message : "플랜 삭제에 실패했습니다.",
          "error"
        );
      }
    });
  }, [deleteDialog, studentId, tenantId, toast, handleCloseDeleteDialog, handleRefreshAll]);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더: 뷰 전환 및 네비게이션 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        {/* 월 네비게이션 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-semibold min-w-[140px] text-center">
            {format(currentMonth, "yyyy년 M월", { locale: ko })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 선택 모드 토글 버튼 */}
          {viewMode === "month" && (
            <button
              onClick={toggleSelectionMode}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isSelectionMode
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              {isSelectionMode ? "선택 모드" : "다중 선택"}
            </button>
          )}

          {/* 뷰 전환 버튼 */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "month"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Calendar className="w-4 h-4" />
              월간
            </button>
            <button
              onClick={() => setViewMode("gantt")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "gantt"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              타임라인
            </button>
          </div>
        </div>
      </div>

      {/* 캘린더 뷰 본문 - DnD Provider로 감싸기 */}
      <AdminCalendarDragProvider
        studentId={studentId}
        tenantId={tenantId}
        exclusionsByDate={exclusionsByDate}
        onRefresh={handleRefreshAll}
      >
        <div className="flex-1 overflow-auto relative">
          {/* 로딩 오버레이 */}
          {isPlansLoading && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {/* 에러 표시 */}
          {isPlansError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm z-10">
              데이터를 불러오는데 실패했습니다
            </div>
          )}

          {viewMode === "month" ? (
            <AdminMonthView
              studentId={studentId}
              tenantId={tenantId}
              plannerId={plannerId}
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              onMonthChange={handleMonthChange}
              plansByDate={plansByDate}
              exclusionsByDate={exclusionsByDate}
              dailySchedulesByDate={dailySchedulesByDate}
              onPlanClick={handlePlanClick}
              onPlanEdit={handlePlanEdit}
              onPlanDelete={handlePlanDelete}
              onExclusionToggle={handleExclusionToggle}
              onContextMenu={handleContextMenu}
              onRefresh={handleRefreshAll}
              isSelectionMode={isSelectionMode}
              selectedPlanIds={selectedIds}
              onPlanSelect={handlePlanSelect}
            />
          ) : (
            <AdminGanttView
              studentId={studentId}
              tenantId={tenantId}
              plannerId={plannerId}
              dateRange={ganttDateRange}
              onDateRangeChange={setGanttDateRange}
              rows={ganttRows}
              exclusionsByDate={exclusionsByDate}
              onPlanClick={handlePlanClick}
              onRefresh={handleRefreshAll}
            />
          )}
        </div>
      </AdminCalendarDragProvider>

      {/* 컨텍스트 메뉴 */}
      <AdminCalendarContextMenu
        state={contextMenu}
        onClose={handleCloseContextMenu}
        onAddExclusion={handleOpenAddExclusionModal}
        onRemoveExclusion={handleRemoveExclusion}
      />

      {/* 제외일 추가 모달 */}
      <AddExclusionModal
        isOpen={addExclusionModal.isOpen}
        onClose={handleCloseAddExclusionModal}
        date={addExclusionModal.date}
        plannerId={plannerId}
        onSuccess={handleRefreshAll}
      />

      {/* 플랜 편집 모달 */}
      {editPlanModal.isOpen && editPlanModal.planId && (
        <EditPlanModal
          planId={editPlanModal.planId}
          studentId={studentId}
          tenantId={tenantId}
          onClose={handleCloseEditPlanModal}
          onSuccess={handleRefreshAll}
        />
      )}

      {/* 플랜 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={handleCloseDeleteDialog}
        title="플랜 삭제"
        description={`"${deleteDialog.planTitle}" 플랜을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* 배치 액션 툴바 (선택 모드에서 플랜 선택 시 표시) */}
      {isSelectionMode && (
        <BatchActionsToolbar
          selectedPlans={selectedPlans}
          selectedCount={selectedCount}
          onClearSelection={clearSelection}
          onSelectAll={selectAll}
          onExitSelectionMode={toggleSelectionMode}
          onRefresh={handleRefreshAll}
          studentId={studentId}
          tenantId={tenantId}
          totalPlans={plans.length}
        />
      )}
    </div>
  );
}
