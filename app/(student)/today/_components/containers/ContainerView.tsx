'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ContainerDock } from './ContainerDock';
import { moveToDaily, moveToWeekly } from '@/lib/domains/today/actions/containerPlans';
import type { ContainerSummary } from '@/lib/domains/today/actions/containerPlans';

interface ContainerViewProps {
  data: ContainerSummary;
  date: string;
}

export function ContainerView({ data, date }: ContainerViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePlanSelect = (
    planId: string,
    planType: 'student_plan' | 'ad_hoc_plan'
  ) => {
    // 플랜 상세/타이머 페이지로 이동
    if (planType === 'student_plan') {
      router.push(`/today/plan/${planId}`);
    } else {
      // ad_hoc_plan의 경우 별도 처리 또는 같은 페이지 사용
      router.push(`/today/plan/${planId}?type=adhoc`);
    }
  };

  const handleMoveToDaily = async (
    planId: string,
    planType: 'student_plan' | 'ad_hoc_plan'
  ) => {
    startTransition(async () => {
      const result = await moveToDaily(planId, planType === 'ad_hoc_plan' ? 'ad_hoc_plan' : 'student_plan');
      if (result.success) {
        router.refresh();
      }
    });
  };

  const handleMoveToWeekly = async (
    planId: string,
    planType: 'student_plan' | 'ad_hoc_plan'
  ) => {
    startTransition(async () => {
      const result = await moveToWeekly(planId, planType === 'ad_hoc_plan' ? 'ad_hoc_plan' : 'student_plan');
      if (result.success) {
        router.refresh();
      }
    });
  };

  const hasAnyPlans =
    data.unfinished.totalCount > 0 ||
    data.daily.totalCount > 0 ||
    data.weekly.totalCount > 0;

  if (!hasAnyPlans) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-4">📚</div>
        <p className="text-lg font-medium">오늘의 학습 플랜이 없습니다</p>
        <p className="text-sm mt-1">관리자에게 플랜 생성을 요청하세요</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* 미완료 Dock - 우선순위 1 */}
      <ContainerDock
        type="unfinished"
        plans={data.unfinished.plans}
        adHocPlans={data.unfinished.adHocPlans}
        totalCount={data.unfinished.totalCount}
        onPlanSelect={handlePlanSelect}
        onMoveToDaily={handleMoveToDaily}
        onMoveToWeekly={handleMoveToWeekly}
      />

      {/* 오늘 할 일 Dock - 우선순위 2 */}
      <ContainerDock
        type="daily"
        plans={data.daily.plans}
        adHocPlans={data.daily.adHocPlans}
        totalCount={data.daily.totalCount}
        completedCount={data.daily.completedCount}
        onPlanSelect={handlePlanSelect}
        onMoveToWeekly={handleMoveToWeekly}
      />

      {/* 주간 유동 Dock - 우선순위 3 */}
      <ContainerDock
        type="weekly"
        plans={data.weekly.plans}
        adHocPlans={data.weekly.adHocPlans}
        totalCount={data.weekly.totalCount}
        onPlanSelect={handlePlanSelect}
        onMoveToDaily={handleMoveToDaily}
      />

      {/* 날짜 표시 */}
      <div className="text-center text-sm text-gray-400 pt-2">
        {formatDateDisplay(date)}
      </div>
    </div>
  );
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${month}월 ${day}일 (${dayOfWeek})`;
}
