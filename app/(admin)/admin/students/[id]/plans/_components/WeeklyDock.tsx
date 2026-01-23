'use client';

import { useState, useTransition, useMemo, useCallback, memo } from 'react';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { usePlanToast } from './PlanToast';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { PlanItemCard, toPlanItemData } from './items';
import { useWeeklyDockQuery } from '@/lib/hooks/useAdminDockQueries';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { deletePlan, movePlanToContainer } from '@/lib/domains/plan/actions/dock';
import type { ContentTypeFilter } from './AdminPlanManagement';
import type { PlanStatus } from '@/lib/types/plan';

/** 스켈레톤 로딩 UI용 상수 배열 (매 렌더마다 새 배열 생성 방지) */
const SKELETON_ITEMS = [1, 2] as const;

interface WeeklyDockProps {
  studentId: string;
  tenantId: string;
  /** 플래너 ID (플래너 기반 필터링용) */
  plannerId?: string;
  selectedDate: string;
  /** 선택된 플랜 그룹 ID (null = 전체 보기) */
  selectedGroupId?: string | null;
  /** 콘텐츠 유형 필터 */
  contentTypeFilter?: ContentTypeFilter;
  onRedistribute: (planId: string) => void;
  onEdit?: (planId: string) => void;
  onReorder?: () => void;
  onMoveToGroup?: (planIds: string[], currentGroupId?: string | null) => void;
  onCopy?: (planIds: string[]) => void;
  onStatusChange?: (planId: string, currentStatus: PlanStatus, title: string) => void;
  /** 전체 새로고침 (기본) */
  onRefresh: () => void;
  /** Daily + Weekly만 새로고침 (컨테이너 이동 시 사용) */
  onRefreshDailyAndWeekly?: () => void;
}

/**
 * WeeklyDock - 주간 플랜 Dock 컴포넌트
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const WeeklyDock = memo(function WeeklyDock({
  studentId,
  tenantId,
  plannerId,
  selectedDate,
  selectedGroupId,
  contentTypeFilter = 'all',
  onRedistribute,
  onEdit,
  onReorder,
  onMoveToGroup,
  onCopy,
  onStatusChange,
  onRefresh,
  onRefreshDailyAndWeekly,
}: WeeklyDockProps) {
  // React Query 훅 사용 (캐싱 및 중복 요청 방지)
  const { plans: allPlans, adHocPlans, isLoading, weekRange } = useWeeklyDockQuery(
    studentId,
    selectedDate,
    plannerId
  );

  // 그룹 필터링 적용
  const groupFilteredPlans = useMemo(() => {
    if (selectedGroupId === null || selectedGroupId === undefined) return allPlans;
    return allPlans.filter(plan => plan.plan_group_id === selectedGroupId);
  }, [allPlans, selectedGroupId]);

  // 콘텐츠 유형 필터 적용
  const plans = useMemo(() => {
    if (contentTypeFilter === 'all') return groupFilteredPlans;
    return groupFilteredPlans.filter(plan => plan.content_type === contentTypeFilter);
  }, [groupFilteredPlans, contentTypeFilter]);

  // 미완료 플랜 목록 (선택 모드에서 사용) - 매 렌더마다 필터링 방지
  const uncompletedPlans = useMemo(
    () => plans.filter((p) => p.status !== 'completed'),
    [plans]
  );

  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  // 선택 모드 상태 (기본: off → QuickComplete 버튼 표시)
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // 선택 관련 상태
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  // 삭제 확인 모달 상태
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    planId: string | null;
    isAdHoc: boolean;
  }>({ open: false, planId: null, isAdHoc: false });

  // 선택 모드 토글
  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      // 선택 모드 종료 시 선택 초기화
      setSelectedPlans(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleMoveToDaily = useCallback(async (planId: string, targetDate: string) => {
    startTransition(async () => {
      const result = await movePlanToContainer({
        planId,
        targetContainer: 'daily',
        targetDate,
      });

      if (!result.success) {
        showToast(result.error ?? 'Daily 이동 실패', 'error');
        return;
      }

      showToast('Daily Dock으로 이동했습니다.', 'success');
      // 타겟 새로고침: Daily + Weekly만 (Unfinished는 영향 없음)
      (onRefreshDailyAndWeekly ?? onRefresh)();
    });
  }, [showToast, onRefreshDailyAndWeekly, onRefresh]);

  // 삭제 확인 모달 열기
  const handleDeleteRequest = (planId: string, isAdHoc = false) => {
    setDeleteConfirm({ open: true, planId, isAdHoc });
  };

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.planId) return;

    startTransition(async () => {
      const result = await deletePlan({
        planId: deleteConfirm.planId!,
        isAdHoc: deleteConfirm.isAdHoc,
      });

      if (!result.success) {
        showToast(result.error ?? '삭제 실패', 'error');
        setDeleteConfirm({ open: false, planId: null, isAdHoc: false });
        return;
      }

      showToast('플랜이 삭제되었습니다.', 'success');
      setDeleteConfirm({ open: false, planId: null, isAdHoc: false });
      onRefresh();
    });
  };

  // 선택 관련 핸들러
  const handleToggleSelect = (planId: string) => {
    setSelectedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPlans.size === uncompletedPlans.length) {
      setSelectedPlans(new Set());
    } else {
      setSelectedPlans(new Set(uncompletedPlans.map((p) => p.id)));
    }
  };

  const handleBulkRedistribute = () => {
    if (selectedPlans.size > 0) {
      setShowBulkModal(true);
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkModal(false);
    setSelectedPlans(new Set());
    onRefresh();
  };

  // 선택된 플랜 ID 배열 메모이제이션 (Array.from 반복 호출 방지)
  const selectedPlanIds = useMemo(
    () => Array.from(selectedPlans),
    [selectedPlans]
  );

  // 그룹 이동 핸들러 메모이제이션
  const handleMoveToGroupBulk = useCallback(() => {
    if (onMoveToGroup) {
      onMoveToGroup(selectedPlanIds);
    }
  }, [onMoveToGroup, selectedPlanIds]);

  // 복사 핸들러 메모이제이션
  const handleCopyBulk = useCallback(() => {
    if (onCopy) {
      onCopy(selectedPlanIds);
    }
  }, [onCopy, selectedPlanIds]);

  // 단일 플랜 그룹 이동 핸들러 메모이제이션
  const handleMoveToGroupSingle = useCallback(
    (id: string) => onMoveToGroup?.([id]),
    [onMoveToGroup]
  );

  // 단일 플랜 복사 핸들러 메모이제이션
  const handleCopySingle = useCallback(
    (id: string) => onCopy?.([id]),
    [onCopy]
  );

  // Daily 이동 핸들러 메모이제이션 (selectedDate, handleMoveToDaily 의존)
  const handleMoveToDailySingle = useCallback(
    (id: string) => handleMoveToDaily(id, selectedDate),
    [selectedDate, handleMoveToDaily]
  );

  const formatWeekRange = () => {
    const start = new Date(weekRange.start + 'T00:00:00');
    const end = new Date(weekRange.end + 'T00:00:00');
    return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
  };

  const totalCount = plans.length + adHocPlans.length;

  return (
    <DroppableContainer id="weekly">
      <div
        className={cn(
          'bg-green-50 rounded-lg border border-green-200',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-medium text-green-700">Weekly Dock</span>
            <span className="text-sm text-gray-600">{formatWeekRange()}</span>
            {totalCount > 0 && (
              <span className="text-sm text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                {totalCount}개
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 선택 모드 토글 */}
            {uncompletedPlans.length > 0 && (
              <button
                onClick={handleToggleSelectionMode}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  isSelectionMode
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {isSelectionMode ? '선택 모드 종료' : '선택'}
              </button>
            )}
            {/* 선택 모드일 때만 전체 선택/해제 버튼 표시 */}
            {isSelectionMode && uncompletedPlans.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                {selectedPlans.size === uncompletedPlans.length
                  ? '전체 해제'
                  : '전체 선택'}
              </button>
            )}
            {isSelectionMode && selectedPlans.size > 0 && (
              <>
                <button
                  onClick={handleBulkRedistribute}
                  className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600"
                >
                  일괄 작업 ({selectedPlans.size})
                </button>
                {onMoveToGroup && (
                  <button
                    onClick={handleMoveToGroupBulk}
                    className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
                  >
                    그룹 이동
                  </button>
                )}
                {onCopy && (
                  <button
                    onClick={handleCopyBulk}
                    className="px-3 py-1.5 text-sm bg-teal-500 text-white rounded-md hover:bg-teal-600"
                  >
                    복사
                  </button>
                )}
              </>
            )}
            {onReorder && plans.length > 1 && (
              <button
                onClick={onReorder}
                className="px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                title="순서 변경"
              >
                ↕️
              </button>
            )}
            <span className="text-xs text-gray-500">
              드래그하여 Daily로 이동
            </span>
          </div>
        </div>

        {/* 플랜 목록 */}
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-2">
              {SKELETON_ITEMS.map((i) => (
                <div key={i} className="h-16 bg-green-100 rounded animate-pulse" />
              ))}
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>이번 주 Weekly Dock이 비어있습니다</p>
              <p className="text-sm mt-1">Daily에서 플랜을 이동하거나 추가하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 일반 플랜 */}
              {plans.map((plan) => {
                const planData = toPlanItemData(plan, 'plan');
                const isCompleted = plan.status === 'completed';

                return (
                  <PlanItemCard
                    key={plan.id}
                    plan={planData}
                    container="weekly"
                    showProgress={false}
                    showCarryover={true}
                    selectable={isSelectionMode && !isCompleted}
                    isSelected={selectedPlans.has(plan.id)}
                    onSelect={handleToggleSelect}
                    onMoveToDaily={handleMoveToDailySingle}
                    onRedistribute={onRedistribute}
                    onEdit={onEdit}
                    onMoveToGroup={onMoveToGroup ? handleMoveToGroupSingle : undefined}
                    onCopy={onCopy ? handleCopySingle : undefined}
                    onStatusChange={onStatusChange}
                    onDelete={handleDeleteRequest}
                    onRefresh={onRefresh}
                  />
                );
              })}

              {/* Ad-hoc 플랜 */}
              {adHocPlans.map((adHoc) => {
                const planData = toPlanItemData(adHoc, 'adhoc');

                return (
                  <PlanItemCard
                    key={adHoc.id}
                    plan={planData}
                    container="weekly"
                    showProgress={false}
                    onDelete={(id) => handleDeleteRequest(id, true)}
                    onRefresh={onRefresh}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 일괄 작업 모달 */}
      {showBulkModal && (
        <BulkRedistributeModal
          planIds={selectedPlanIds}
          studentId={studentId}
          tenantId={tenantId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirm({ open: false, planId: null, isAdHoc: false });
          }
        }}
        title="플랜 삭제"
        description="이 플랜을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="destructive"
        isLoading={isPending}
        onConfirm={handleDeleteConfirm}
      />
    </DroppableContainer>
  );
});
