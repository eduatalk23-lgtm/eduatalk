'use client';

import { useState, useTransition, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { usePlanToast } from './PlanToast';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { PlanItemCard, toPlanItemData } from './items';
import { DailyDockTimeline } from './DailyDockTimeline';
import { useDailyDockQuery } from '@/lib/hooks/useAdminDockQueries';
import type { ContentTypeFilter } from './AdminPlanManagement';

interface DailyDockProps {
  studentId: string;
  tenantId: string;
  /** 플래너 ID (플래너 기반 필터링용) */
  plannerId?: string;
  selectedDate: string;
  activePlanGroupId: string | null;
  /** 콘텐츠 유형 필터 */
  contentTypeFilter?: ContentTypeFilter;
  onAddContent: () => void;
  onAddAdHoc: () => void;
  onRedistribute: (planId: string) => void;
  onEdit?: (planId: string) => void;
  onReorder?: () => void;
  onMoveToGroup?: (planIds: string[], currentGroupId?: string | null) => void;
  onCopy?: (planIds: string[]) => void;
  onStatusChange?: (planId: string, currentStatus: string, title: string) => void;
  onRefresh: () => void;
}

export function DailyDock({
  studentId,
  tenantId,
  plannerId,
  selectedDate,
  activePlanGroupId,
  contentTypeFilter = 'all',
  onAddContent,
  onAddAdHoc,
  onRedistribute,
  onEdit,
  onReorder,
  onMoveToGroup,
  onCopy,
  onStatusChange,
  onRefresh,
}: DailyDockProps) {
  // React Query 훅 사용 (캐싱 및 중복 요청 방지)
  const { plans: allPlans, adHocPlans, isLoading, invalidate } = useDailyDockQuery(
    studentId,
    selectedDate,
    plannerId
  );

  // 콘텐츠 유형 필터 적용
  const plans = useMemo(() => {
    if (contentTypeFilter === 'all') return allPlans;
    return allPlans.filter(plan => plan.content_type === contentTypeFilter);
  }, [allPlans, contentTypeFilter]);

  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  // 선택 관련 상태
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  const handleMoveToWeekly = async (planId: string) => {
    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      const { error } = await supabase
        .from('student_plan')
        .update({
          container_type: 'weekly',
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (error) {
        showToast('Weekly 이동 실패: ' + error.message, 'error');
        return;
      }

      showToast('Weekly Dock으로 이동했습니다.', 'success');
      onRefresh();
    });
  };

  const handleDelete = async (planId: string, isAdHoc = false) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      let error;
      if (isAdHoc) {
        const result = await supabase.from('ad_hoc_plans').delete().eq('id', planId);
        error = result.error;
      } else {
        const result = await supabase
          .from('student_plan')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', planId);
        error = result.error;
      }

      if (error) {
        showToast('삭제 실패: ' + error.message, 'error');
        return;
      }

      showToast('플랜이 삭제되었습니다.', 'success');
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
          <button
            onClick={onAddContent}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + 플랜 추가
          </button>
          <div className="relative group">
            <button
              onClick={onAddAdHoc}
              disabled={!activePlanGroupId}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md',
                activePlanGroupId
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              )}
            >
              + 단발성
            </button>
            {!activePlanGroupId && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                활성 플랜 그룹이 필요합니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 타임라인 */}
      {allPlans.length > 0 && (
        <div className="px-4 pt-3">
          <DailyDockTimeline plans={allPlans} />
        </div>
      )}

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

              return (
                <PlanItemCard
                  key={plan.id}
                  plan={planData}
                  container="daily"
                  showProgress={true}
                  showTime={true}
                  selectable={!isCompleted}
                  isSelected={selectedPlans.has(plan.id)}
                  onSelect={handleToggleSelect}
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

            {/* Ad-hoc 플랜 */}
            {adHocPlans.map((adHoc) => {
              const planData = toPlanItemData(adHoc, 'adhoc');

              return (
                <PlanItemCard
                  key={adHoc.id}
                  plan={planData}
                  container="daily"
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
