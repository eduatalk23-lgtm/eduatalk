'use client';

import { memo, useMemo } from 'react';
import { useDailyDockQuery } from '@/lib/hooks/useAdminDockQueries';
import { toPlanItemData } from '@/lib/types/planItem';
import { useStudentPlan } from './context/StudentPlanContext';

export const DailySummaryBar = memo(function DailySummaryBar() {
  const { studentId, selectedDate, selectedPlannerId, initialDockData } = useStudentPlan();

  const { plans, adHocPlans } = useDailyDockQuery(
    studentId,
    selectedDate,
    selectedPlannerId,
    initialDockData ? { plans: initialDockData.dailyPlans, adHocPlans: initialDockData.dailyAdHocPlans } : undefined
  );

  const { completedCount, totalCount } = useMemo(() => {
    const items = [
      ...plans.map(p => toPlanItemData(p, 'plan')),
      ...adHocPlans.map(p => toPlanItemData(p, 'adhoc')),
    ];
    return {
      completedCount: items.filter(p => p.isCompleted).length,
      totalCount: items.length,
    };
  }, [plans, adHocPlans]);

  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">오늘 진행률</span>
        <span className="text-sm text-gray-500">
          {completedCount}/{totalCount} 완료 ({percent}%)
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
});
