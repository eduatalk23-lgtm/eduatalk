'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { ContainerPlan } from '@/lib/domains/today/actions/containerPlans';
import type { AdHocPlan } from '@/lib/domains/admin-plan/types';
import { ContainerPlanItem } from './ContainerPlanItem';

interface ContainerDockProps {
  type: 'unfinished' | 'daily' | 'weekly';
  plans: ContainerPlan[];
  adHocPlans: AdHocPlan[];
  totalCount: number;
  completedCount?: number;
  onPlanSelect?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => void;
  onMoveToDaily?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => void;
  onMoveToWeekly?: (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => void;
}

const containerConfig = {
  unfinished: {
    title: '미완료',
    description: '먼저 해결하세요',
    icon: '🔴',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    headerColor: 'text-red-700',
    priority: 1,
  },
  daily: {
    title: '오늘 할 일',
    description: '오늘의 학습 플랜',
    icon: '📦',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    headerColor: 'text-blue-700',
    priority: 2,
  },
  weekly: {
    title: '이번 주 유동',
    description: '이번 주 내 자유롭게 소화',
    icon: '📅',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    headerColor: 'text-green-700',
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
  const config = containerConfig[type];

  // 빈 컨테이너 처리
  if (totalCount === 0) {
    return null;
  }

  const progressText =
    type === 'daily' ? `${completedCount}/${totalCount}` : `${totalCount}건`;

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        config.bgColor,
        config.borderColor
      )}
    >
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'hover:bg-white/50 transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className={cn('font-medium', config.headerColor)}>
            {config.title}
          </span>
          {type === 'unfinished' && totalCount > 0 && (
            <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              {config.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{progressText}</span>
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
        </div>
      </button>

      {/* 컨텐츠 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* 일반 플랜 */}
          {plans.map((plan) => (
            <ContainerPlanItem
              key={plan.id}
              plan={plan}
              containerType={type}
              onSelect={() => onPlanSelect?.(plan.id, 'student_plan')}
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
              onSelect={() => onPlanSelect?.(adHoc.id, 'ad_hoc_plan')}
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
        </div>
      )}
    </div>
  );
}
