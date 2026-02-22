"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { movePlanToContainer } from "@/lib/domains/calendar/actions/legacyBridge";
import { placePlanAtTime } from "@/lib/domains/plan/actions/move";
import { generatePlansFromGroupAction } from "@/lib/domains/plan/actions/plan-groups/plans";
import { checkPlansExistAction } from "@/lib/domains/plan/actions/plan-groups";
import { updatePlanGroupStatus } from "@/lib/domains/plan/actions/plan-groups/status";
import {
  PlanDndProvider,
  getBaseContainerType,
  type ContainerType,
  type EmptySlotDropData,
} from "./dnd";
import { PlanToastProvider } from "./PlanToast";
import { UndoProvider, useUndo } from "./UndoSnackbar";
import {
  useKeyboardShortcuts,
  type ShortcutConfig,
} from "./useKeyboardShortcuts";
import {
  AddContentWizard,
  AddAdHocModal,
  RedistributeModal,
  ShortcutsHelpModal,
  AdminAIPlanModalV2,
  AdminPlanCreationWizard7Step,
  AdminQuickPlanModal,
  UnifiedPlanAddModal,
  PlanOptimizationPanel,
  EditPlanModal,
  ReorderPlansModal,
  ConditionalDeleteModal,
  PlanTemplateModal,
  MoveToGroupModal,
  CopyPlanModal,
  PlanStatusModal,
  BulkEditModal,
  PlanGroupManageModal,
  ContentDependencyModal,
  BatchOperationsModal,
  AdminBlockSetCreateModal,
} from "./dynamicModals";
import { MarkdownExportModal } from "./MarkdownExportModal";
import { getTodayInTimezone } from "@/lib/utils/dateUtils";
import { shiftDay, shiftWeek, shiftMonth } from "./utils/weekDateUtils";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import type { TimeSlot } from "@/lib/types/plan-generation";
import type { PrefetchedDockData, Planner } from "@/lib/domains/admin-plan/actions";
import type { CalendarView } from "./CalendarNavHeader";

// Context
import { AdminPlanProvider, useAdminPlan, type ViewMode } from "./context/AdminPlanContext";

// Calendar Layout Components
import { CalendarLayoutShell } from "./CalendarLayoutShell";
import { CalendarTopBar } from "./CalendarTopBar";
import { CalendarSidebar } from "./CalendarSidebar";
import { CalendarMainContent } from "./CalendarMainContent";
import { MiniMonthCalendar } from "./MiniMonthCalendar";
import { TopBarCenterSlotPortal } from "@/components/layout/TopBarCenterSlotContext";

// 뷰 모드 타입 (export for backward compatibility)
export type AdminViewMode = "dock" | "month" | "gantt";

// 콘텐츠 유형 필터 타입 (export for backward compatibility)
export type ContentTypeFilter = "all" | "book" | "lecture" | "custom";

// 플랜 그룹 요약 정보 타입
export interface PlanGroupSummary {
  id: string;
  name: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  planPurpose: string | null;
}

interface AdminPlanManagementProps {
  studentId: string;
  studentName: string;
  tenantId: string;
  initialDate: string;
  activePlanGroupId: string | null;
  allPlanGroups?: PlanGroupSummary[];
  selectedPlannerId?: string;
  autoOpenWizard?: boolean;
  plannerDailySchedules?: DailyScheduleInfo[][];
  plannerExclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  /** 플래너 레벨에서 계산된 스케줄 (플랜 그룹 없이도 주차/일차 표시용) */
  plannerCalculatedSchedule?: DailyScheduleInfo[];
  /** 플래너 레벨에서 계산된 시간대별 타임슬롯 */
  plannerDateTimeSlots?: Record<string, TimeSlot[]>;
  /** SSR 프리페치된 Dock 데이터 (초기 로딩 최적화) */
  initialDockData?: PrefetchedDockData;
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode?: ViewMode;
  /** 현재 사용자 ID (권한 확인용) */
  currentUserId?: string;
  /** 선택된 플래너 데이터 (권한 확인용) */
  selectedPlanner?: Planner | null;
}

export function AdminPlanManagement(props: AdminPlanManagementProps) {
  return (
    <AdminPlanProvider
      studentId={props.studentId}
      studentName={props.studentName}
      tenantId={props.tenantId}
      initialDate={props.initialDate}
      activePlanGroupId={props.activePlanGroupId}
      allPlanGroups={props.allPlanGroups}
      selectedPlannerId={props.selectedPlannerId}
      plannerDailySchedules={props.plannerDailySchedules}
      plannerExclusions={props.plannerExclusions}
      plannerCalculatedSchedule={props.plannerCalculatedSchedule}
      plannerDateTimeSlots={props.plannerDateTimeSlots}
      initialDockData={props.initialDockData}
      viewMode={props.viewMode}
      currentUserId={props.currentUserId}
      selectedPlanner={props.selectedPlanner}
    >
      <PlanToastProvider>
        <UndoProviderWrapper>
          <AdminPlanManagementContent
            autoOpenWizard={props.autoOpenWizard}
            studentName={props.studentName}
          />
        </UndoProviderWrapper>
      </PlanToastProvider>
    </AdminPlanProvider>
  );
}

function UndoProviderWrapper({ children }: { children: ReactNode }) {
  const { handleRefresh } = useAdminPlan();
  return <UndoProvider onRefresh={handleRefresh}>{children}</UndoProvider>;
}

interface AdminPlanManagementContentProps {
  autoOpenWizard?: boolean;
  studentName: string;
}

function AdminPlanManagementContent({
  autoOpenWizard = false,
  studentName,
}: AdminPlanManagementContentProps) {
  const ctx = useAdminPlan();
  const {
    studentId,
    tenantId,
    selectedPlannerId,
    selectedPlanner,
    activePlanGroupId,
    allPlanGroups,
    selectedDate,
    handleDateChange,
    handleRefresh,
    refreshDaily,
    refreshDailyAndWeekly,
    refreshDailyAndUnfinished,
    canCreatePlans,
    // Modal setters
    setShowCreateWizard,
    setShowAIPlanModal,
    setShowOptimizationPanel,
    setShowShortcutsHelp,
    closeAllModals,
    openUnifiedModal,
    // Modal states
    showAddContentModal,
    setShowAddContentModal,
    showAddAdHocModal,
    setShowAddAdHocModal,
    showRedistributeModal,
    setShowRedistributeModal,
    showShortcutsHelp,
    showAIPlanModal,
    showCreateWizard,
    showOptimizationPanel,
    showQuickPlanModal,
    setShowQuickPlanModal,
    showUnifiedAddModal,
    setShowUnifiedAddModal,
    unifiedModalMode,
    showEditModal,
    setShowEditModal,
    showReorderModal,
    setShowReorderModal,
    showConditionalDeleteModal,
    setShowConditionalDeleteModal,
    showTemplateModal,
    setShowTemplateModal,
    showMoveToGroupModal,
    setShowMoveToGroupModal,
    showCopyModal,
    setShowCopyModal,
    showStatusModal,
    setShowStatusModal,
    showBulkEditModal,
    setShowBulkEditModal,
    showPlanGroupManageModal,
    setShowPlanGroupManageModal,
    showContentDependencyModal,
    setShowContentDependencyModal,
    showBatchOperationsModal,
    setShowBatchOperationsModal,
    showBlockSetCreateModal,
    setShowBlockSetCreateModal,
    showMarkdownExportModal,
    setShowMarkdownExportModal,
    // Modal data
    selectedPlanForRedistribute,
    setSelectedPlanForRedistribute,
    selectedPlanForEdit,
    setSelectedPlanForEdit,
    reorderContainerType,
    templatePlanIds,
    setTemplatePlanIds,
    selectedPlansForMove,
    setSelectedPlansForMove,
    currentGroupIdForMove,
    setCurrentGroupIdForMove,
    selectedPlansForCopy,
    setSelectedPlansForCopy,
    selectedPlanForStatus,
    setSelectedPlanForStatus,
    selectedPlansForBulkEdit,
    setSelectedPlansForBulkEdit,
    newGroupIdForAI,
    setNewGroupIdForAI,
    // Content dependency modal data
    selectedContentForDependency,
    setSelectedContentForDependency,
    // Batch operations modal data
    selectedPlansForBatch,
    setSelectedPlansForBatch,
    batchOperationMode,
    setBatchOperationMode,
    // 빈 시간 슬롯 플랜 추가
    slotTimeForNewPlan,
    setSlotTimeForNewPlan,
    toast,
  } = ctx;

  // 위저드 자동 오픈 (URL 파라미터로 트리거)
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (autoOpenWizard && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setShowCreateWizard(true);
    }
  }, [autoOpenWizard, setShowCreateWizard]);

  // 날짜 이동 헬퍼
  const navigateDate = useCallback(
    (days: number) => {
      const current = new Date(selectedDate + "T00:00:00");
      current.setDate(current.getDate() + days);
      handleDateChange(current.toISOString().split("T")[0]);
    },
    [selectedDate, handleDateChange]
  );

  // DnD 이동 핸들러
  const handleMoveItem = useCallback(
    async (
      itemId: string,
      itemType: "plan" | "adhoc",
      fromContainer: ContainerType,
      toContainer: ContainerType,
      targetDate?: string
    ) => {
      const effectiveTargetDate = targetDate ?? selectedDate;
      const fromBaseType = getBaseContainerType(fromContainer);
      const toBaseType = getBaseContainerType(toContainer);

      const result = await movePlanToContainer({
        planId: itemId,
        planType: itemType,
        fromContainer: fromBaseType,
        toContainer: toBaseType,
        studentId,
        tenantId,
        targetDate: toBaseType === "daily" ? effectiveTargetDate : undefined,
      });

      if (!result.success) {
        console.error("Failed to move plan:", result.error);
      }

      if (targetDate && targetDate !== selectedDate) {
        handleDateChange(targetDate);
      } else {
        // 영향받는 컨테이너만 타겟 무효화
        const containers = new Set([fromBaseType, toBaseType]);
        if (containers.has('daily') && containers.has('weekly')) {
          refreshDailyAndWeekly();
        } else if (containers.has('daily') && containers.has('unfinished')) {
          refreshDailyAndUnfinished();
        } else {
          handleRefresh();
        }
      }
    },
    [studentId, tenantId, selectedDate, handleRefresh, refreshDailyAndWeekly, refreshDailyAndUnfinished, handleDateChange]
  );

  // DnD 재정렬 핸들러 (같은 컨테이너 내에서 순서 변경)
  const handleReorderItems = useCallback(
    async (
      containerId: ContainerType,
      activeId: string,
      overId: string
    ) => {
      // containerId가 없으면 무시
      if (!containerId) return;

      // daily 컨테이너에서만 재정렬 지원
      if (containerId !== "daily" && !containerId.startsWith("daily-")) {
        return;
      }

      // 현재 플랜 목록에서 순서 계산은 DailyDock 내부에서 처리
      // 여기서는 단순히 새로고침만 수행 (DailyDock이 내부적으로 처리)
      // Note: 실제 재정렬 로직은 DailyDock의 handleReorderPlans에서 처리됨
      refreshDaily();
    },
    [refreshDaily]
  );

  // 빈 시간 슬롯에 드롭 시 핸들러 (해당 시간에 플랜 배치)
  const handleDropOnEmptySlot = useCallback(
    async (
      itemId: string,
      itemType: "plan" | "adhoc",
      fromContainer: ContainerType,
      slotData: EmptySlotDropData
    ) => {
      const result = await placePlanAtTime(
        itemId,
        itemType,
        slotData.startTime,
        slotData.endTime,
        selectedDate
      );

      if (result.success) {
        toast.showSuccess(
          `플랜을 ${slotData.startTime} ~ ${result.endTime}에 배치했습니다.`
        );
        // source 컨테이너에 따라 타겟 무효화
        const fromBase = getBaseContainerType(fromContainer);
        if (fromBase === 'weekly') {
          refreshDailyAndWeekly();
        } else if (fromBase === 'unfinished') {
          refreshDailyAndUnfinished();
        } else {
          refreshDaily();
        }
      } else {
        toast.showError(result.error || "플랜 배치에 실패했습니다.");
      }
    },
    [selectedDate, refreshDaily, refreshDailyAndWeekly, refreshDailyAndUnfinished, toast]
  );

  // 캘린더 뷰 상태 (PlannerTab에서 리프팅)
  const [calendarView, setCalendarView] = useState<CalendarView>('weekly');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showGoToDate, setShowGoToDate] = useState(false);

  // localStorage 복원 (캘린더 뷰 + 사이드바)
  useEffect(() => {
    const savedView = localStorage.getItem('dailyDock_viewLayout');
    if (savedView === 'list' || savedView === 'grid') {
      setCalendarView('daily');
      localStorage.setItem('dailyDock_viewLayout', 'daily');
    } else if (savedView === 'weeklyGrid') {
      setCalendarView('weekly');
      localStorage.setItem('dailyDock_viewLayout', 'weekly');
    } else if (savedView === 'daily' || savedView === 'weekly' || savedView === 'month') {
      setCalendarView(savedView as CalendarView);
    }

    const savedSidebar = localStorage.getItem('calendarLayout_sidebarOpen');
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar === 'true');
    }
  }, []);

  const handleCalendarViewChange = useCallback((view: CalendarView) => {
    setCalendarView(view);
    localStorage.setItem('dailyDock_viewLayout', view);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('calendarLayout_sidebarOpen', String(next));
      return next;
    });
  }, []);

  // Undo 컨텍스트
  const { triggerUndo } = useUndo();

  // 키보드 단축키 설정
  const shortcuts: ShortcutConfig[] = useMemo(
    () => [
      {
        key: "ArrowLeft",
        action: () => {
          if (calendarView === 'daily') navigateDate(-1);
          else if (calendarView === 'weekly') handleDateChange(shiftWeek(selectedDate, -1));
          else handleDateChange(shiftMonth(selectedDate, -1));
        },
        description: "이전 기간",
        category: "navigation",
      },
      {
        key: "ArrowRight",
        action: () => {
          if (calendarView === 'daily') navigateDate(1);
          else if (calendarView === 'weekly') handleDateChange(shiftWeek(selectedDate, 1));
          else handleDateChange(shiftMonth(selectedDate, 1));
        },
        description: "다음 기간",
        category: "navigation",
      },
      {
        key: "t",
        action: () => handleDateChange(getTodayInTimezone()),
        description: "오늘로 이동",
        category: "navigation",
      },
      {
        key: "d",
        action: () => handleCalendarViewChange('daily'),
        description: "일간 뷰",
        category: "navigation",
      },
      {
        key: "w",
        action: () => handleCalendarViewChange('weekly'),
        description: "주간 뷰",
        category: "navigation",
      },
      {
        key: "m",
        action: () => handleCalendarViewChange('month'),
        description: "월간 뷰",
        category: "navigation",
      },
      {
        key: "[",
        action: toggleSidebar,
        description: "사이드바 토글",
        category: "navigation",
      },
      {
        key: "r",
        action: handleRefresh,
        description: "새로고침",
        category: "action",
      },
      {
        key: "n",
        action: () => canCreatePlans && openUnifiedModal("content"),
        description: "콘텐츠 플랜 추가",
        category: "modal",
      },
      {
        key: "a",
        action: () => canCreatePlans && openUnifiedModal("quick"),
        description: "빠른 플랜 추가",
        category: "modal",
      },
      {
        key: "?",
        shift: true,
        action: () => setShowShortcutsHelp(true),
        description: "단축키 도움말",
        category: "modal",
      },
      {
        key: "Escape",
        action: () => { closeAllModals(); setShowGoToDate(false); },
        description: "모달 닫기",
        category: "modal",
      },
      {
        key: "g",
        shift: true,
        action: () => setShowGoToDate(true),
        description: "날짜로 이동",
        category: "navigation",
      },
      {
        key: "q",
        action: () => canCreatePlans && openUnifiedModal("quick"),
        description: "빠른 플랜 추가",
        category: "modal",
      },
      {
        key: "i",
        action: () => selectedPlannerId && setShowAIPlanModal(true),
        description: "AI 플랜 생성",
        category: "modal",
      },
      {
        key: "g",
        action: () => canCreatePlans && setShowCreateWizard(true),
        description: "플랜 그룹 생성",
        category: "modal",
      },
      {
        key: "o",
        action: () => setShowOptimizationPanel(true),
        description: "AI 플랜 최적화",
        category: "modal",
      },
      {
        key: "z",
        ctrl: true,
        action: triggerUndo,
        description: "실행취소 (Undo)",
        category: "action",
      },
      {
        key: "z",
        action: triggerUndo,
        description: "실행취소",
        category: "action",
      },
    ],
    [
      calendarView,
      selectedDate,
      navigateDate,
      handleRefresh,
      handleDateChange,
      handleCalendarViewChange,
      toggleSidebar,
      activePlanGroupId,
      canCreatePlans,
      openUnifiedModal,
      setShowShortcutsHelp,
      closeAllModals,
      setShowAIPlanModal,
      setShowCreateWizard,
      setShowOptimizationPanel,
      triggerUndo,
    ]
  );

  useKeyboardShortcuts({ shortcuts });

  return (
    <>
      <PlanDndProvider
          onMoveItem={handleMoveItem}
          onReorderItems={handleReorderItems}
          onDropOnEmptySlot={handleDropOnEmptySlot}
        >
        <TopBarCenterSlotPortal>
          <CalendarTopBar
            variant="topbar"
            activeView={calendarView}
            onViewChange={handleCalendarViewChange}
            selectedDate={selectedDate}
            onNavigate={handleDateChange}
            onToggleSidebar={toggleSidebar}
            onGoToDate={() => setShowGoToDate(true)}
          />
        </TopBarCenterSlotPortal>

        <CalendarLayoutShell
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          header={
            <CompactPlannerHeader
              studentId={studentId}
              studentName={studentName}
              planner={selectedPlanner}
            />
          }
          sidebar={<CalendarSidebar />}
        >
          <CalendarMainContent
            calendarView={calendarView}
            onCalendarViewChange={handleCalendarViewChange}
          />
        </CalendarLayoutShell>

          {/* 모달들 */}
          {showAddContentModal && selectedPlannerId && (
            <AddContentWizard
              studentId={studentId}
              tenantId={tenantId}
              targetDate={selectedDate}
              plannerId={selectedPlannerId}
              onClose={() => setShowAddContentModal(false)}
              onSuccess={() => {
                setShowAddContentModal(false);
                handleRefresh();
              }}
            />
          )}

          {showAddAdHocModal && selectedPlannerId && (
            <AddAdHocModal
              studentId={studentId}
              tenantId={tenantId}
              plannerId={selectedPlannerId}
              planGroupId={activePlanGroupId ?? undefined}
              targetDate={selectedDate}
              onClose={() => setShowAddAdHocModal(false)}
              onSuccess={() => {
                setShowAddAdHocModal(false);
                refreshDaily();
              }}
            />
          )}

          {showRedistributeModal && selectedPlanForRedistribute && (
            <RedistributeModal
              planId={selectedPlanForRedistribute}
              studentId={studentId}
              tenantId={tenantId}
              onClose={() => {
                setShowRedistributeModal(false);
                setSelectedPlanForRedistribute(null);
              }}
              onSuccess={() => {
                setShowRedistributeModal(false);
                setSelectedPlanForRedistribute(null);
                handleRefresh();
              }}
            />
          )}

          {showShortcutsHelp && (
            <ShortcutsHelpModal
              shortcuts={shortcuts.filter((s) => s.key !== "Escape")}
              onClose={() => setShowShortcutsHelp(false)}
            />
          )}

          {/* AI 플랜 모달: V2 슬롯 기반 위저드 (플래너→슬롯→AI추천→생성) */}
          {showAIPlanModal && !newGroupIdForAI && (
            <AdminAIPlanModalV2
              studentId={studentId}
              tenantId={tenantId}
              onClose={() => setShowAIPlanModal(false)}
              onSuccess={() => {
                setShowAIPlanModal(false);
                handleRefresh();
              }}
            />
          )}

          {showCreateWizard && selectedPlannerId && (
            <AdminPlanCreationWizard7Step
              studentId={studentId}
              tenantId={tenantId}
              studentName={studentName}
              plannerId={selectedPlannerId}
              onClose={() => setShowCreateWizard(false)}
              onSuccess={async (groupId, generateAI) => {
                setShowCreateWizard(false);
                if (generateAI) {
                  setNewGroupIdForAI(groupId);
                  setShowAIPlanModal(true);
                } else {
                  try {
                    try {
                      await updatePlanGroupStatus(groupId, "saved");
                    } catch (statusError) {
                      const errorMessage =
                        statusError instanceof Error
                          ? statusError.message
                          : "플랜 그룹 상태 업데이트에 실패했습니다.";
                      toast.showError(errorMessage);
                      handleRefresh();
                      return;
                    }

                    const result = await generatePlansFromGroupAction(groupId);
                    const checkResult = await checkPlansExistAction(groupId);
                    if (!checkResult.hasPlans) {
                      toast.showError(
                        "플랜 생성에 실패했습니다. 플랜이 생성되지 않았습니다."
                      );
                      handleRefresh();
                      return;
                    }

                    toast.showSuccess(
                      `플랜이 생성되었습니다. (총 ${result.count}개)`
                    );
                    handleRefresh();
                  } catch (err) {
                    console.error("[AdminPlanManagement] 플랜 생성 실패:", err);
                    const errorMessage =
                      err instanceof Error
                        ? err.message
                        : "플랜 생성에 실패했습니다.";
                    toast.showError(errorMessage);
                    handleRefresh();
                  }
                }
              }}
            />
          )}

          {/* AI 플랜 모달: 위저드에서 생성된 새 그룹용 */}
          {showAIPlanModal && newGroupIdForAI && (
            <AdminAIPlanModalV2
              studentId={studentId}
              tenantId={tenantId}
              onClose={() => {
                setShowAIPlanModal(false);
                setNewGroupIdForAI(null);
              }}
              onSuccess={() => {
                setShowAIPlanModal(false);
                setNewGroupIdForAI(null);
                handleRefresh();
              }}
            />
          )}

          {showQuickPlanModal && selectedPlannerId && (
            <AdminQuickPlanModal
              studentId={studentId}
              tenantId={tenantId}
              studentName={studentName}
              targetDate={selectedDate}
              plannerId={selectedPlannerId}
              onClose={() => setShowQuickPlanModal(false)}
              onSuccess={() => {
                setShowQuickPlanModal(false);
                refreshDaily();
              }}
            />
          )}

          {showUnifiedAddModal && selectedPlannerId && (
            <UnifiedPlanAddModal
              isOpen={showUnifiedAddModal}
              studentId={studentId}
              tenantId={tenantId}
              targetDate={selectedDate}
              plannerId={selectedPlannerId}
              planGroupId={activePlanGroupId ?? undefined}
              initialMode={unifiedModalMode}
              slotStartTime={slotTimeForNewPlan?.startTime}
              slotEndTime={slotTimeForNewPlan?.endTime}
              onClose={() => {
                setShowUnifiedAddModal(false);
                setSlotTimeForNewPlan(null);
              }}
              onSuccess={() => {
                setShowUnifiedAddModal(false);
                setSlotTimeForNewPlan(null);
                refreshDaily();
              }}
            />
          )}

          {showEditModal && selectedPlanForEdit && (
            <EditPlanModal
              planId={selectedPlanForEdit}
              studentId={studentId}
              tenantId={tenantId}
              onClose={() => {
                setShowEditModal(false);
                setSelectedPlanForEdit(null);
              }}
              onSuccess={() => {
                setShowEditModal(false);
                setSelectedPlanForEdit(null);
                handleRefresh();
              }}
            />
          )}

          {showReorderModal && (
            <ReorderPlansModal
              studentId={studentId}
              targetDate={selectedDate}
              containerType={reorderContainerType}
              onClose={() => setShowReorderModal(false)}
              onSuccess={() => {
                setShowReorderModal(false);
                handleRefresh();
              }}
            />
          )}

          {showConditionalDeleteModal && (
            <ConditionalDeleteModal
              studentId={studentId}
              tenantId={tenantId}
              onClose={() => setShowConditionalDeleteModal(false)}
              onSuccess={() => {
                setShowConditionalDeleteModal(false);
                handleRefresh();
              }}
            />
          )}

          {showPlanGroupManageModal && (
            <PlanGroupManageModal
              open={showPlanGroupManageModal}
              studentId={studentId}
              planGroups={allPlanGroups.map((g) => ({
                ...g,
                planType: undefined,
                campInvitationId: undefined,
              }))}
              onClose={() => setShowPlanGroupManageModal(false)}
              onSuccess={handleRefresh}
            />
          )}

          {showTemplateModal && (
            <PlanTemplateModal
              studentId={studentId}
              planIds={templatePlanIds.length > 0 ? templatePlanIds : undefined}
              targetDate={selectedDate}
              planGroupId={activePlanGroupId ?? undefined}
              onClose={() => {
                setShowTemplateModal(false);
                setTemplatePlanIds([]);
              }}
              onSuccess={() => {
                setShowTemplateModal(false);
                setTemplatePlanIds([]);
                handleRefresh();
              }}
            />
          )}

          {showMoveToGroupModal && (
            <MoveToGroupModal
              planIds={selectedPlansForMove}
              studentId={studentId}
              currentGroupId={currentGroupIdForMove}
              onClose={() => {
                setShowMoveToGroupModal(false);
                setSelectedPlansForMove([]);
                setCurrentGroupIdForMove(null);
              }}
              onSuccess={() => {
                setShowMoveToGroupModal(false);
                setSelectedPlansForMove([]);
                setCurrentGroupIdForMove(null);
                handleRefresh();
              }}
            />
          )}

          {showCopyModal && selectedPlansForCopy.length > 0 && (
            <CopyPlanModal
              planIds={selectedPlansForCopy}
              studentId={studentId}
              onClose={() => {
                setShowCopyModal(false);
                setSelectedPlansForCopy([]);
              }}
              onSuccess={() => {
                setShowCopyModal(false);
                setSelectedPlansForCopy([]);
                handleRefresh();
              }}
            />
          )}

          {showStatusModal && selectedPlanForStatus && (
            <PlanStatusModal
              planId={selectedPlanForStatus.id}
              studentId={studentId}
              currentStatus={
                selectedPlanForStatus.status as
                  | "pending"
                  | "in_progress"
                  | "completed"
                  | "skipped"
                  | "cancelled"
              }
              planTitle={selectedPlanForStatus.title}
              onClose={() => {
                setShowStatusModal(false);
                setSelectedPlanForStatus(null);
              }}
              onSuccess={() => {
                setShowStatusModal(false);
                setSelectedPlanForStatus(null);
                refreshDailyAndUnfinished();
              }}
            />
          )}

          {showBulkEditModal && selectedPlansForBulkEdit.length > 0 && (
            <BulkEditModal
              planIds={selectedPlansForBulkEdit}
              studentId={studentId}
              onClose={() => {
                setShowBulkEditModal(false);
                setSelectedPlansForBulkEdit([]);
              }}
              onSuccess={() => {
                setShowBulkEditModal(false);
                setSelectedPlansForBulkEdit([]);
                handleRefresh();
              }}
            />
          )}

          {showContentDependencyModal && selectedContentForDependency && (
            <ContentDependencyModal
              content={selectedContentForDependency}
              planGroupId={activePlanGroupId}
              onClose={() => {
                setShowContentDependencyModal(false);
                setSelectedContentForDependency(null);
              }}
              onSuccess={() => {
                handleRefresh();
              }}
            />
          )}

          {showBatchOperationsModal &&
            selectedPlansForBatch.length > 0 &&
            batchOperationMode && (
              <BatchOperationsModal
                planIds={selectedPlansForBatch}
                mode={batchOperationMode}
                studentId={studentId}
                tenantId={tenantId}
                onClose={() => {
                  setShowBatchOperationsModal(false);
                  setSelectedPlansForBatch([]);
                  setBatchOperationMode(null);
                }}
                onSuccess={() => {
                  setShowBatchOperationsModal(false);
                  setSelectedPlansForBatch([]);
                  setBatchOperationMode(null);
                  handleRefresh();
                }}
              />
            )}

          {showBlockSetCreateModal && (
            <AdminBlockSetCreateModal
              studentId={studentId}
              onClose={() => setShowBlockSetCreateModal(false)}
              onSuccess={() => {
                setShowBlockSetCreateModal(false);
                handleRefresh();
              }}
            />
          )}

          {showMarkdownExportModal && (
            <MarkdownExportModal
              isOpen={showMarkdownExportModal}
              onClose={() => setShowMarkdownExportModal(false)}
            />
          )}

          {/* 날짜로 이동 다이얼로그 */}
          {showGoToDate && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
              onClick={() => setShowGoToDate(false)}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 w-[280px]"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-medium text-gray-700 mb-2">날짜로 이동</h3>
                <MiniMonthCalendar
                  selectedDate={selectedDate}
                  onDateSelect={(date) => {
                    handleDateChange(date);
                    setShowGoToDate(false);
                  }}
                />
              </div>
            </div>
          )}

          <PlanOptimizationPanel
            studentId={studentId}
            studentName={studentName}
            planGroupId={activePlanGroupId ?? undefined}
            open={showOptimizationPanel}
            onOpenChange={setShowOptimizationPanel}
            hideTrigger
          />
      </PlanDndProvider>
    </>
  );
}

/**
 * Compact Planner Header (한 줄 표시)
 */
function CompactPlannerHeader({
  studentId,
  studentName,
  planner,
}: {
  studentId: string;
  studentName: string;
  planner?: Planner | null;
}) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: '초안', className: 'bg-gray-100 text-gray-700' },
    active: { label: '진행중', className: 'bg-green-100 text-green-700' },
    paused: { label: '일시중지', className: 'bg-yellow-100 text-yellow-700' },
    completed: { label: '완료', className: 'bg-blue-100 text-blue-700' },
    archived: { label: '보관됨', className: 'bg-gray-100 text-gray-500' },
  };

  const config = statusConfig[planner?.status ?? 'draft'] || statusConfig.draft;

  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">
      <Link
        href={`/admin/students/${studentId}/plans`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">플래너 선택</span>
      </Link>

      <div className="h-4 w-px bg-gray-300" />

      <h1 className="text-sm font-semibold text-gray-900 truncate">
        플랜 관리: {studentName}
      </h1>

      {planner && (
        <>
          <span className="text-xs text-gray-500 hidden md:inline">
            [{planner.name}]
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${config.className}`}>
            {config.label}
          </span>
        </>
      )}
    </div>
  );
}
