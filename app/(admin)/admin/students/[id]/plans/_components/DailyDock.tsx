'use client';

import { useState, useTransition, useMemo, memo } from 'react';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { usePlanToast } from './PlanToast';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { PlanItemCard, toPlanItemData } from './items';
import { useDailyDockQuery } from '@/lib/hooks/useAdminDockQueries';
import { detectTimeConflicts } from '@/lib/domains/admin-plan/utils/conflictDetection';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { deletePlan, movePlanToContainer } from '@/lib/domains/plan/actions/dock';
import type { ContentTypeFilter } from './AdminPlanManagement';
import type { PlanStatus } from '@/lib/types/plan';

interface DailyDockProps {
  studentId: string;
  tenantId: string;
  /** 플래너 ID (플래너 기반 필터링용) */
  plannerId?: string;
  selectedDate: string;
  activePlanGroupId: string | null;
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
 * DailyDock - 일일 플랜 Dock 컴포넌트
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const DailyDock = memo(function DailyDock({
  studentId,
  tenantId,
  plannerId,
  selectedDate,
  activePlanGroupId,
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
}: DailyDockProps) {
  // React Query 훅 사용 (캐싱 및 중복 요청 방지)
  const { plans: allPlans, adHocPlans, isLoading } = useDailyDockQuery(
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

  // 시간 충돌 감지 (필터링된 플랜 기준)
  const conflictMap = useMemo(() => {
    const timeSlots = allPlans.map((plan) => ({
      id: plan.id,
      title: plan.content_title ?? plan.custom_title ?? '플랜',
      startTime: plan.start_time ?? null,
      endTime: plan.end_time ?? null,
    }));
    return detectTimeConflicts(timeSlots);
  }, [allPlans]);

  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  // 선택 모드 상태 (기본: off → QuickComplete 버튼 표시)
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // 선택 관련 상태
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  // 선택 모드 토글
  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      // 선택 모드 종료 시 선택 초기화
      setSelectedPlans(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  // 삭제 확인 모달 상태
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    planId: string | null;
    isAdHoc: boolean;
  }>({ open: false, planId: null, isAdHoc: false });

  const handleMoveToWeekly = async (planId: string) => {
    startTransition(async () => {
      const result = await movePlanToContainer({
        planId,
        targetContainer: 'weekly',
      });

      if (!result.success) {
        showToast(result.error ?? 'Weekly 이동 실패', 'error');
        return;
      }

      showToast('Weekly Dock으로 이동했습니다.', 'success');
      // 타겟 새로고침: Daily + Weekly만 (Unfinished는 영향 없음)
      (onRefreshDailyAndWeekly ?? onRefresh)();
    });
  };

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

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일 (${days[date.getDay()]})`;
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
    // 완료되지 않은 일반 플랜만 선택 (adhoc 제외)
    const uncompletedPlans = plans.filter((p) => p.status !== 'completed');
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

  const totalCount = plans.length + adHocPlans.length;
  const completedCount =
    plans.filter((p) => p.status === 'completed').length +
    adHocPlans.filter((p) => p.status === 'completed').length;

  return (
    <DroppableContainer id="daily">
      <div
        className={cn(
          'bg-blue-50 rounded-lg border border-blue-200',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="font-medium text-blue-700">Daily Dock</span>
          <span className="text-sm text-gray-600">
            {formatDateDisplay(selectedDate)}
          </span>
          {totalCount > 0 && (
            <span className="text-sm text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 선택 모드 토글 */}
          {plans.filter((p) => p.status !== 'completed').length > 0 && (
            <button
              onClick={handleToggleSelectionMode}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                isSelectionMode
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {isSelectionMode ? '선택 모드 종료' : '선택'}
            </button>
          )}
          {/* 선택 모드일 때만 전체 선택/해제 버튼 표시 */}
          {isSelectionMode && plans.filter((p) => p.status !== 'completed').length > 0 && (
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              {selectedPlans.size === plans.filter((p) => p.status !== 'completed').length
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
                  onClick={() => onMoveToGroup(Array.from(selectedPlans))}
                  className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
                >
                  그룹 이동
                </button>
              )}
              {onCopy && (
                <button
                  onClick={() => onCopy(Array.from(selectedPlans))}
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
        </div>
      </div>

      {/* 플랜 목록 */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-blue-100 rounded animate-pulse" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>이 날짜에 플랜이 없습니다</p>
            <p className="text-sm mt-1">플랜을 추가해주세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 일반 플랜 */}
            {plans.map((plan) => {
              const planData = toPlanItemData(plan, 'plan');
              const isCompleted = plan.status === 'completed' || (plan.progress ?? 0) >= 100;
              const conflictInfo = conflictMap.get(plan.id);

              return (
                <PlanItemCard
                  key={plan.id}
                  plan={planData}
                  container="daily"
                  showProgress={true}
                  showTime={true}
                  selectable={isSelectionMode && !isCompleted}
                  isSelected={selectedPlans.has(plan.id)}
                  conflictInfo={conflictInfo}
                  onSelect={handleToggleSelect}
                  onMoveToWeekly={handleMoveToWeekly}
                  onRedistribute={onRedistribute}
                  onEdit={onEdit}
                  onMoveToGroup={onMoveToGroup ? (id) => onMoveToGroup([id]) : undefined}
                  onCopy={onCopy ? (id) => onCopy([id]) : undefined}
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
                  container="daily"
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
          planIds={Array.from(selectedPlans)}
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
