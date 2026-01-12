'use client';

import { useState, useTransition, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { PlanItemCard, toPlanItemData } from './items';
import { useWeeklyDockQuery } from '@/lib/hooks/useAdminDockQueries';
import type { ContentTypeFilter } from './AdminPlanManagement';

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
  onStatusChange?: (planId: string, currentStatus: string, title: string) => void;
  onRefresh: () => void;
}

export function WeeklyDock({
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
}: WeeklyDockProps) {
  // React Query 훅 사용 (캐싱 및 중복 요청 방지)
  const { plans: allPlans, adHocPlans, isLoading, weekRange, invalidate } = useWeeklyDockQuery(
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

  const [isPending, startTransition] = useTransition();

  // 선택 관련 상태
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  const handleMoveToDaily = async (planId: string, targetDate: string) => {
    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({
          container_type: 'daily',
          plan_date: targetDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      onRefresh();
    });
  };

  const handleDelete = async (planId: string, isAdHoc = false) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      if (isAdHoc) {
        await supabase.from('ad_hoc_plans').delete().eq('id', planId);
      } else {
        await supabase
          .from('student_plan')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', planId);
      }

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
            {plans.filter((p) => p.status !== 'completed').length > 0 && (
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                {selectedPlans.size === plans.filter((p) => p.status !== 'completed').length
                  ? '전체 해제'
                  : '전체 선택'}
              </button>
            )}
            {selectedPlans.size > 0 && (
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
            <span className="text-xs text-gray-500">
              드래그하여 Daily로 이동
            </span>
          </div>
        </div>

        {/* 플랜 목록 */}
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-green-100 rounded animate-pulse" />
              ))}
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>이번 주 Weekly Dock이 비어있습니다</p>
              <p className="text-sm mt-1">Daily에서 플랜을 이동하거나 추가하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* 일반 플랜 */}
              {plans.map((plan) => {
                const planData = toPlanItemData(plan, 'plan');
                const isCompleted = plan.status === 'completed';

                return (
                  <PlanItemCard
                    key={plan.id}
                    plan={planData}
                    container="weekly"
                    variant="compact"
                    showProgress={false}
                    selectable={!isCompleted}
                    isSelected={selectedPlans.has(plan.id)}
                    onSelect={handleToggleSelect}
                    onMoveToDaily={(id) => handleMoveToDaily(id, selectedDate)}
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

              {/* Ad-hoc 플랜 */}
              {adHocPlans.map((adHoc) => {
                const planData = toPlanItemData(adHoc, 'adhoc');

                return (
                  <PlanItemCard
                    key={adHoc.id}
                    plan={planData}
                    container="weekly"
                    variant="compact"
                    showProgress={false}
                    onDelete={handleDelete}
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
    </DroppableContainer>
  );
}
