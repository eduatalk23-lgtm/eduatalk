'use client';

import { useState, useTransition, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { movePlanToContainer } from '@/lib/domains/admin-plan/actions';
import { PlanStatsCards } from './PlanStatsCards';
import { UnfinishedDock } from './UnfinishedDock';
import { DailyDock } from './DailyDock';
import { WeeklyDock } from './WeeklyDock';
import { WeeklyCalendar } from './WeeklyCalendar';
import { AddContentModal } from './AddContentModal';
import { AddAdHocModal } from './AddAdHocModal';
import { RedistributeModal } from './RedistributeModal';
import { PlanDndProvider, type ContainerType } from './dnd';
import { PlanHistoryViewer } from './PlanHistoryViewer';
import { CarryoverButton } from './CarryoverButton';
import { SummaryDashboard } from './SummaryDashboard';
import { useKeyboardShortcuts, type ShortcutConfig } from './useKeyboardShortcuts';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import { PlanToastProvider } from './PlanToast';

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

  // 날짜 변경 핸들러
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    startTransition(() => {
      router.push(`/admin/students/${studentId}/plans?date=${date}`);
    });
  };

  // 재분배 모달 열기
  const handleOpenRedistribute = (planId: string) => {
    setSelectedPlanForRedistribute(planId);
    setShowRedistributeModal(true);
  };

  // 새로고침
  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

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
    [studentId, tenantId, selectedDate]
  );

  // 날짜 이동 헬퍼
  const navigateDate = useCallback((days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    handleDateChange(current.toISOString().split('T')[0]);
  }, [selectedDate]);

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
        },
        description: '모달 닫기',
        category: 'modal',
      },
    ],
    [navigateDate, handleRefresh]
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
              onClick={() => setShowShortcutsHelp(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
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
      </div>
    </PlanDndProvider>
  );
}
