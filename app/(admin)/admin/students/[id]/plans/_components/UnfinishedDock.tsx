'use client';

import { useEffect, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { usePlanToast } from './PlanToast';
import { PlanItemCard, toPlanItemData } from './items';

interface UnfinishedDockProps {
  studentId: string;
  tenantId: string;
  onRedistribute: (planId: string) => void;
  onEdit?: (planId: string) => void;
  onReorder?: () => void;
  onMoveToGroup?: (planIds: string[], currentGroupId?: string | null) => void;
  onCopy?: (planIds: string[]) => void;
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
  onMoveToGroup,
  onCopy,
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
                selectable={true}
                isSelected={selectedPlans.has(plan.id)}
                onSelect={handleToggleSelect}
                onMoveToDaily={handleMoveToDaily}
                onMoveToWeekly={handleMoveToWeekly}
                onRedistribute={onRedistribute}
                onEdit={onEdit}
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
}
