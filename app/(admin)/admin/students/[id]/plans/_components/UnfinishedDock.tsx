'use client';

import { useEffect, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableContainer, DraggablePlanItem } from './dnd';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { usePlanToast } from './PlanToast';

interface UnfinishedDockProps {
  studentId: string;
  tenantId: string;
  onRedistribute: (planId: string) => void;
  onEdit?: (planId: string) => void;
  onReorder?: () => void;
  onRefresh: () => void;
}

interface UnfinishedPlan {
  id: string;
  plan_date: string;
  content_title: string | null;
  content_subject: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  carryover_from_date: string | null;
  carryover_count: number;
  custom_title: string | null;
}

export function UnfinishedDock({
  studentId,
  tenantId,
  onRedistribute,
  onEdit,
  onReorder,
  onRefresh,
}: UnfinishedDockProps) {
  const [plans, setPlans] = useState<UnfinishedPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [showBulkModal, setShowBulkModal] = useState(false);
  const { showToast } = usePlanToast();

  useEffect(() => {
    async function fetchUnfinished() {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('student_plan')
        .select(`
          id,
          plan_date,
          content_title,
          content_subject,
          planned_start_page_or_time,
          planned_end_page_or_time,
          carryover_from_date,
          carryover_count,
          custom_title
        `)
        .eq('student_id', studentId)
        .eq('container_type', 'unfinished')
        .eq('is_active', true)
        .order('plan_date', { ascending: true });

      if (!error && data) {
        setPlans(data);
      }
      setIsLoading(false);
    }

    fetchUnfinished();
  }, [studentId]);

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
    const today = new Date().toISOString().split('T')[0];

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({
          container_type: 'daily',
          plan_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      onRefresh();
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

  if (plans.length === 0) {
    return null;
  }

  return (
    <DroppableContainer id="unfinished">
      <div
        className={cn(
          'bg-red-50 rounded-lg border border-red-200 overflow-hidden',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-red-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔴</span>
            <span className="font-medium text-red-700">Unfinished</span>
            <span className="text-sm text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              {plans.length}건
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              {selectedPlans.size === plans.length ? '전체 해제' : '전체 선택'}
            </button>
            {selectedPlans.size > 0 && (
              <button
                onClick={handleBulkRedistribute}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                일괄 작업 ({selectedPlans.size})
              </button>
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
            const rangeDisplay = plan.planned_start_page_or_time && plan.planned_end_page_or_time
              ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`
              : undefined;

            return (
              <DraggablePlanItem
                key={plan.id}
                id={plan.id}
                type="plan"
                containerId="unfinished"
                title={plan.custom_title ?? plan.content_title ?? '제목 없음'}
                subject={plan.content_subject ?? undefined}
                range={rangeDisplay}
              >
                <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-red-100">
                  {/* 체크박스 */}
                  <input
                    type="checkbox"
                    checked={selectedPlans.has(plan.id)}
                    onChange={() => handleToggleSelect(plan.id)}
                    className="w-4 h-4 rounded border-gray-300"
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {formatDate(plan.carryover_from_date ?? plan.plan_date)}
                      </span>
                      <span className="font-medium truncate">
                        {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                      </span>
                    </div>
                    {rangeDisplay && (
                      <div className="text-sm text-gray-500">{rangeDisplay}</div>
                    )}
                    {plan.carryover_count > 0 && (
                      <div className="text-xs text-amber-600">
                        {plan.carryover_count}회 이월됨
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveToDaily(plan.id)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      →Daily
                    </button>
                    <button
                      onClick={() => handleMoveToWeekly(plan.id)}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      →Weekly
                    </button>
                    <button
                      onClick={() => onRedistribute(plan.id)}
                      className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      재분배
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(plan.id)}
                        className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                        title="플랜 수정"
                      >
                        수정
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </DraggablePlanItem>
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
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
