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
import { PlanDndProvider, type ContainerType } from './dnd';
import { PlanHistoryViewer } from './PlanHistoryViewer';
import { CarryoverButton } from './CarryoverButton';
import { SummaryDashboard } from './SummaryDashboard';
import { PlanQualityDashboard } from './PlanQualityDashboard';
import { useKeyboardShortcuts, type ShortcutConfig } from './useKeyboardShortcuts';
import { Wand2, Plus, LineChart, Zap } from 'lucide-react';

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

  // 새로고침
  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // DnD 이동 핸들러 (이벤트 로깅 포함)
  const handleMoveItem = useCallback(
    async (
      itemId: string,
      itemType: 'plan' | 'adhoc',
      fromContainer: ContainerType,
      toContainer: ContainerType
    ) => {
      const result = await movePlanToContainer({
        planId: itemId,
        planType: itemType,
        fromContainer,
        toContainer,
        studentId,
        tenantId,
        targetDate: toContainer === 'daily' ? selectedDate : undefined,
      });

      if (!result.success) {
        console.error('Failed to move plan:', result.error);
      }

      handleRefresh();
    },
    [studentId, tenantId, selectedDate, handleRefresh]
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
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="p-2 text-secondary-500 hover:bg-secondary-100 rounded-lg"
              title="키보드 단축키 (Shift + ?)"
            >
              ⌨️
            </button>
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
            onRefresh={handleRefresh}
          />

          {/* Weekly Dock */}
          <WeeklyDock
            studentId={studentId}
            tenantId={tenantId}
            selectedDate={selectedDate}
            onRedistribute={handleOpenRedistribute}
            onRefresh={handleRefresh}
          />
        </div>

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
