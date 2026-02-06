'use client';

import { useMemo } from 'react';
import { CollapsedDockCard } from '@/components/planner/CollapsedDockCard';
import { useDailyDockQuery, useNonStudyTimeQuery } from '@/lib/hooks/useAdminDockQueries';
import { toPlanItemData } from '@/lib/types/planItem';
import { useStudentPlan } from './context/StudentPlanContext';
import { StudentPlanCard } from './StudentPlanCard';
import { NonStudyTimeCard } from './NonStudyTimeCard';

interface StudentDailyDockProps {
  isCollapsed?: boolean;
  onExpand: () => void;
}

export function StudentDailyDock({ isCollapsed = false, onExpand }: StudentDailyDockProps) {
  const { studentId, selectedDate, selectedPlannerId, initialDockData, initialDate } = useStudentPlan();

  // initialDockData는 initialDate에 대한 데이터이므로, selectedDate가 변경되면 무시
  const useInitialData = selectedDate === initialDate;

  const { plans, adHocPlans, isLoading, refetch } = useDailyDockQuery(
    studentId,
    selectedDate,
    selectedPlannerId,
    useInitialData && initialDockData ? { plans: initialDockData.dailyPlans, adHocPlans: initialDockData.dailyAdHocPlans } : undefined
  );

  const { nonStudyItems } = useNonStudyTimeQuery(
    studentId,
    selectedDate,
    plans,
    !isLoading,
    selectedPlannerId,
    useInitialData ? initialDockData?.nonStudyItems : undefined
  );

  // PlanItemData로 변환
  const planItems = useMemo(() => {
    const items = [
      ...plans.map(p => toPlanItemData(p, 'plan')),
      ...adHocPlans.map(p => toPlanItemData(p, 'adhoc')),
    ];
    // 시간순 정렬 (startTime 기준)
    items.sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
    return items;
  }, [plans, adHocPlans]);

  // 비학습시간을 시간순으로 머지
  const mergedItems = useMemo(() => {
    type MergedItem =
      | { kind: 'plan'; data: ReturnType<typeof toPlanItemData> }
      | { kind: 'nonStudy'; data: (typeof nonStudyItems)[number] };

    const all: MergedItem[] = [
      ...planItems.map(p => ({ kind: 'plan' as const, data: p })),
      ...nonStudyItems.map(n => ({ kind: 'nonStudy' as const, data: n })),
    ];

    all.sort((a, b) => {
      const aTime = a.kind === 'plan' ? a.data.startTime : a.data.start_time;
      const bTime = b.kind === 'plan' ? b.data.startTime : b.data.start_time;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime.localeCompare(bTime);
    });

    return all;
  }, [planItems, nonStudyItems]);

  const { completedCount, totalCount } = useMemo(() => ({
    completedCount: planItems.filter(p => p.isCompleted).length,
    totalCount: planItems.length,
  }), [planItems]);

  if (isCollapsed) {
    return (
      <CollapsedDockCard
        type="daily"
        icon="📅"
        title="오늘"
        count={totalCount}
        completedCount={completedCount}
        onClick={onExpand}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border-2 border-blue-200 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h3 className="font-semibold text-blue-700">오늘의 플랜</h3>
          <span className="text-sm text-blue-500">
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
        ) : mergedItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            오늘 배정된 플랜이 없습니다.
          </div>
        ) : (
          mergedItems.map((item, idx) =>
            item.kind === 'plan' ? (
              <StudentPlanCard
                key={item.data.id}
                plan={item.data}
                container="daily"
                showTime
                onRefresh={refetch}
              />
            ) : (
              <NonStudyTimeCard
                key={`ns-${idx}-${item.data.start_time}`}
                item={item.data}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
