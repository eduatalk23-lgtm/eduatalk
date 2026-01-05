'use client';

import { useState, useTransition, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/cn';
import { movePlanToContainer } from '@/lib/domains/admin-plan/actions';
import { PlanStatsCards } from './PlanStatsCards';
import { UnfinishedDock } from './UnfinishedDock';
import { DailyDock } from './DailyDock';
import { WeeklyDock } from './WeeklyDock';
import { WeeklyCalendar } from './WeeklyCalendar';
import { PlanDndProvider, getBaseContainerType, type ContainerType } from './dnd';
import { PlanHistoryViewer } from './PlanHistoryViewer';
import { DeletedPlansView } from './DeletedPlansView';
import { CarryoverButton } from './CarryoverButton';
import { SummaryDashboard } from './SummaryDashboard';
import { PlanQualityDashboard } from './PlanQualityDashboard';
import { useKeyboardShortcuts, type ShortcutConfig } from './useKeyboardShortcuts';
import { Wand2, Plus, LineChart, Zap, Trash2, ClipboardList, MoreHorizontal } from 'lucide-react';

// 동적 import로 코드 스플리팅 (모달 컴포넌트)
const AddContentModal = dynamic(
  () => import('./AddContentModal').then(mod => ({ default: mod.AddContentModal })),
  { ssr: false }
);
const AddAdHocModal = dynamic(
  () => import('./AddAdHocModal').then(mod => ({ default: mod.AddAdHocModal })),
  { ssr: false }
);
const RedistributeModal = dynamic(
  () => import('./RedistributeModal').then(mod => ({ default: mod.RedistributeModal })),
  { ssr: false }
);
const ShortcutsHelpModal = dynamic(
  () => import('./ShortcutsHelpModal').then(mod => ({ default: mod.ShortcutsHelpModal })),
  { ssr: false }
);
const AdminAIPlanModal = dynamic(
  () => import('./AdminAIPlanModal').then(mod => ({ default: mod.AdminAIPlanModal })),
  { ssr: false }
);
const AdminPlanCreationWizard7Step = dynamic(
  () => import('./admin-wizard').then(mod => ({ default: mod.AdminPlanCreationWizard7Step })),
  { ssr: false }
);
const AdminQuickPlanModal = dynamic(
  () => import('./AdminQuickPlanModal').then(mod => ({ default: mod.AdminQuickPlanModal })),
  { ssr: false }
);
const PlanOptimizationPanel = dynamic(() => import('./PlanOptimizationPanel'), { ssr: false });
const EditPlanModal = dynamic(
  () => import('./modals/EditPlanModal').then(mod => ({ default: mod.EditPlanModal })),
  { ssr: false }
);
const ReorderPlansModal = dynamic(
  () => import('./modals/ReorderPlansModal').then(mod => ({ default: mod.ReorderPlansModal })),
  { ssr: false }
);
const ConditionalDeleteModal = dynamic(
  () => import('./modals/ConditionalDeleteModal').then(mod => ({ default: mod.ConditionalDeleteModal })),
  { ssr: false }
);
const PlanTemplateModal = dynamic(
  () => import('./modals/PlanTemplateModal').then(mod => ({ default: mod.PlanTemplateModal })),
  { ssr: false }
);
const MoveToGroupModal = dynamic(
  () => import('./modals/MoveToGroupModal').then(mod => ({ default: mod.MoveToGroupModal })),
  { ssr: false }
);
const CopyPlanModal = dynamic(
  () => import('./modals/CopyPlanModal').then(mod => ({ default: mod.CopyPlanModal })),
  { ssr: false }
);

interface AdminPlanManagementProps {
  studentId: string;
  studentName: string;
  tenantId: string;
  initialDate: string;
  activePlanGroupId: string | null;
}

export function AdminPlanManagement({
  studentId,
  studentName,
  tenantId,
  initialDate,
  activePlanGroupId,
}: AdminPlanManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 상태 관리
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [showAddAdHocModal, setShowAddAdHocModal] = useState(false);
  const [showRedistributeModal, setShowRedistributeModal] = useState(false);
  const [selectedPlanForRedistribute, setSelectedPlanForRedistribute] = useState<string | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showAIPlanModal, setShowAIPlanModal] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showOptimizationPanel, setShowOptimizationPanel] = useState(false);
  const [showQuickPlanModal, setShowQuickPlanModal] = useState(false);
  const [newGroupIdForAI, setNewGroupIdForAI] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<string | null>(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderContainerType, setReorderContainerType] = useState<'daily' | 'weekly' | 'unfinished'>('daily');
  const [showConditionalDeleteModal, setShowConditionalDeleteModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templatePlanIds, setTemplatePlanIds] = useState<string[]>([]);
  const [showMoveToGroupModal, setShowMoveToGroupModal] = useState(false);
  const [selectedPlansForMove, setSelectedPlansForMove] = useState<string[]>([]);
  const [currentGroupIdForMove, setCurrentGroupIdForMove] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedPlansForCopy, setSelectedPlansForCopy] = useState<string[]>([]);

  // 날짜 변경 핸들러
  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    startTransition(() => {
      router.push(`/admin/students/${studentId}/plans?date=${date}`);
    });
  }, [router, studentId]);

  // 재분배 모달 열기
  const handleOpenRedistribute = (planId: string) => {
    setSelectedPlanForRedistribute(planId);
    setShowRedistributeModal(true);
  };

  // 편집 모달 열기
  const handleOpenEdit = (planId: string) => {
    setSelectedPlanForEdit(planId);
    setShowEditModal(true);
  };

  // 순서 변경 모달 열기
  const handleOpenReorder = (containerType: 'daily' | 'weekly' | 'unfinished') => {
    setReorderContainerType(containerType);
    setShowReorderModal(true);
  };

  // 템플릿 모달 열기 (선택된 플랜으로)
  const handleOpenTemplateWithPlans = (planIds: string[]) => {
    setTemplatePlanIds(planIds);
    setShowTemplateModal(true);
  };

  // 그룹 이동 모달 열기
  const handleOpenMoveToGroup = (planIds: string[], currentGroupId?: string | null) => {
    setSelectedPlansForMove(planIds);
    setCurrentGroupIdForMove(currentGroupId ?? null);
    setShowMoveToGroupModal(true);
  };

  // 복사 모달 열기
  const handleOpenCopy = (planIds: string[]) => {
    setSelectedPlansForCopy(planIds);
    setShowCopyModal(true);
  };

  // 새로고침
  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // DnD 이동 핸들러 (이벤트 로깅 포함)
  // targetDate: 날짜 기반 드롭 시 캘린더에서 드롭한 날짜
  const handleMoveItem = useCallback(
    async (
      itemId: string,
      itemType: 'plan' | 'adhoc',
      fromContainer: ContainerType,
      toContainer: ContainerType,
      targetDate?: string
    ) => {
      // 날짜 기반 드롭인 경우 해당 날짜 사용, 아니면 현재 선택된 날짜 사용
      const effectiveTargetDate = targetDate ?? selectedDate;

      // 확장된 컨테이너 타입을 기본 타입으로 변환 (movePlanToContainer용)
      const fromBaseType = getBaseContainerType(fromContainer);
      const toBaseType = getBaseContainerType(toContainer);

      const result = await movePlanToContainer({
        planId: itemId,
        planType: itemType,
        fromContainer: fromBaseType,
        toContainer: toBaseType,
        studentId,
        tenantId,
        targetDate: toBaseType === 'daily' ? effectiveTargetDate : undefined,
      });

      if (!result.success) {
        console.error('Failed to move plan:', result.error);
      }

      // 날짜 기반 드롭이고 현재 선택 날짜와 다른 경우 해당 날짜로 이동
      if (targetDate && targetDate !== selectedDate) {
        handleDateChange(targetDate);
      } else {
        handleRefresh();
      }
    },
    [studentId, tenantId, selectedDate, handleRefresh, handleDateChange]
  );

  // 날짜 이동 헬퍼
  const navigateDate = useCallback((days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    handleDateChange(current.toISOString().split('T')[0]);
  }, [selectedDate, handleDateChange]);

  // 키보드 단축키 설정
  const shortcuts: ShortcutConfig[] = useMemo(
    () => [
      // 탐색
      {
        key: 'ArrowLeft',
        action: () => navigateDate(-1),
        description: '이전 날짜',
        category: 'navigation',
      },
      {
        key: 'ArrowRight',
        action: () => navigateDate(1),
        description: '다음 날짜',
        category: 'navigation',
      },
      {
        key: 't',
        action: () => handleDateChange(new Date().toISOString().split('T')[0]),
        description: '오늘로 이동',
        category: 'navigation',
      },
      // 작업
      {
        key: 'r',
        action: handleRefresh,
        description: '새로고침',
        category: 'action',
      },
      // 모달
      {
        key: 'n',
        action: () => setShowAddContentModal(true),
        description: '플랜 추가',
        category: 'modal',
      },
      {
        key: 'a',
        action: () => setShowAddAdHocModal(true),
        description: '단발성 추가',
        category: 'modal',
      },
      {
        key: '?',
        shift: true,
        action: () => setShowShortcutsHelp(true),
        description: '단축키 도움말',
        category: 'modal',
      },
      {
        key: 'Escape',
        action: () => {
          setShowAddContentModal(false);
          setShowAddAdHocModal(false);
          setShowRedistributeModal(false);
          setShowShortcutsHelp(false);
          setShowAIPlanModal(false);
          setShowCreateWizard(false);
          setShowOptimizationPanel(false);
          setShowQuickPlanModal(false);
          setShowEditModal(false);
          setShowReorderModal(false);
          setShowConditionalDeleteModal(false);
          setShowTemplateModal(false);
        },
        description: '모달 닫기',
        category: 'modal',
      },
      {
        key: 'q',
        action: () => setShowQuickPlanModal(true),
        description: '빠른 플랜 추가',
        category: 'modal',
      },
      {
        key: 'i',
        action: () => activePlanGroupId && setShowAIPlanModal(true),
        description: 'AI 플랜 생성',
        category: 'modal',
      },
      {
        key: 'g',
        action: () => setShowCreateWizard(true),
        description: '플랜 그룹 생성',
        category: 'modal',
      },
      {
        key: 'o',
        action: () => setShowOptimizationPanel(true),
        description: 'AI 플랜 최적화',
        category: 'modal',
      },
    ],
    [navigateDate, handleRefresh, handleDateChange, activePlanGroupId]
  );

  useKeyboardShortcuts({ shortcuts });

  return (
    <PlanDndProvider onMoveItem={handleMoveItem}>
      <div className={cn('space-y-6', isPending && 'opacity-50 pointer-events-none')}>
        {/* 헤더 영역 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{studentName} 플랜 관리</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickPlanModal(true)}
              className="flex items-center gap-2 rounded-lg bg-warning-500 px-3 py-2 text-sm font-medium text-white hover:bg-warning-600"
              title="빠른 플랜 추가 (q)"
            >
              <Zap className="h-4 w-4" />
              빠른 추가
            </button>
            <button
              onClick={() => setShowCreateWizard(true)}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              title="플랜 그룹 생성 (g)"
            >
              <Plus className="h-4 w-4" />
              플랜 그룹
            </button>
            {activePlanGroupId && (
              <button
                onClick={() => setShowAIPlanModal(true)}
                className="flex items-center gap-2 rounded-lg bg-info-50 px-3 py-2 text-sm font-medium text-info-700 hover:bg-info-100"
                title="AI 플랜 생성 (i)"
              >
                <Wand2 className="h-4 w-4" />
                AI 생성
              </button>
            )}
            <button
              onClick={() => setShowOptimizationPanel(true)}
              className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm font-medium text-success-700 hover:bg-success-100"
              title="AI 플랜 최적화 (o)"
            >
              <LineChart className="h-4 w-4" />
              AI 분석
            </button>
            {/* 더보기 드롭다운 */}
            <div className="relative group">
              <button
                className="flex items-center gap-1 p-2 text-secondary-500 hover:bg-secondary-100 rounded-lg"
                title="더보기"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <ClipboardList className="h-4 w-4" />
                  플랜 템플릿
                </button>
                <button
                  onClick={() => setShowConditionalDeleteModal(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  조건부 삭제
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => setShowShortcutsHelp(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  ⌨️ 단축키 도움말
                </button>
              </div>
            </div>
            <CarryoverButton
              studentId={studentId}
              tenantId={tenantId}
              onSuccess={handleRefresh}
            />
          </div>
        </div>

        {/* 현황 카드 */}
        <PlanStatsCards studentId={studentId} />

        {/* 미완료 Dock */}
        <UnfinishedDock
          studentId={studentId}
          tenantId={tenantId}
          onRedistribute={handleOpenRedistribute}
          onEdit={handleOpenEdit}
          onReorder={() => handleOpenReorder('unfinished')}
          onMoveToGroup={handleOpenMoveToGroup}
          onCopy={handleOpenCopy}
          onRefresh={handleRefresh}
        />

        {/* 캘린더 뷰 */}
        <WeeklyCalendar
          studentId={studentId}
          selectedDate={selectedDate}
          onDateSelect={handleDateChange}
        />

        {/* Daily & Weekly Docks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Dock */}
          <DailyDock
            studentId={studentId}
            tenantId={tenantId}
            selectedDate={selectedDate}
            onAddContent={() => setShowAddContentModal(true)}
            onAddAdHoc={() => setShowAddAdHocModal(true)}
            onRedistribute={handleOpenRedistribute}
            onEdit={handleOpenEdit}
            onReorder={() => handleOpenReorder('daily')}
            onMoveToGroup={handleOpenMoveToGroup}
            onCopy={handleOpenCopy}
            onRefresh={handleRefresh}
          />

          {/* Weekly Dock */}
          <WeeklyDock
            studentId={studentId}
            tenantId={tenantId}
            selectedDate={selectedDate}
            onRedistribute={handleOpenRedistribute}
            onEdit={handleOpenEdit}
            onReorder={() => handleOpenReorder('weekly')}
            onMoveToGroup={handleOpenMoveToGroup}
            onCopy={handleOpenCopy}
            onRefresh={handleRefresh}
          />
        </div>

        {/* 삭제된 플랜 (복구 기능) */}
        <DeletedPlansView studentId={studentId} onRefresh={handleRefresh} />

        {/* 요약 대시보드 & 활동 히스토리 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SummaryDashboard studentId={studentId} />
          <PlanHistoryViewer studentId={studentId} />
        </div>

        {/* 플랜 품질 대시보드 (Phase 4) */}
        {activePlanGroupId && (
          <PlanQualityDashboard
            planGroupId={activePlanGroupId}
            planGroupName="현재 플랜 그룹"
          />
        )}

        {/* 모달들 */}
        {showAddContentModal && (
          <AddContentModal
            studentId={studentId}
            tenantId={tenantId}
            targetDate={selectedDate}
            onClose={() => setShowAddContentModal(false)}
            onSuccess={() => {
              setShowAddContentModal(false);
              handleRefresh();
            }}
          />
        )}

        {showAddAdHocModal && activePlanGroupId && (
          <AddAdHocModal
            studentId={studentId}
            tenantId={tenantId}
            planGroupId={activePlanGroupId}
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
            shortcuts={shortcuts.filter((s) => s.key !== 'Escape')}
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

        {/* 플랜 그룹 생성 위자드 (7단계) */}
        {showCreateWizard && (
          <AdminPlanCreationWizard7Step
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            onClose={() => setShowCreateWizard(false)}
            onSuccess={(groupId, generateAI) => {
              setShowCreateWizard(false);
              handleRefresh();
              // AI 생성 옵션이 선택된 경우, 새로 생성된 그룹으로 AI 모달 열기
              if (generateAI) {
                setNewGroupIdForAI(groupId);
                setShowAIPlanModal(true);
              }
            }}
          />
        )}

        {/* 새로 생성된 그룹에 대한 AI 플랜 모달 */}
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

        {/* 빠른 플랜 추가 모달 */}
        {showQuickPlanModal && (
          <AdminQuickPlanModal
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            targetDate={selectedDate}
            onClose={() => setShowQuickPlanModal(false)}
            onSuccess={() => {
              setShowQuickPlanModal(false);
              handleRefresh();
            }}
          />
        )}

        {/* 플랜 수정 모달 */}
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

        {/* 순서 변경 모달 */}
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

        {/* 조건부 삭제 모달 */}
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

        {/* 플랜 템플릿 모달 */}
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

        {/* AI 플랜 최적화 패널 */}
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
  );
}
