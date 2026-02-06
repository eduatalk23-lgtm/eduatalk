'use client';

import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ContainerPlan } from '@/lib/domains/today/actions/containerPlans';
import type { AdHocPlan } from '@/lib/domains/admin-plan/types';
import type { ContainerType } from '@/lib/domains/plan/actions/move';
import { ContainerPlanItem } from './ContainerPlanItem';
import { ReorderableContainerList } from './ReorderableContainerList';
import { useContainerDragDropContext } from './ContainerDragDropContext';

interface ContainerDockProps {
  type: ContainerType;
  plans: ContainerPlan[];
  adHocPlans: AdHocPlan[];
  totalCount: number;
  completedCount?: number;
  onPlanSelect?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan', isInProgress?: boolean) => void;
  onMoveToDaily?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => void;
  onMoveToWeekly?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => void;
}

const containerConfig = {
  unfinished: {
    title: '미완료 플랜',
    description: '우선 처리가 필요해요',
    icon: '🔴',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    headerColor: 'text-red-700',
    dropActiveColor: 'border-red-400 bg-red-100',
    priority: 1,
  },
  daily: {
    title: '오늘 플랜',
    description: '오늘 진행할 플랜',
    icon: '📦',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    headerColor: 'text-blue-700',
    dropActiveColor: 'border-blue-400 bg-blue-100',
    priority: 2,
  },
  weekly: {
    title: '주간 플랜',
    description: '이번 주 내 자유롭게 진행',
    icon: '📅',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    headerColor: 'text-green-700',
    dropActiveColor: 'border-green-400 bg-green-100',
    priority: 3,
  },
};

export function ContainerDock({
  type,
  plans,
  adHocPlans,
  totalCount,
  completedCount = 0,
  onPlanSelect,
  onMoveToDaily,
  onMoveToWeekly,
}: ContainerDockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const config = containerConfig[type];

  const {
    getDropZoneProps,
    isDropTarget,
    canDropOnContainer,
    isDragging,
  } = useContainerDragDropContext();

  const dropZoneProps = getDropZoneProps(type);
  const isCurrentDropTarget = isDropTarget(type);
  const canDrop = canDropOnContainer(type);

  // 빈 컨테이너: 헤더 + 드롭존 표시
  if (totalCount === 0) {
    return (
      <div
        {...dropZoneProps}
        className={cn(
          'rounded-lg border-2 overflow-hidden transition-all duration-200',
          isCurrentDropTarget
            ? config.dropActiveColor
            : cn(config.bgColor, config.borderColor),
          isDragging && canDrop && 'border-dashed',
          'opacity-70'
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <span className={cn('font-medium', config.headerColor)}>
              {config.title}
            </span>
            <span className="text-xs text-gray-400">0건</span>
          </div>
        </div>
        {/* 드롭존 */}
        <div className="px-4 pb-4">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center text-sm transition-all',
              isCurrentDropTarget
                ? 'border-current bg-white/80 text-gray-700 scale-[1.02]'
                : 'border-gray-300 bg-white/50 text-gray-400'
            )}
          >
            {isCurrentDropTarget ? (
              <span className="font-medium">여기에 놓으세요</span>
            ) : isDragging && canDrop ? (
              <span>이곳에 드롭하세요</span>
            ) : (
              <span>플랜을 드래그하여 이동</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const progressText =
    type === 'daily' ? `${completedCount}/${totalCount}` : `${totalCount}건`;

  return (
    <div
      {...dropZoneProps}
      className={cn(
        'rounded-lg border-2 overflow-hidden transition-all duration-200',
        isCurrentDropTarget
          ? config.dropActiveColor
          : cn(config.bgColor, config.borderColor),
        isDragging && canDrop && 'border-dashed'
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:bg-white/50 transition-colors rounded-lg px-2 py-1 -ml-2"
        >
          <span className="text-lg">{config.icon}</span>
          <span className={cn('font-medium', config.headerColor)}>
            {config.title}
          </span>
          {type === 'unfinished' && totalCount > 0 && (
            <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              {config.description}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {/* 순서 재정렬 토글 버튼 */}
          {totalCount > 1 && isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsReorderMode(!isReorderMode);
              }}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isReorderMode
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              )}
              title={isReorderMode ? '순서 정렬 완료' : '순서 변경'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm text-gray-600">{progressText}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/50 rounded"
          >
            <svg
              className={cn(
                'w-5 h-5 text-gray-400 transition-transform',
                isExpanded && 'rotate-180'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2 relative">
          {/* 순서 변경 모드 안내 */}
          {isReorderMode && (
            <div className={cn(
              'text-xs px-3 py-2 rounded-lg mb-2',
              type === 'unfinished' ? 'text-red-600 bg-red-50' :
              type === 'daily' ? 'text-blue-600 bg-blue-50' :
              'text-green-600 bg-green-50'
            )}>
              플랜을 드래그하여 순서를 변경하세요
            </div>
          )}

          {/* 드롭 힌트 (드래그 중일 때만, 순서 변경 모드가 아닐 때) */}
          {isDragging && canDrop && !isReorderMode && (
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-3 text-center text-sm transition-all',
                isCurrentDropTarget
                  ? 'border-current bg-white/80 text-gray-700'
                  : 'border-gray-300 bg-white/30 text-gray-400'
              )}
            >
              {isCurrentDropTarget ? '여기에 놓으세요' : '이곳에 드롭'}
            </div>
          )}

          {/* 순서 재정렬 모드 */}
          {isReorderMode ? (
            <ReorderableContainerList
              containerType={type}
              plans={plans}
              adHocPlans={adHocPlans}
              onPlanSelect={onPlanSelect}
              onMoveToDaily={onMoveToDaily}
              onMoveToWeekly={onMoveToWeekly}
              enableReorder={true}
            />
          ) : (
            <>
              {/* 일반 플랜 */}
              {plans.map((plan) => (
                <ContainerPlanItem
                  key={plan.id}
                  plan={plan}
                  containerType={type}
                  onSelect={() => onPlanSelect?.(plan.id, 'student_plan', plan.status === 'in_progress')}
                  onMoveToDaily={
                    type !== 'daily'
                      ? () => onMoveToDaily?.(plan.id, 'student_plan')
                      : undefined
                  }
                  onMoveToWeekly={
                    type !== 'weekly'
                      ? () => onMoveToWeekly?.(plan.id, 'student_plan')
                      : undefined
                  }
                />
              ))}

              {/* Ad-hoc 플랜 */}
              {adHocPlans.map((adHoc) => (
                <ContainerPlanItem
                  key={adHoc.id}
                  adHocPlan={adHoc}
                  containerType={type}
                  onSelect={() => onPlanSelect?.(adHoc.id, 'ad_hoc_plan', adHoc.status === 'in_progress')}
                  onMoveToDaily={
                    type !== 'daily'
                      ? () => onMoveToDaily?.(adHoc.id, 'ad_hoc_plan')
                      : undefined
                  }
                  onMoveToWeekly={
                    type !== 'weekly'
                      ? () => onMoveToWeekly?.(adHoc.id, 'ad_hoc_plan')
                      : undefined
                  }
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
