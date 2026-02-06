'use client';

import { useMemo } from 'react';
import { CollapsedDockCard } from '@/components/planner/CollapsedDockCard';
import { useWeeklyDockQuery } from '@/lib/hooks/useAdminDockQueries';
import { toPlanItemData } from '@/lib/types/planItem';
import { useStudentPlan } from './context/StudentPlanContext';
import { StudentPlanCard } from './StudentPlanCard';

interface StudentWeeklyDockProps {
  isCollapsed?: boolean;
  onExpand: () => void;
}

export function StudentWeeklyDock({ isCollapsed = false, onExpand }: StudentWeeklyDockProps) {
  const { studentId, selectedDate, selectedPlannerId, initialDockData, initialDate } = useStudentPlan();

  // initialDockData는 initialDate 기준의 주간 데이터, 날짜 변경 시 무시
  const useInitialData = selectedDate === initialDate;

  const { plans, adHocPlans, isLoading, refetch } = useWeeklyDockQuery(
    studentId,
    selectedDate,
    selectedPlannerId,
    useInitialData && initialDockData ? { plans: initialDockData.weeklyPlans, adHocPlans: initialDockData.weeklyAdHocPlans } : undefined
  );

  const planItems = useMemo(() => {
    return [
      ...plans.map(p => toPlanItemData(p, 'plan')),
      ...adHocPlans.map(p => toPlanItemData(p, 'adhoc')),
    ];
  }, [plans, adHocPlans]);

  const { completedCount, totalCount } = useMemo(() => ({
    completedCount: planItems.filter(p => p.isCompleted).length,
    totalCount: planItems.length,
  }), [planItems]);

  if (isCollapsed) {
    return (
      <CollapsedDockCard
        type="weekly"
        icon="📋"
        title="주간"
        count={totalCount}
        completedCount={completedCount}
        onClick={onExpand}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border-2 border-green-200 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-green-700">주간 플랜</h3>
          <span className="text-sm text-green-500">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : planItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            주간 배정된 플랜이 없습니다.
          </div>
        ) : (
          planItems.map(item => (
            <StudentPlanCard
              key={item.id}
              plan={item}
              container="weekly"
              onRefresh={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
}
