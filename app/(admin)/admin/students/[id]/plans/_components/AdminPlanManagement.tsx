"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { movePlanToContainer } from "@/lib/domains/admin-plan/actions";
import { generatePlansFromGroupAction } from "@/lib/domains/plan/actions/plan-groups/plans";
import { checkPlansExistAction } from "@/lib/domains/plan/actions/plan-groups";
import { updatePlanGroupStatus } from "@/lib/domains/plan/actions/plan-groups/status";
import {
  PlanDndProvider,
  getBaseContainerType,
  type ContainerType,
} from "./dnd";
import { PlanToastProvider } from "./PlanToast";
import {
  useKeyboardShortcuts,
  type ShortcutConfig,
} from "./useKeyboardShortcuts";
import {
  AddContentWizard,
  AddAdHocModal,
  RedistributeModal,
  ShortcutsHelpModal,
  AdminAIPlanModal,
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
} from "./dynamicModals";
import { getTodayInTimezone } from "@/lib/utils/dateUtils";
import type { DailyScheduleInfo } from "@/lib/types/plan";

// Context & Tabs
import { AdminPlanProvider, useAdminPlan } from "./context/AdminPlanContext";
import { AdminPlanTabs, TabContent } from "./AdminPlanTabs";
import { PlannerTab, CalendarTab, AnalyticsTab, HistoryTab } from "./tabs";

// Components
import { AdminPlanHeader } from "./AdminPlanHeader";

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
    >
      <AdminPlanManagementContent
        autoOpenWizard={props.autoOpenWizard}
        studentName={props.studentName}
      />
    </AdminPlanProvider>
  );
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
    activePlanGroupId,
    allPlanGroups,
    selectedDate,
    handleDateChange,
    handleRefresh,
    isPending,
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
        handleRefresh();
      }
    },
    [studentId, tenantId, selectedDate, handleRefresh, handleDateChange]
  );

  // 키보드 단축키 설정
  const shortcuts: ShortcutConfig[] = useMemo(
    () => [
      {
        key: "ArrowLeft",
        action: () => navigateDate(-1),
        description: "이전 날짜",
        category: "navigation",
      },
      {
        key: "ArrowRight",
        action: () => navigateDate(1),
        description: "다음 날짜",
        category: "navigation",
      },
      {
        key: "t",
        action: () => handleDateChange(getTodayInTimezone()),
        description: "오늘로 이동",
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
        action: closeAllModals,
        description: "모달 닫기",
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
        action: () => activePlanGroupId && setShowAIPlanModal(true),
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
    ],
    [
      navigateDate,
      handleRefresh,
      handleDateChange,
      activePlanGroupId,
      canCreatePlans,
      openUnifiedModal,
      setShowShortcutsHelp,
      closeAllModals,
      setShowAIPlanModal,
      setShowCreateWizard,
      setShowOptimizationPanel,
    ]
  );

  useKeyboardShortcuts({ shortcuts });

  return (
    <PlanToastProvider>
      <PlanDndProvider onMoveItem={handleMoveItem}>
        <div
          className={cn(
            "space-y-6",
            isPending && "opacity-50 pointer-events-none"
          )}
        >
          {/* 헤더 영역 */}
          <AdminPlanHeader studentName={studentName} shortcuts={shortcuts} />

          {/* 탭 네비게이션 */}
          <AdminPlanTabs>
            <TabContent tab="planner">
              <PlannerTab tab="planner" />
            </TabContent>
            <TabContent tab="calendar">
              <CalendarTab tab="calendar" />
            </TabContent>
            <TabContent tab="analytics">
              <AnalyticsTab tab="analytics" />
            </TabContent>
            <TabContent tab="history">
              <HistoryTab tab="history" />
            </TabContent>
          </AdminPlanTabs>

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

          {showAIPlanModal && activePlanGroupId && (
            <AdminAIPlanModal
              studentId={studentId}
              tenantId={tenantId}
              planGroupId={activePlanGroupId}
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

          {showAIPlanModal && newGroupIdForAI && !activePlanGroupId && (
            <AdminAIPlanModal
              studentId={studentId}
              tenantId={tenantId}
              planGroupId={newGroupIdForAI}
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
                handleRefresh();
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
              onClose={() => setShowUnifiedAddModal(false)}
              onSuccess={() => {
                setShowUnifiedAddModal(false);
                handleRefresh();
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
                handleRefresh();
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

          <PlanOptimizationPanel
            studentId={studentId}
            studentName={studentName}
            planGroupId={activePlanGroupId ?? undefined}
            open={showOptimizationPanel}
            onOpenChange={setShowOptimizationPanel}
            hideTrigger
          />
        </div>
      </PlanDndProvider>
    </PlanToastProvider>
  );
}
