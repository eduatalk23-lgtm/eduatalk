'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { ContainerPlan } from '@/lib/domains/today/actions/containerPlans';
import type { AdHocPlan } from '@/lib/domains/admin-plan/types';

interface ContainerPlanItemProps {
  plan?: ContainerPlan;
  adHocPlan?: AdHocPlan;
  containerType: 'unfinished' | 'daily' | 'weekly';
  onSelect?: () => void;
  onMoveToDaily?: () => void;
  onMoveToWeekly?: () => void;
}

export const ContainerPlanItem = memo(function ContainerPlanItem({
  plan,
  adHocPlan,
  containerType,
  onSelect,
  onMoveToDaily,
  onMoveToWeekly,
}: ContainerPlanItemProps) {
  const isAdHoc = !!adHocPlan;
  const item = plan ?? adHocPlan;

  if (!item) return null;

  // 공통 필드 추출
  const title = isAdHoc
    ? adHocPlan!.title
    : plan!.custom_title ?? plan!.content_title ?? '제목 없음';

  const status = isAdHoc ? adHocPlan!.status : plan!.status;
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';

  // 범위 표시
  const rangeDisplay = isAdHoc
    ? null
    : plan!.custom_range_display ??
      (plan!.planned_start_page_or_time && plan!.planned_end_page_or_time
        ? `p.${plan!.planned_start_page_or_time}-${plan!.planned_end_page_or_time}`
        : null);

  // 이월 정보
  const carryoverInfo =
    !isAdHoc && plan!.carryover_from_date
      ? `${formatRelativeDate(plan!.carryover_from_date)}부터 이월`
      : null;

  return (
    <div
      className={cn(
        'bg-white rounded-lg p-3 shadow-sm border',
        isCompleted && 'opacity-60',
        isInProgress && 'border-blue-400 ring-1 ring-blue-200',
        !isCompleted && !isInProgress && 'border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* 왼쪽: 상태 + 제목 */}
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* 상태 아이콘 */}
          <span className="mt-0.5">
            {isCompleted ? (
              <span className="text-green-500">✓</span>
            ) : isInProgress ? (
              <span className="text-blue-500 animate-pulse">●</span>
            ) : containerType === 'unfinished' ? (
              <span className="text-amber-500">⚠️</span>
            ) : (
              <span className="text-gray-400">○</span>
            )}
          </span>

          {/* 콘텐츠 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'font-medium truncate',
                  isCompleted && 'line-through text-gray-500'
                )}
              >
                {title}
              </span>
              {isAdHoc && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                  단발성
                </span>
              )}
              {!isAdHoc && plan?.subject_type === 'weakness' && (
                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                  취약
                </span>
              )}
              {!isAdHoc && plan?.subject_type === 'strategy' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  전략
                </span>
              )}
              {!isAdHoc && plan?.subject_type === 'review' && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                  복습
                </span>
              )}
            </div>

            {/* 범위 및 과목 */}
            <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
              {!isAdHoc && plan!.content_subject && (
                <span>{plan!.content_subject}</span>
              )}
              {rangeDisplay && (
                <>
                  {!isAdHoc && plan!.content_subject && <span>·</span>}
                  <span>{rangeDisplay}</span>
                </>
              )}
              {isAdHoc && adHocPlan!.estimated_minutes && (
                <span>약 {adHocPlan!.estimated_minutes}분</span>
              )}
            </div>

            {/* 이월 정보 */}
            {carryoverInfo && (
              <div className="text-xs text-amber-600 mt-1">{carryoverInfo}</div>
            )}
          </div>
        </div>

        {/* 오른쪽: 액션 버튼 */}
        <div className="flex items-center gap-1">
          {!isCompleted && (
            <>
              {/* 시작/선택 버튼 */}
              <button
                onClick={onSelect}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  isInProgress
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {isInProgress ? '이어하기' : '시작'}
              </button>

              {/* 이동 드롭다운 (간소화) */}
              {(onMoveToDaily || onMoveToWeekly) && (
                <div className="relative group">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                    {onMoveToDaily && (
                      <button
                        onClick={onMoveToDaily}
                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50"
                      >
                        오늘로 이동
                      </button>
                    )}
                    {onMoveToWeekly && (
                      <button
                        onClick={onMoveToWeekly}
                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50"
                      >
                        주간으로 이동
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {isCompleted && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              완료됨
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// 상대 날짜 포맷팅 헬퍼
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays === 2) return '그제';
  if (diffDays <= 7) return `${diffDays}일 전`;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
