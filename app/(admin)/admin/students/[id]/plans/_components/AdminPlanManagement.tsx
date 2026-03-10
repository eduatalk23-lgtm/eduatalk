"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, Plus, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { movePlanToContainer } from "@/lib/domains/calendar/actions/calendarEventActions";
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
  EventEditModal,
} from "./dynamicModals";
import { MarkdownExportModal } from "./MarkdownExportModal";
import { getTodayInTimezone } from "@/lib/utils/dateUtils";
import { shiftDay, shiftWeek, shiftMonth, shiftYear, shiftCustomDays } from "./utils/weekDateUtils";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import type { TimeSlot } from "@/lib/types/plan-generation";
import type { PrefetchedDockData } from "@/lib/domains/admin-plan/actions";
import type { CalendarSettings } from "@/lib/domains/admin-plan/types";
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
export type AdminViewMode = "dock" | "month";


// 플랜 그룹 요약 정보 타입
export interface PlanGroupSummary {
  id: string;
  name: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  planPurpose: string | null;
}

export interface AdminPlanManagementProps {
  studentId: string;
  studentName: string;
  tenantId: string;
  initialDate: string;
  activePlanGroupId: string | null;
  allPlanGroups?: PlanGroupSummary[];
  /** Calendar-First: URL에서 직접 전달받은 calendarId */
  calendarId?: string;
  autoOpenWizard?: boolean;
  calendarDailySchedules?: DailyScheduleInfo[][];
  calendarExclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  /** 플래너 레벨에서 계산된 스케줄 (플랜 그룹 없이도 주차/일차 표시용) */
  calendarCalculatedSchedule?: DailyScheduleInfo[];
  /** 플래너 레벨에서 계산된 시간대별 타임슬롯 */
  calendarDateTimeSlots?: Record<string, TimeSlot[]>;
  /** SSR 프리페치된 Dock 데이터 (초기 로딩 최적화) */
  initialDockData?: PrefetchedDockData;
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode?: ViewMode;
  /** 현재 사용자 ID (권한 확인용) */
  currentUserId?: string;
  /** 선택된 플래너 데이터 (권한 확인용) */
  selectedCalendarSettings?: CalendarSettings | null;
  /** 학생 전환 드롭다운 (관리자 캘린더 전용) */
  studentSwitcher?: ReactNode;
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
      calendarId={props.calendarId ?? null}
      calendarDailySchedules={props.calendarDailySchedules}
      calendarExclusions={props.calendarExclusions}
      calendarCalculatedSchedule={props.calendarCalculatedSchedule}
      calendarDateTimeSlots={props.calendarDateTimeSlots}
      initialDockData={props.initialDockData}
      viewMode={props.viewMode}
      currentUserId={props.currentUserId}
      selectedCalendarSettings={props.selectedCalendarSettings}
    >
      <PlanToastProvider>
        <UndoProviderWrapper>
          <AdminPlanManagementContent
            autoOpenWizard={props.autoOpenWizard}
            studentName={props.studentName}
            studentSwitcher={props.studentSwitcher}
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
  studentSwitcher?: ReactNode;
}

function AdminPlanManagementContent({
  autoOpenWizard = false,
  studentName,
  studentSwitcher,
}: AdminPlanManagementContentProps) {
  const ctx = useAdminPlan();
  const {
    studentId,
    tenantId,
    selectedCalendarId,
    selectedCalendarSettings,
    activePlanGroupId,
    allPlanGroups,
    selectedDate,
    handleDateChange,
    handleRefresh,
    invalidateQueries,
    refreshDaily,
    canCreatePlans,
    isAdminMode,
    // Filter (TopBar에서 사용)
    searchQuery,
    setSearchQuery,
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

      // 캐시 무효화: 날짜 이동 시 월간/주간 캐시도 포함하여 전체 새로고침
      if (targetDate && targetDate !== selectedDate) {
        handleRefresh();
        handleDateChange(targetDate);
      } else {
        handleRefresh();
      }
    },
    [studentId, tenantId, selectedDate, handleRefresh, handleDateChange]
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
        refreshDaily();
      } else {
        toast.showError(result.error || "플랜 배치에 실패했습니다.");
      }
    },
    [selectedDate, refreshDaily, toast]
  );

  // 탭 네비게이션 (톱바 더보기 메뉴에서 사용)
  const handleTabNavigate = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      params.delete('view');
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
      // 강제 리렌더를 위해 router.push 대신 popstate 트리거
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    []
  );

  // 캘린더 뷰 상태 (CalendarSettingsTab에서 리프팅)
  const [calendarView, setCalendarView] = useState<CalendarView>('weekly');
  const [customDayCount, setCustomDayCount] = useState(7);
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

    const savedDayCount = localStorage.getItem('calendarLayout_customDayCount');
    if (savedDayCount) setCustomDayCount(Number(savedDayCount) || 7);

    const savedSidebar = localStorage.getItem('calendarLayout_sidebarOpen');
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar === 'true');
    }
  }, []);

  const handleCalendarViewChange = useCallback((view: CalendarView) => {
    setCalendarView(view);
    localStorage.setItem('dailyDock_viewLayout', view);
  }, []);

  const handleCustomDayCountChange = useCallback((count: number) => {
    setCustomDayCount(count);
    localStorage.setItem('calendarLayout_customDayCount', String(count));
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
          else if (calendarView === 'weekly') {
            if (customDayCount < 7) handleDateChange(shiftCustomDays(selectedDate, -1, customDayCount));
            else handleDateChange(shiftWeek(selectedDate, -1));
          }
          else if (calendarView === 'year') handleDateChange(shiftYear(selectedDate, -1));
          else handleDateChange(shiftMonth(selectedDate, -1));
        },
        description: "이전 기간",
        category: "navigation",
      },
      {
        key: "ArrowRight",
        action: () => {
          if (calendarView === 'daily') navigateDate(1);
          else if (calendarView === 'weekly') {
            if (customDayCount < 7) handleDateChange(shiftCustomDays(selectedDate, 1, customDayCount));
            else handleDateChange(shiftWeek(selectedDate, 1));
          }
          else if (calendarView === 'year') handleDateChange(shiftYear(selectedDate, 1));
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
        key: "y",
        action: () => handleCalendarViewChange('year'),
        description: "연간 뷰",
        category: "navigation",
      },
      {
        key: "l",
        action: () => handleCalendarViewChange('agenda'),
        description: "일정 목록 뷰",
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
        action: () => {
          // 검색 활성 상태면 검색 해제, 아니면 모달 닫기
          if (searchQuery) {
            setSearchQuery('');
          } else {
            closeAllModals();
            setShowGoToDate(false);
          }
        },
        description: "검색 해제 / 모달 닫기",
        category: "modal",
      },
      {
        key: "/",
        action: () => {
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
          const input = document.querySelector<HTMLInputElement>('[data-search-input]');
          input?.focus();
        },
        description: "이벤트 검색",
        category: "navigation",
      },
      {
        key: "g",
        action: () => setShowGoToDate(true),
        description: "날짜로 이동",
        category: "navigation",
      },
      {
        key: "g",
        shift: true,
        action: () => canCreatePlans && setShowCreateWizard(true),
        description: "플랜 그룹 생성",
        category: "modal",
      },
      {
        key: "q",
        action: () => canCreatePlans && openUnifiedModal("quick"),
        description: "빠른 플랜 추가",
        category: "modal",
      },
      {
        key: "i",
        action: () => selectedCalendarId && setShowAIPlanModal(true),
        description: "AI 플랜 생성",
        category: "modal",
      },
      {
        key: "o",
        action: () => setShowOptimizationPanel(true),
        description: "AI 플랜 최적화",
        category: "modal",
      },
      {
        key: "c",
        action: () => canCreatePlans && setShowCreateWizard(true),
        description: "플랜 생성 (풀 에디터)",
        category: "modal",
      },
      {
        key: "p",
        action: () => {
          if (calendarView === 'daily') navigateDate(-1);
          else if (calendarView === 'weekly') {
            if (customDayCount < 7) handleDateChange(shiftCustomDays(selectedDate, -1, customDayCount));
            else handleDateChange(shiftWeek(selectedDate, -1));
          }
          else if (calendarView === 'year') handleDateChange(shiftYear(selectedDate, -1));
          else handleDateChange(shiftMonth(selectedDate, -1));
        },
        description: "이전 기간 (← 동일)",
        category: "navigation",
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
      searchQuery,
      setSearchQuery,
      customDayCount,
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
            studentSwitcher={studentSwitcher}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenSettings={() => handleTabNavigate('settings')}
            onOpenAnalytics={() => handleTabNavigate('analytics')}
            onOpenProgress={() => handleTabNavigate('progress')}
            onOpenHistory={() => handleTabNavigate('history')}
            onOpenTemplate={() => setShowTemplateModal(true)}
            onOpenPlanGroupManage={() => setShowPlanGroupManageModal(true)}
            onOpenMarkdownExport={() => setShowMarkdownExportModal(true)}
            onOpenConditionalDelete={() => setShowConditionalDeleteModal(true)}
            onOpenShortcutsHelp={() => setShowShortcutsHelp(true)}
            isAdminMode={isAdminMode}
            customDayCount={customDayCount}
            onCustomDayCountChange={handleCustomDayCountChange}
          />
        </TopBarCenterSlotPortal>

        <CalendarLayoutShell
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          sidebar={<CalendarSidebar />}
        >
          <CalendarMainContent
            calendarView={calendarView}
            onCalendarViewChange={handleCalendarViewChange}
            customDayCount={customDayCount}
            onCustomDayCountChange={handleCustomDayCountChange}
          />
        </CalendarLayoutShell>

          {/* 모바일 FAB — md 이상에서는 숨김 */}
          {canCreatePlans && (
            <AdminCalendarFAB
              onQuickAdd={() => openUnifiedModal("quick")}
              onAIPlan={() => selectedCalendarId && setShowAIPlanModal(true)}
            />
          )}

          {/* 모달들 */}
          {showAddContentModal && canCreatePlans && (
            <AddContentWizard
              studentId={studentId}
              tenantId={tenantId}
              targetDate={selectedDate}
              calendarId={selectedCalendarId ?? undefined}
              onClose={() => setShowAddContentModal(false)}
              onSuccess={() => {
                setShowAddContentModal(false);
                handleRefresh();
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

          {showCreateWizard && canCreatePlans && (
            <AdminPlanCreationWizard7Step
              studentId={studentId}
              tenantId={tenantId}
              studentName={studentName}
              calendarId={selectedCalendarId ?? undefined}
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

          {showQuickPlanModal && canCreatePlans && (
            <AdminQuickPlanModal
              studentId={studentId}
              tenantId={tenantId}
              studentName={studentName}
              targetDate={selectedDate}
              calendarId={selectedCalendarId ?? ''}
              onClose={() => setShowQuickPlanModal(false)}
              onSuccess={() => {
                setShowQuickPlanModal(false);
                refreshDaily();
              }}
            />
          )}

          {showUnifiedAddModal && canCreatePlans && (
            <UnifiedPlanAddModal
              isOpen={showUnifiedAddModal}
              studentId={studentId}
              tenantId={tenantId}
              targetDate={selectedDate}
              calendarId={selectedCalendarId ?? undefined}
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
                refreshDaily();
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

          {/* 이벤트 편집 모달 (더블클릭/편집 → 풀스크린 오버레이) */}
          {ctx.eventEditModalState.isOpen && (
            <EventEditModal
              state={ctx.eventEditModalState}
              studentId={studentId}
              onClose={ctx.closeEventEditModal}
              onSuccess={() => {
                ctx.closeEventEditModal();
                // startSaveTransition 밖에서 invalidation 실행하여
                // transition이 React Query refetch를 지연시키는 문제 방지
                setTimeout(invalidateQueries, 0);
              }}
            />
          )}
      </PlanDndProvider>
    </>
  );
}

// ============================================
// Admin Calendar FAB (모바일 전용)
// ============================================

function AdminCalendarFAB({
  onQuickAdd,
  onAIPlan,
}: {
  onQuickAdd: () => void;
  onAIPlan: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  return (
    <div ref={fabRef} className="hidden md:flex fixed md:bottom-6 md:right-6 z-40 flex-col-reverse items-end gap-3">
      {expanded && (
        <div className="flex flex-col-reverse gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <button
            onClick={() => { onQuickAdd(); setExpanded(false); }}
            className="flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors"
          >
            <Plus className="h-5 w-5 text-[rgb(var(--color-primary-500))]" />
            <span>빠른 플랜 추가</span>
          </button>
          <button
            onClick={() => { onAIPlan(); setExpanded(false); }}
            className="flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors"
          >
            <Wand2 className="h-5 w-5 text-[rgb(var(--color-info-500))]" />
            <span>AI 플랜 생성</span>
          </button>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          expanded
            ? "rotate-45 bg-[rgb(var(--color-secondary-500))] text-white"
            : "bg-[rgb(var(--color-primary-600))] text-white hover:bg-[rgb(var(--color-primary-700))]",
        )}
        aria-label={expanded ? "닫기" : "플랜 추가"}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}