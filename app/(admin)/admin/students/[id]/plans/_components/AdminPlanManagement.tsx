'use client';

import { useState, useReducer, useTransition, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { PlanToastProvider } from './PlanToast';
import { PlanHistoryViewer } from './PlanHistoryViewer';
import { DeletedPlansView } from './DeletedPlansView';
import { CarryoverButton } from './CarryoverButton';
import { SummaryDashboard } from './SummaryDashboard';
import { PlanQualityDashboard } from './PlanQualityDashboard';
import { PlanTypeStats } from './PlanTypeStats';
import { useKeyboardShortcuts, type ShortcutConfig } from './useKeyboardShortcuts';
import { modalReducer, initialModalState, type ModalType } from './types/modalState';
import { useAdminPlanRealtime } from '@/lib/realtime';
import { useInvalidateAllDockQueries } from '@/lib/hooks/useAdminDockQueries';
import { Wand2, Plus, LineChart, Zap, Trash2, ClipboardList, MoreHorizontal, AlertTriangle, Filter, Book, Video, FileText } from 'lucide-react';
import type { DailyScheduleInfo } from '@/lib/types/plan';

// 콘텐츠 유형 필터 타입
export type ContentTypeFilter = 'all' | 'book' | 'lecture' | 'custom';

// 필터 옵션 정의
const CONTENT_TYPE_FILTERS: { value: ContentTypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: '전체', icon: null },
  { value: 'book', label: '교재', icon: <Book className="w-3 h-3" /> },
  { value: 'lecture', label: '강의', icon: <Video className="w-3 h-3" /> },
  { value: 'custom', label: '직접입력', icon: <FileText className="w-3 h-3" /> },
];

// 동적 import로 코드 스플리팅 (모달 컴포넌트)
const AddContentWizard = dynamic(
  () => import('./add-content-wizard').then(mod => ({ default: mod.AddContentWizard })),
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
const UnifiedPlanAddModal = dynamic(
  () => import('./UnifiedPlanAddModal').then(mod => ({ default: mod.UnifiedPlanAddModal })),
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
const PlanStatusModal = dynamic(
  () => import('./modals/PlanStatusModal').then(mod => ({ default: mod.PlanStatusModal })),
  { ssr: false }
);
const BulkEditModal = dynamic(
  () => import('./modals/BulkEditModal').then(mod => ({ default: mod.BulkEditModal })),
  { ssr: false }
);

interface AdminPlanManagementProps {
  studentId: string;
  studentName: string;
  tenantId: string;
  initialDate: string;
  activePlanGroupId: string | null;
  /** 선택된 플래너 ID (플래너 기반 필터링용) */
  selectedPlannerId?: string;
  /** 페이지 로드 시 위저드 자동 오픈 여부 */
  autoOpenWizard?: boolean;
  /** 플래너 플랜 그룹의 daily_schedule (1730 Timetable 방법론 준수) */
  plannerDailySchedules?: DailyScheduleInfo[][];
  /** 플래너 제외일 목록 */
  plannerExclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
}

export function AdminPlanManagement({
  studentId,
  studentName,
  tenantId,
  initialDate,
  activePlanGroupId,
  selectedPlannerId,
  autoOpenWizard = false,
  plannerDailySchedules,
  plannerExclusions,
}: AdminPlanManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 상태 관리
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // 모달 상태 관리 (useReducer 패턴)
  const [modals, dispatchModal] = useReducer(modalReducer, initialModalState);

  // 모달 열기/닫기 헬퍼 함수들 (기존 API 호환성 유지)
  const openModal = useCallback((type: ModalType) => {
    dispatchModal({ type: 'OPEN_MODAL', payload: type });
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    dispatchModal({ type: 'CLOSE_MODAL', payload: type });
  }, []);

  const closeAllModals = useCallback(() => {
    dispatchModal({ type: 'CLOSE_ALL' });
  }, []);

  // 기존 API와의 호환성을 위한 래퍼 (점진적 마이그레이션)
  const showAddContentModal = modals.addContent;
  const setShowAddContentModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'addContent' });
  }, []);

  const showAddAdHocModal = modals.addAdHoc;
  const setShowAddAdHocModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'addAdHoc' });
  }, []);

  const showRedistributeModal = modals.redistribute;
  const setShowRedistributeModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'redistribute' });
  }, []);

  const showShortcutsHelp = modals.shortcutsHelp;
  const setShowShortcutsHelp = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'shortcutsHelp' });
  }, []);

  const showAIPlanModal = modals.aiPlan;
  const setShowAIPlanModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'aiPlan' });
  }, []);

  const showCreateWizard = modals.createWizard;
  const setShowCreateWizard = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'createWizard' });
  }, []);

  const showOptimizationPanel = modals.optimization;
  const setShowOptimizationPanel = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'optimization' });
  }, []);

  const showQuickPlanModal = modals.quickPlan;
  const setShowQuickPlanModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'quickPlan' });
  }, []);

  const showEditModal = modals.edit;
  const setShowEditModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'edit' });
  }, []);

  const showReorderModal = modals.reorder;
  const setShowReorderModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'reorder' });
  }, []);

  const showConditionalDeleteModal = modals.conditionalDelete;
  const setShowConditionalDeleteModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'conditionalDelete' });
  }, []);

  const showTemplateModal = modals.template;
  const setShowTemplateModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'template' });
  }, []);

  const showMoveToGroupModal = modals.moveToGroup;
  const setShowMoveToGroupModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'moveToGroup' });
  }, []);

  const showCopyModal = modals.copy;
  const setShowCopyModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'copy' });
  }, []);

  const showStatusModal = modals.status;
  const setShowStatusModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'status' });
  }, []);

  const showBulkEditModal = modals.bulkEdit;
  const setShowBulkEditModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'bulkEdit' });
  }, []);

  const showUnifiedAddModal = modals.unifiedAdd;
  const setShowUnifiedAddModal = useCallback((show: boolean) => {
    dispatchModal({ type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: 'unifiedAdd' });
  }, []);

  // 통합 모달 초기 모드 상태
  const [unifiedModalMode, setUnifiedModalMode] = useState<'quick' | 'content'>('quick');

  // 통합 모달 열기 헬퍼
  const openUnifiedModal = useCallback((mode: 'quick' | 'content') => {
    setUnifiedModalMode(mode);
    setShowUnifiedAddModal(true);
  }, [setShowUnifiedAddModal]);

  // 모달 관련 추가 상태 (데이터)
  const [selectedPlanForRedistribute, setSelectedPlanForRedistribute] = useState<string | null>(null);
  const [newGroupIdForAI, setNewGroupIdForAI] = useState<string | null>(null);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<string | null>(null);
  const [reorderContainerType, setReorderContainerType] = useState<'daily' | 'weekly' | 'unfinished'>('daily');
  const [templatePlanIds, setTemplatePlanIds] = useState<string[]>([]);
  const [selectedPlansForMove, setSelectedPlansForMove] = useState<string[]>([]);
  const [currentGroupIdForMove, setCurrentGroupIdForMove] = useState<string | null>(null);
  const [selectedPlansForCopy, setSelectedPlansForCopy] = useState<string[]>([]);
  const [selectedPlanForStatus, setSelectedPlanForStatus] = useState<{
    id: string;
    status: string;
    title: string;
  } | null>(null);
  const [selectedPlansForBulkEdit, setSelectedPlansForBulkEdit] = useState<string[]>([]);

  // 위저드 자동 오픈 (URL 파라미터로 트리거)
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (autoOpenWizard && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setShowCreateWizard(true);
    }
  }, [autoOpenWizard, setShowCreateWizard]);

  // 날짜 변경 핸들러
  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      startTransition(() => {
        const basePath = selectedPlannerId
          ? `/admin/students/${studentId}/plans/${selectedPlannerId}`
          : `/admin/students/${studentId}/plans`;
        router.push(`${basePath}?date=${date}`);
      });
    },
    [router, studentId, selectedPlannerId]
  );

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

  // 상태 변경 모달 열기
  const handleOpenStatusChange = (planId: string, currentStatus: string, title: string) => {
    setSelectedPlanForStatus({ id: planId, status: currentStatus, title });
    setShowStatusModal(true);
  };

  // 일괄 수정 모달 열기
  const handleOpenBulkEdit = (planIds: string[]) => {
    setSelectedPlansForBulkEdit(planIds);
    setShowBulkEditModal(true);
  };

  // React Query 캐시 무효화 (Dock 컴포넌트용)
  const invalidateAllDocks = useInvalidateAllDockQueries();

  // 새로고침 (React Query 캐시 + Next.js router)
  const handleRefresh = useCallback(() => {
    // React Query 캐시 무효화 (Dock 컴포넌트 즉시 갱신)
    invalidateAllDocks();
    // Next.js router refresh (Server Component 데이터 갱신)
    startTransition(() => {
      router.refresh();
    });
  }, [router, invalidateAllDocks]);

  // 실시간 업데이트 구독
  useAdminPlanRealtime({
    studentId,
    onRefresh: handleRefresh,
    debounceMs: 1000, // 1초 debounce로 빈번한 새로고침 방지
  });

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

  // 플래너 선택 여부 확인 (플랜 생성 기능 활성화 조건)
  const canCreatePlans = !!selectedPlannerId;

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
      // 모달 (플래너 선택 필요)
      {
        key: 'n',
        action: () => canCreatePlans && openUnifiedModal('content'),
        description: '콘텐츠 플랜 추가',
        category: 'modal',
      },
      {
        key: 'a',
        action: () => canCreatePlans && openUnifiedModal('quick'),
        description: '빠른 플랜 추가',
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
        action: closeAllModals,
        description: '모달 닫기',
        category: 'modal',
      },
      {
        key: 'q',
        action: () => canCreatePlans && openUnifiedModal('quick'),
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
        action: () => canCreatePlans && setShowCreateWizard(true),
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
    [navigateDate, handleRefresh, handleDateChange, activePlanGroupId, canCreatePlans, openUnifiedModal]
  );

  useKeyboardShortcuts({ shortcuts });

  return (
    <PlanToastProvider>
      <PlanDndProvider onMoveItem={handleMoveItem}>
        <div className={cn('space-y-6', isPending && 'opacity-50 pointer-events-none')}>
        {/* 플래너 미선택 경고 배너 */}
        {!selectedPlannerId && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <span className="text-sm text-amber-700">
              플랜을 생성하려면 먼저 상단에서 플래너를 생성하거나 선택해주세요.
            </span>
          </div>
        )}

        {/* 헤더 영역 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{studentName} 플랜 관리</h1>
            {/* 콘텐츠 유형 필터 */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                  contentTypeFilter !== 'all'
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {CONTENT_TYPE_FILTERS.find(f => f.value === contentTypeFilter)?.label}
                </span>
              </button>
              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 w-36 bg-white border rounded-lg shadow-lg z-50 py-1">
                    {CONTENT_TYPE_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => {
                          setContentTypeFilter(filter.value);
                          setShowFilterDropdown(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50",
                          contentTypeFilter === filter.value && "bg-blue-50 text-blue-700"
                        )}
                      >
                        {filter.icon}
                        <span>{filter.label}</span>
                        {contentTypeFilter === filter.value && (
                          <span className="ml-auto text-blue-500">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openUnifiedModal('quick')}
              disabled={!canCreatePlans}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                canCreatePlans
                  ? "bg-warning-500 text-white hover:bg-warning-600"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              )}
              title={canCreatePlans ? "빠른 플랜 추가 (Q/A)" : "먼저 플래너를 선택해주세요"}
            >
              <Zap className="h-4 w-4" />
              빠른 추가
            </button>
            <button
              onClick={() => setShowCreateWizard(true)}
              disabled={!selectedPlannerId}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                selectedPlannerId
                  ? "bg-primary-600 text-white hover:bg-primary-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              )}
              title={selectedPlannerId ? "플랜 그룹 생성 (g)" : "먼저 플래너를 선택해주세요"}
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

        {/* 유형별 통계 */}
        <PlanTypeStats
          studentId={studentId}
          selectedDate={selectedDate}
          plannerId={selectedPlannerId}
        />

        {/* 미완료 Dock */}
        <UnfinishedDock
          studentId={studentId}
          tenantId={tenantId}
          plannerId={selectedPlannerId}
          contentTypeFilter={contentTypeFilter}
          onRedistribute={handleOpenRedistribute}
          onEdit={handleOpenEdit}
          onReorder={() => handleOpenReorder('unfinished')}
          onMoveToGroup={handleOpenMoveToGroup}
          onCopy={handleOpenCopy}
          onStatusChange={handleOpenStatusChange}
          onRefresh={handleRefresh}
        />

        {/* 캘린더 뷰 */}
        <WeeklyCalendar
          studentId={studentId}
          selectedDate={selectedDate}
          onDateSelect={handleDateChange}
          plannerId={selectedPlannerId}
          dailySchedules={plannerDailySchedules}
          exclusions={plannerExclusions}
        />

        {/* Daily & Weekly Docks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Dock */}
          <DailyDock
            studentId={studentId}
            tenantId={tenantId}
            plannerId={selectedPlannerId}
            selectedDate={selectedDate}
            activePlanGroupId={activePlanGroupId}
            contentTypeFilter={contentTypeFilter}
            onAddContent={() => openUnifiedModal('content')}
            onAddAdHoc={() => openUnifiedModal('quick')}
            onRedistribute={handleOpenRedistribute}
            onEdit={handleOpenEdit}
            onReorder={() => handleOpenReorder('daily')}
            onMoveToGroup={handleOpenMoveToGroup}
            onCopy={handleOpenCopy}
            onStatusChange={handleOpenStatusChange}
            onRefresh={handleRefresh}
          />

          {/* Weekly Dock */}
          <WeeklyDock
            studentId={studentId}
            tenantId={tenantId}
            plannerId={selectedPlannerId}
            selectedDate={selectedDate}
            contentTypeFilter={contentTypeFilter}
            onRedistribute={handleOpenRedistribute}
            onEdit={handleOpenEdit}
            onReorder={() => handleOpenReorder('weekly')}
            onMoveToGroup={handleOpenMoveToGroup}
            onCopy={handleOpenCopy}
            onStatusChange={handleOpenStatusChange}
            onRefresh={handleRefresh}
          />
        </div>

        {/* 삭제된 플랜 (복구 기능) */}
        <DeletedPlansView studentId={studentId} onRefresh={handleRefresh} plannerId={selectedPlannerId} />

        {/* 요약 대시보드 & 활동 히스토리 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SummaryDashboard studentId={studentId} />
          <PlanHistoryViewer studentId={studentId} plannerId={selectedPlannerId} />
        </div>

        {/* 플랜 품질 대시보드 (Phase 4) */}
        {activePlanGroupId && (
          <PlanQualityDashboard
            planGroupId={activePlanGroupId}
            planGroupName="현재 플랜 그룹"
          />
        )}

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
        {showCreateWizard && selectedPlannerId && (
          <AdminPlanCreationWizard7Step
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            plannerId={selectedPlannerId}
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

        {/* 빠른 플랜 추가 모달 (레거시) */}
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

        {/* 통합 플랜 추가 모달 (빠른 추가 + 콘텐츠 추가) */}
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

        {/* 플랜 상태 변경 모달 */}
        {showStatusModal && selectedPlanForStatus && (
          <PlanStatusModal
            planId={selectedPlanForStatus.id}
            studentId={studentId}
            currentStatus={selectedPlanForStatus.status as 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled'}
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

        {/* 일괄 수정 모달 */}
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
    </PlanToastProvider>
  );
}
