'use client';

import { useState, useTransition, useMemo, memo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { usePlanToast } from './PlanToast';
import { PlanItemCard, toPlanItemData } from './items';
import { useUnfinishedDockQuery } from '@/lib/hooks/useAdminDockQueries';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import type { ContentTypeFilter } from './AdminPlanManagement';
import type { PlanStatus } from '@/lib/types/plan';

interface UnfinishedDockProps {
  studentId: string;
  tenantId: string;
  /** 플래너 ID (플래너 기반 필터링용) */
  plannerId?: string;
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
  /** Daily + Unfinished만 새로고침 (Daily로 이동 시 사용) */
  onRefreshDailyAndUnfinished?: () => void;
}

/**
 * UnfinishedDock - 미완료 플랜 Dock 컴포넌트
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const UnfinishedDock = memo(function UnfinishedDock({
  studentId,
  tenantId,
  plannerId,
  selectedGroupId,
  contentTypeFilter = 'all',
  onRedistribute,
  onEdit,
  onReorder,
  onMoveToGroup,
  onCopy,
  onStatusChange,
  onRefresh,
  onRefreshDailyAndUnfinished,
}: UnfinishedDockProps) {
  // React Query 훅 사용 (캐싱 및 중복 요청 방지)
  const { plans: allPlans, isLoading, invalidate } = useUnfinishedDockQuery(studentId, plannerId);

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

  // 선택 모드 상태 (기본: off → QuickComplete 버튼 표시)
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [showBulkModal, setShowBulkModal] = useState(false);
  const { showToast } = usePlanToast();

  // 선택 모드 토글
  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      // 선택 모드 종료 시 선택 초기화
      setSelectedPlans(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

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

  const handleMoveToDaily = async (planId: string) => {
    const supabase = createSupabaseBrowserClient();
    const today = getTodayInTimezone();

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({
          container_type: 'daily',
          plan_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      // 타겟 새로고침: Daily + Unfinished만 (Weekly는 영향 없음)
      (onRefreshDailyAndUnfinished ?? onRefresh)();
    });
  };

  const handleMoveToWeekly = async (planId: string) => {
    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({
          container_type: 'weekly',
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      onRefresh();
    });
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', planId);

      onRefresh();
    });
  };

  const handleBulkRedistribute = () => {
    if (selectedPlans.size === 0) {
      showToast('작업할 플랜을 선택하세요', 'warning');
      return;
    }
    setShowBulkModal(true);
  };

  const handleBulkSuccess = () => {
    setShowBulkModal(false);
    setSelectedPlans(new Set());
    onRefresh();
  };

  const handleSelectAll = () => {
    if (selectedPlans.size === plans.length) {
      setSelectedPlans(new Set());
    } else {
      setSelectedPlans(new Set(plans.map((p) => p.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-4 animate-pulse">
        <div className="h-5 bg-red-200 rounded w-32 mb-3" />
        <div className="space-y-2">
          <div className="h-12 bg-red-100 rounded" />
          <div className="h-12 bg-red-100 rounded" />
        </div>
      </div>
    );
  }

  // 빈 상태: 최소 헤더만 표시
  if (plans.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg opacity-50">⏰</span>
          <span className="font-medium text-gray-400">밀린 플랜</span>
          <span className="text-sm text-gray-400">0건</span>
        </div>
      </div>
    );
  }

  return (
    <DroppableContainer id="unfinished">
      <div
        className={cn(
          'bg-red-50 rounded-lg border border-red-200',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-red-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏰</span>
            <span className="font-medium text-red-700">밀린 플랜</span>
            <span className="text-sm text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              {plans.length}건
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 선택 모드 토글 */}
            <button
              onClick={handleToggleSelectionMode}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                isSelectionMode
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {isSelectionMode ? '선택 모드 종료' : '선택'}
            </button>
            {/* 선택 모드일 때만 전체 선택/해제 버튼 표시 */}
            {isSelectionMode && (
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                {selectedPlans.size === plans.length ? '전체 해제' : '전체 선택'}
              </button>
            )}
            {isSelectionMode && selectedPlans.size > 0 && (
              <>
                <button
                  onClick={handleBulkRedistribute}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
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
        <div className="p-4 space-y-2">
          {plans.map((plan) => {
            const planData = toPlanItemData(plan, 'plan');

            return (
              <PlanItemCard
                key={plan.id}
                plan={planData}
                container="unfinished"
                showProgress={false}
                showCarryover={true}
                selectable={isSelectionMode}
                isSelected={selectedPlans.has(plan.id)}
                onSelect={handleToggleSelect}
                onMoveToDaily={handleMoveToDaily}
                onMoveToWeekly={handleMoveToWeekly}
                onRedistribute={onRedistribute}
                onEdit={onEdit}
                onMoveToGroup={onMoveToGroup ? (id) => onMoveToGroup([id]) : undefined}
                onCopy={onCopy ? (id) => onCopy([id]) : undefined}
                onStatusChange={onStatusChange}
                onDelete={handleDelete}
                onRefresh={onRefresh}
              />
            );
          })}
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
    </DroppableContainer>
  );
});
