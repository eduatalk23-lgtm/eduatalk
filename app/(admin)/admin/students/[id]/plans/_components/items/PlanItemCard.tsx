'use client';

import { useTransition } from 'react';
import { cn } from '@/lib/cn';
import { DraggablePlanItem } from '../dnd';
import { QuickCompleteButton, InlineVolumeEditor, QuickProgressInput } from '../QuickActions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';

export type PlanItemType = 'plan' | 'adhoc';
export type ContainerType = 'daily' | 'weekly' | 'unfinished';

export interface PlanItemData {
  id: string;
  type: PlanItemType;
  title: string;
  subject?: string;
  pageRangeStart?: number | null;
  pageRangeEnd?: number | null;
  completedStart?: number | null;
  completedEnd?: number | null;
  status: string;
  isCompleted: boolean;
  customTitle?: string | null;
  customRangeDisplay?: string | null;
  estimatedMinutes?: number | null;
  planDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  carryoverCount?: number;
  carryoverFromDate?: string | null;
  planGroupId?: string | null;
}

interface PlanItemCardProps {
  plan: PlanItemData;
  container: ContainerType;
  variant?: 'default' | 'compact' | 'grid';
  showProgress?: boolean;
  showTime?: boolean;
  showCarryover?: boolean;
  showActions?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onMoveToDaily?: (id: string, date?: string) => void;
  onMoveToWeekly?: (id: string) => void;
  onMoveToUnfinished?: (id: string) => void;
  onRedistribute?: (id: string) => void;
  onDelete?: (id: string, isAdHoc?: boolean) => void;
  onEditDate?: (id: string) => void;
  onRefresh?: () => void;
}

const containerColors = {
  daily: {
    border: 'border-blue-100',
    borderCompleted: 'border-green-200 bg-green-50/50',
  },
  weekly: {
    border: 'border-green-100 hover:border-green-300',
    borderCompleted: 'border-green-300 bg-green-50/50',
  },
  unfinished: {
    border: 'border-red-100',
    borderCompleted: 'border-green-200 bg-green-50/50',
  },
};

export function PlanItemCard({
  plan,
  container,
  variant = 'default',
  showProgress = true,
  showTime = false,
  showCarryover = false,
  showActions = true,
  selectable = false,
  isSelected = false,
  onSelect,
  onMoveToDaily,
  onMoveToWeekly,
  onMoveToUnfinished,
  onRedistribute,
  onDelete,
  onEditDate,
  onRefresh,
}: PlanItemCardProps) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();
  const isAdHoc = plan.type === 'adhoc';
  const isCompleted = plan.isCompleted || plan.status === 'completed';
  const hasPageRange = plan.pageRangeStart != null && plan.pageRangeEnd != null;

  const rangeDisplay = plan.customRangeDisplay ??
    (hasPageRange ? `p.${plan.pageRangeStart}-${plan.pageRangeEnd}` : undefined);

  const handleMoveContainer = async (targetContainer: ContainerType) => {
    const supabase = createSupabaseBrowserClient();
    const table = isAdHoc ? 'ad_hoc_plans' : 'student_plan';

    startTransition(async () => {
      const updateData: Record<string, unknown> = {
        container_type: targetContainer,
        updated_at: new Date().toISOString(),
      };

      if (targetContainer === 'daily') {
        updateData.plan_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', plan.id);

      if (error) {
        showError('이동 실패: ' + error.message);
        return;
      }

      const containerName = targetContainer === 'daily' ? 'Daily' :
                           targetContainer === 'weekly' ? 'Weekly' : 'Unfinished';
      showSuccess(`${containerName} Dock으로 이동했습니다.`);
      onRefresh?.();
    });
  };

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      let error;
      if (isAdHoc) {
        const result = await supabase.from('ad_hoc_plans').delete().eq('id', plan.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('student_plan')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', plan.id);
        error = result.error;
      }

      if (error) {
        showError('삭제 실패: ' + error.message);
        return;
      }

      showSuccess('플랜이 삭제되었습니다.');
      onRefresh?.();
    });
  };

  const colors = containerColors[container];

  // Compact variant (for grid/weekly view)
  if (variant === 'compact' || variant === 'grid') {
    return (
      <DraggablePlanItem
        id={plan.id}
        type={plan.type}
        containerId={container}
        title={plan.title}
        subject={plan.subject}
        range={rangeDisplay}
        disabled={isCompleted || isPending}
      >
        <div
          className={cn(
            'flex flex-col gap-2 bg-white rounded-lg p-3 border transition-opacity',
            isCompleted ? colors.borderCompleted : colors.border,
            isPending && 'opacity-50 pointer-events-none'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {isAdHoc && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded mr-2">
                  단발성
                </span>
              )}
              <div
                className={cn(
                  'font-medium text-sm truncate',
                  isCompleted && 'line-through text-gray-500'
                )}
              >
                {plan.title}
              </div>
              <div className="text-xs text-gray-500">
                {plan.subject && <span>{plan.subject} · </span>}
                {rangeDisplay}
              </div>
            </div>
          </div>

          {/* Actions */}
          {showActions && !isCompleted && (
            <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
              {container !== 'daily' && (
                <button
                  onClick={() => onMoveToDaily?.(plan.id) ?? handleMoveContainer('daily')}
                  className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  →Daily
                </button>
              )}
              {container !== 'weekly' && (
                <button
                  onClick={() => onMoveToWeekly?.(plan.id) ?? handleMoveContainer('weekly')}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  →W
                </button>
              )}
              {!isAdHoc && onRedistribute && (
                <button
                  onClick={() => onRedistribute(plan.id)}
                  className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                >
                  볼륨
                </button>
              )}
              <button
                onClick={() => onDelete?.(plan.id, isAdHoc) ?? handleDelete()}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </DraggablePlanItem>
    );
  }

  // Default variant (full)
  return (
    <DraggablePlanItem
      id={plan.id}
      type={plan.type}
      containerId={container}
      title={plan.title}
      subject={plan.subject}
      range={rangeDisplay}
      disabled={isCompleted || isPending}
    >
      <div
        className={cn(
          'flex items-center gap-3 bg-white rounded-lg p-3 border transition-opacity',
          isCompleted ? colors.borderCompleted : colors.border,
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* Checkbox for selection or completion */}
        {selectable ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(plan.id)}
            className="w-4 h-4 rounded border-gray-300"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <QuickCompleteButton
            planId={plan.id}
            planType={isAdHoc ? 'adhoc' : 'plan'}
            isCompleted={isCompleted}
            onSuccess={onRefresh ?? (() => {})}
          />
        )}

        {/* Drag handle */}
        <span className="text-gray-400 cursor-grab">☰</span>

        {/* Ad-hoc badge */}
        {isAdHoc && (
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0">
            단발성
          </span>
        )}

        {/* Plan info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Time display */}
            {showTime && plan.startTime && (
              <span className="text-xs text-gray-500 shrink-0">
                {plan.startTime.substring(0, 5)}
              </span>
            )}
            {/* Carryover date */}
            {showCarryover && plan.planDate && (
              <span className="text-xs text-gray-500 shrink-0">
                {formatDateShort(plan.carryoverFromDate ?? plan.planDate)}
              </span>
            )}
            <span
              className={cn(
                'font-medium truncate',
                isCompleted && 'line-through text-gray-500'
              )}
            >
              {plan.title}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {plan.subject && (
              <span className="text-gray-500">{plan.subject}</span>
            )}
            {hasPageRange && !isCompleted && onRefresh ? (
              <InlineVolumeEditor
                planId={plan.id}
                currentStart={plan.pageRangeStart!}
                currentEnd={plan.pageRangeEnd!}
                onSuccess={onRefresh}
              />
            ) : rangeDisplay ? (
              <span className="text-gray-500">{rangeDisplay}</span>
            ) : null}
            {isAdHoc && plan.estimatedMinutes && (
              <span className="text-gray-500">약 {plan.estimatedMinutes}분</span>
            )}
          </div>
          {/* Progress bar */}
          {showProgress && hasPageRange && !isCompleted && onRefresh && (
            <div className="mt-1">
              <QuickProgressInput
                planId={plan.id}
                plannedStart={plan.pageRangeStart!}
                plannedEnd={plan.pageRangeEnd!}
                completedStart={plan.completedStart ?? 0}
                completedEnd={plan.completedEnd ?? 0}
                onSuccess={onRefresh}
              />
            </div>
          )}
          {/* Carryover indicator */}
          {showCarryover && plan.carryoverCount && plan.carryoverCount > 0 && (
            <div className="text-xs text-amber-600 mt-0.5">
              {plan.carryoverCount}회 이월됨
            </div>
          )}
        </div>

        {/* Actions */}
        {isCompleted ? (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded shrink-0">
            완료
          </span>
        ) : showActions ? (
          <div className="flex items-center gap-1 shrink-0">
            {/* Move buttons */}
            {container !== 'daily' && (
              <button
                onClick={() => onMoveToDaily?.(plan.id) ?? handleMoveContainer('daily')}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="Daily로 이동"
              >
                →D
              </button>
            )}
            {container !== 'weekly' && (
              <button
                onClick={() => onMoveToWeekly?.(plan.id) ?? handleMoveContainer('weekly')}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                title="Weekly로 이동"
              >
                →W
              </button>
            )}
            {/* Redistribute */}
            {!isAdHoc && onRedistribute && (
              <button
                onClick={() => onRedistribute(plan.id)}
                className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                title="볼륨 재분배"
              >
                재분배
              </button>
            )}
            {/* Edit date */}
            {onEditDate && (
              <button
                onClick={() => onEditDate(plan.id)}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                title="날짜 변경"
              >
                📅
              </button>
            )}
            {/* Delete */}
            <button
              onClick={() => onDelete?.(plan.id, isAdHoc) ?? handleDelete()}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              title="삭제"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>
    </DraggablePlanItem>
  );
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Helper to convert raw plan data to PlanItemData
export function toPlanItemData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  type: PlanItemType
): PlanItemData {
  if (type === 'adhoc') {
    return {
      id: raw.id,
      type: 'adhoc',
      title: raw.title,
      status: raw.status ?? 'pending',
      isCompleted: raw.status === 'completed',
      estimatedMinutes: raw.estimated_minutes,
      planDate: raw.plan_date,
      startTime: raw.start_time,
      endTime: raw.end_time,
    };
  }

  return {
    id: raw.id,
    type: 'plan',
    title: raw.custom_title ?? raw.content_title ?? '제목 없음',
    subject: raw.content_subject ?? undefined,
    pageRangeStart: raw.planned_start_page_or_time,
    pageRangeEnd: raw.planned_end_page_or_time,
    completedStart: raw.completed_start_page_or_time,
    completedEnd: raw.completed_end_page_or_time,
    status: raw.status ?? 'pending',
    isCompleted: raw.is_completed || raw.status === 'completed',
    customTitle: raw.custom_title,
    customRangeDisplay: raw.custom_range_display,
    planDate: raw.plan_date,
    startTime: raw.start_time,
    endTime: raw.end_time,
    carryoverCount: raw.carryover_count ?? 0,
    carryoverFromDate: raw.carryover_from_date,
    planGroupId: raw.plan_group_id,
  };
}
