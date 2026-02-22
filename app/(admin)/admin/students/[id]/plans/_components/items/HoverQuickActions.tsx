'use client';

import { memo } from 'react';
import { Pencil, ArrowRight, MoreHorizontal } from 'lucide-react';
import { StatusChangeSubmenu } from './PlanActionMenu';
import type { ContainerType } from './PlanItemCard';
import type { PlanStatus } from '@/lib/types/plan';

interface HoverQuickActionsProps {
  planId: string;
  isAdHoc: boolean;
  container: ContainerType;
  currentStatus: PlanStatus;
  onEdit?: (id: string) => void;
  onMoveToWeekly?: (id: string) => void;
  onMoveToDaily?: (id: string) => void;
  onStatusChange?: (status: PlanStatus) => void;
  onDetailedStatusChange?: () => void;
}

export const HoverQuickActions = memo(function HoverQuickActions({
  planId,
  container,
  currentStatus,
  onEdit,
  onMoveToWeekly,
  onMoveToDaily,
  onStatusChange,
  onDetailedStatusChange,
}: HoverQuickActionsProps) {
  const showMoveToWeekly = container === 'daily' && onMoveToWeekly;
  const showMoveToDaily = container !== 'daily' && onMoveToDaily;

  return (
    <div
      className="absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200 px-0.5 py-0.5 opacity-0 group-hover/plan:opacity-100 transition-opacity pointer-events-none group-hover/plan:pointer-events-auto hover-hover-only"
    >
      {/* 편집 */}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(planId); }}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          title="편집"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 이동 */}
      {showMoveToWeekly && (
        <button
          onClick={(e) => { e.stopPropagation(); onMoveToWeekly(planId); }}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-green-600"
          title="주간 플랜으로 이동"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
      {showMoveToDaily && (
        <button
          onClick={(e) => { e.stopPropagation(); onMoveToDaily(planId); }}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600"
          title="오늘 플랜으로 이동"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 상태 변경 서브메뉴 */}
      {onStatusChange && (
        <div className="relative group/status">
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="상태 변경"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover/status:block z-50">
            <StatusChangeSubmenu
              currentStatus={currentStatus}
              onStatusChange={onStatusChange}
              onDetailedStatusChange={onDetailedStatusChange}
            />
          </div>
        </div>
      )}
    </div>
  );
});
