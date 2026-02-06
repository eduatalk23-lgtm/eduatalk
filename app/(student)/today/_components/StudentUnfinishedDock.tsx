'use client';

import { useMemo } from 'react';
import { CollapsedDockCard } from '@/components/planner/CollapsedDockCard';
import { useUnfinishedDockQuery } from '@/lib/hooks/useAdminDockQueries';
import { toPlanItemData } from '@/lib/types/planItem';
import { useStudentPlan } from './context/StudentPlanContext';
import { StudentPlanCard } from './StudentPlanCard';

interface StudentUnfinishedDockProps {
  isCollapsed?: boolean;
  onExpand: () => void;
}

export function StudentUnfinishedDock({ isCollapsed = false, onExpand }: StudentUnfinishedDockProps) {
  const { studentId, selectedPlannerId, initialDockData } = useStudentPlan();

  const { plans, isLoading, refetch } = useUnfinishedDockQuery(
    studentId,
    selectedPlannerId,
    initialDockData?.unfinishedPlans
  );

  const planItems = useMemo(() => {
    return plans.map(p => toPlanItemData(p, 'plan'));
  }, [plans]);

  const { completedCount, totalCount } = useMemo(() => ({
    completedCount: planItems.filter(p => p.isCompleted).length,
    totalCount: planItems.length,
  }), [planItems]);

  if (isCollapsed) {
    return (
      <CollapsedDockCard
        type="unfinished"
        icon="⏳"
        title="미완료"
        count={totalCount}
        completedCount={completedCount}
        onClick={onExpand}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border-2 border-red-200 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-b border-red-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">⏳</span>
          <h3 className="font-semibold text-red-700">미완료 플랜</h3>
          <span className="text-sm text-red-500">{totalCount}</span>
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
            미완료 플랜이 없습니다.
          </div>
        ) : (
          planItems.map(item => (
            <StudentPlanCard
              key={item.id}
              plan={item}
              container="unfinished"
              showCarryover
              onRefresh={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
}
