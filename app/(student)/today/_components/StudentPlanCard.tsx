'use client';

import { memo, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { togglePlanComplete, movePlanToContainer } from '@/lib/domains/plan/actions/dock';
import { formatPlanLearningAmount } from '@/lib/utils/planFormatting';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import type { PlanItemData, ContainerType } from '@/lib/types/planItem';

interface StudentPlanCardProps {
  plan: PlanItemData;
  container: ContainerType;
  showTime?: boolean;
  showCarryover?: boolean;
  onMoveToDaily?: (id: string) => void;
  onMoveToWeekly?: (id: string) => void;
  onRefresh?: () => void;
}

function getLeftBorderColor(isCompleted: boolean, carryoverCount: number = 0): string {
  if (isCompleted) return 'border-l-4 border-l-green-400';
  if (carryoverCount >= 3) return 'border-l-4 border-l-red-500';
  if (carryoverCount === 2) return 'border-l-4 border-l-orange-400';
  if (carryoverCount === 1) return 'border-l-4 border-l-yellow-400';
  return 'border-l-4 border-l-gray-300';
}

export const StudentPlanCard = memo(function StudentPlanCard({
  plan,
  container,
  showTime = false,
  showCarryover = false,
  onMoveToDaily,
  onMoveToWeekly,
  onRefresh,
}: StudentPlanCardProps) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();
  const isCompleted = plan.isCompleted || plan.status === 'completed';
  const isAdHoc = plan.type === 'adhoc';
  const hasPageRange = plan.pageRangeStart != null && plan.pageRangeEnd != null;

  const rangeDisplay = plan.customRangeDisplay ?? (hasPageRange
    ? formatPlanLearningAmount({
        content_type: plan.contentType || 'book',
        planned_start_page_or_time: plan.pageRangeStart!,
        planned_end_page_or_time: plan.pageRangeEnd!,
      })
    : undefined);

  const handleToggle = () => {
    startTransition(async () => {
      const result = await togglePlanComplete(plan.id, isCompleted, isAdHoc, true);
      if (!result.success) {
        showError(result.error ?? '상태 변경 실패');
        return;
      }
      showSuccess(isCompleted ? '미완료로 변경했습니다.' : '완료 처리했습니다.');
      onRefresh?.();
    });
  };

  const handleMove = (target: ContainerType) => {
    if (target === 'daily' && onMoveToDaily) {
      onMoveToDaily(plan.id);
      return;
    }
    if (target === 'weekly' && onMoveToWeekly) {
      onMoveToWeekly(plan.id);
      return;
    }
    startTransition(async () => {
      const result = await movePlanToContainer({
        planId: plan.id,
        targetContainer: target,
        isAdHoc,
        targetDate: target === 'daily' ? getTodayInTimezone() : undefined,
        skipRevalidation: true,
      });
      if (!result.success) {
        showError(result.error ?? '이동 실패');
        return;
      }
      const label = target === 'daily' ? '오늘 플랜' : target === 'weekly' ? '주간 플랜' : '미완료 플랜';
      showSuccess(`${label}으로 이동했습니다.`);
      onRefresh?.();
    });
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 bg-white rounded-lg p-3 border transition-opacity',
        getLeftBorderColor(isCompleted, plan.carryoverCount),
        isCompleted ? 'border-gray-200 bg-green-50/30' : 'border-gray-200',
        isPending && 'opacity-50 pointer-events-none'
      )}
    >
      {/* 체크박스 */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
          isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-green-400'
        )}
        aria-label={isCompleted ? '미완료로 변경' : '완료 처리'}
      >
        {isCompleted && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* 시간 표시 */}
      {showTime && plan.startTime && (
        <div className="flex flex-col items-center justify-center w-14 shrink-0 py-0.5 px-1.5 bg-blue-50 rounded-md border border-blue-100">
          <span className="text-sm font-semibold text-blue-700 tabular-nums">
            {plan.startTime.substring(0, 5)}
          </span>
          {plan.endTime && (
            <span className="text-[10px] text-blue-500 tabular-nums">
              ~{plan.endTime.substring(0, 5)}
            </span>
          )}
        </div>
      )}

      {/* 플랜 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isAdHoc && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0">
              단발성
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
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {plan.subject && <span>{plan.subject}</span>}
          {rangeDisplay && <span>{plan.subject ? '·' : ''} {rangeDisplay}</span>}
          {isAdHoc && plan.estimatedMinutes && <span>약 {plan.estimatedMinutes}분</span>}
        </div>
        {showCarryover && plan.carryoverCount && plan.carryoverCount > 0 && (
          <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
            {plan.carryoverCount}회 이월됨
          </div>
        )}
      </div>

      {/* 액션 */}
      {isCompleted ? (
        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded shrink-0">완료</span>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          {container !== 'daily' && (
            <button
              onClick={() => handleMove('daily')}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              title="오늘 플랜으로 이동"
            >
              →오늘
            </button>
          )}
          {container !== 'weekly' && container === 'daily' && (
            <button
              onClick={() => handleMove('weekly')}
              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
              title="주간 플랜으로 이동"
            >
              →주간
            </button>
          )}
        </div>
      )}
    </div>
  );
});
