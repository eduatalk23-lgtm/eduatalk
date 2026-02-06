'use client';

import { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/cn';
import { usePlanReorder } from '@/lib/hooks/usePlanReorder';
import type { ContainerPlan } from '@/lib/domains/today/actions/containerPlans';
import type { AdHocPlan } from '@/lib/domains/admin-plan/types';
import type { ContainerType } from '@/lib/domains/plan/actions/move';
import { ContainerPlanItem } from './ContainerPlanItem';

type CombinedPlanItem = {
  id: string;
  sequence: number;
  type: 'student_plan' | 'ad_hoc_plan';
  plan?: ContainerPlan;
  adHocPlan?: AdHocPlan;
};

interface ReorderableContainerListProps {
  containerType: ContainerType;
  plans: ContainerPlan[];
  adHocPlans: AdHocPlan[];
  onPlanSelect?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan', isInProgress?: boolean) => void;
  onMoveToDaily?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => void;
  onMoveToWeekly?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => void;
  enableReorder?: boolean;
}

export const ReorderableContainerList = memo(function ReorderableContainerList({
  containerType,
  plans,
  adHocPlans,
  onPlanSelect,
  onMoveToDaily,
  onMoveToWeekly,
  enableReorder = true,
}: ReorderableContainerListProps) {
  // 플랜과 ad-hoc 플랜을 결합하여 단일 리스트로 관리
  const [items, setItems] = useState<CombinedPlanItem[]>(() => {
    const combined: CombinedPlanItem[] = [
      ...plans.map((plan, index) => ({
        id: plan.id,
        sequence: plan.sequence ?? index,
        type: 'student_plan' as const,
        plan,
      })),
      ...adHocPlans.map((adHoc, index) => ({
        id: adHoc.id,
        sequence: (adHoc as unknown as { sequence?: number }).sequence ?? plans.length + index,
        type: 'ad_hoc_plan' as const,
        adHocPlan: adHoc,
      })),
    ];
    return combined.sort((a, b) => a.sequence - b.sequence);
  });

  const { getReorderableProps, isDropTargetAt, isDraggedAt, isDragging, isReordering } =
    usePlanReorder();

  const handleOptimisticUpdate = useCallback((newItems: CombinedPlanItem[]) => {
    setItems(newItems);
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isDropTarget = isDropTargetAt(index);
        const isDragged = isDraggedAt(index);

        const reorderProps = enableReorder
          ? getReorderableProps(index, items, handleOptimisticUpdate)
          : {};

        return (
          <div
            key={item.id}
            {...reorderProps}
            className={cn(
              'transition-all duration-200',
              isDragging && !isDragged && cn(
                'hover:ring-2',
                containerType === 'unfinished' ? 'hover:ring-red-200' :
                containerType === 'weekly' ? 'hover:ring-green-200' :
                'hover:ring-blue-200'
              ),
              isDropTarget && cn(
                'ring-2',
                containerType === 'unfinished' ? 'ring-red-400 bg-red-50/50' :
                containerType === 'weekly' ? 'ring-green-400 bg-green-50/50' :
                'ring-blue-400 bg-blue-50/50'
              ),
              isDragged && 'opacity-50 scale-98'
            )}
          >
            {/* 드롭 인디케이터 (상단) */}
            {isDropTarget && (
              <div className={cn(
                'h-0.5 rounded-full mb-1 animate-pulse',
                containerType === 'unfinished' ? 'bg-red-500' :
                containerType === 'weekly' ? 'bg-green-500' :
                'bg-blue-500'
              )} />
            )}

            {item.type === 'student_plan' && item.plan ? (
              <ContainerPlanItem
                plan={item.plan}
                containerType={containerType}
                onSelect={() =>
                  onPlanSelect?.(item.id, 'student_plan', item.plan!.status === 'in_progress')
                }
                onMoveToDaily={
                  containerType !== 'daily'
                    ? () => onMoveToDaily?.(item.id, 'student_plan')
                    : undefined
                }
                onMoveToWeekly={
                  containerType !== 'weekly'
                    ? () => onMoveToWeekly?.(item.id, 'student_plan')
                    : undefined
                }
              />
            ) : item.adHocPlan ? (
              <ContainerPlanItem
                adHocPlan={item.adHocPlan}
                containerType={containerType}
                onSelect={() =>
                  onPlanSelect?.(item.id, 'ad_hoc_plan', item.adHocPlan!.status === 'in_progress')
                }
                onMoveToDaily={
                  containerType !== 'daily'
                    ? () => onMoveToDaily?.(item.id, 'ad_hoc_plan')
                    : undefined
                }
                onMoveToWeekly={
                  containerType !== 'weekly'
                    ? () => onMoveToWeekly?.(item.id, 'ad_hoc_plan')
                    : undefined
                }
              />
            ) : null}
          </div>
        );
      })}

      {/* 순서 변경 중 오버레이 */}
      {isReordering && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
          <div className="text-sm text-gray-500">순서 변경 중...</div>
        </div>
      )}
    </div>
  );
});
