'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ContainerDock } from './ContainerDock';
import { ContainerDragDropProvider } from './ContainerDragDropContext';
import { startPlan } from '@/lib/domains/today/actions/timer';
import type { ContainerSummary } from '@/lib/domains/today/actions/containerPlans';
import type { ContainerType } from '@/lib/domains/admin-plan/types';
import { useToast } from '@/components/ui/ToastProvider';
import { usePlanTimerStore } from '@/lib/store/planTimerStore';
import { useContainerMoveActions } from '@/lib/hooks/useContainerMoveActions';

interface ContainerViewProps {
  data: ContainerSummary;
  date: string;
}

export function ContainerView({ data, date }: ContainerViewProps) {
  const router = useRouter();
  const timerStore = usePlanTimerStore();
  const [isStarting, startTransition] = useTransition();
  const { showToast } = useToast();

  // 컨테이너 이동을 위한 optimistic hook 사용
  const { optimisticData, handleMoveToDaily, handleMoveToWeekly } =
    useContainerMoveActions(data);

  const handlePlanSelect = async (
    planId: string,
    planType: 'student_plan' | 'ad_hoc_plan',
    isInProgress?: boolean
  ) => {
    // 이미 진행 중인 플랜이면 완료 페이지로 이동
    if (isInProgress) {
      if (planType === 'student_plan') {
        router.push(`/today/plan/${planId}`);
      } else {
        router.push(`/today/plan/${planId}?type=adhoc`);
      }
      return;
    }

    // Optimistic Update: 즉시 Zustand 상태 업데이트
    const timestamp = new Date().toISOString();
    timerStore.startTimer(planId, Date.now(), timestamp);

    // 새로 시작하는 경우: startPlan 호출 후 서버 데이터와 동기화
    startTransition(async () => {
      const result = await startPlan(planId, timestamp);
      if (result.success) {
        // 서버 시간으로 동기화
        if (result.serverNow) {
          timerStore.syncNow(planId, result.serverNow);
        }
        showToast('학습을 시작합니다', 'success');
        router.refresh();
      } else {
        // 실패 시 롤백
        timerStore.removeTimer(planId);
        // 이미 다른 플랜이 진행 중인 경우 해당 페이지로 이동 옵션 제공
        if (result.error?.includes('이미 진행 중인 플랜')) {
          showToast('이미 진행 중인 플랜이 있습니다. 현재 학습을 완료하거나 일시정지 후 시작하세요.', 'error');
        } else {
          showToast(result.error ?? '학습 시작에 실패했습니다', 'error');
        }
      }
    });
  };

  // 소스 컨테이너를 전달하는 래퍼 함수 생성
  const createMoveToDaily = (sourceContainer: ContainerType) =>
    (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => {
      handleMoveToDaily(planId, planType, sourceContainer);
    };

  const createMoveToWeekly = (sourceContainer: ContainerType) =>
    (planId: string, planType: 'student_plan' | 'ad_hoc_plan') => {
      handleMoveToWeekly(planId, planType, sourceContainer);
    };

  // 모든 컨테이너가 비어있어도 항상 드롭존이 있는 컨테이너를 표시
  // 블로킹 오버레이 제거 - optimistic update가 즉각적인 피드백 제공
  return (
    <ContainerDragDropProvider>
      <div className="space-y-4">
        {/* 미완료 Dock - 우선순위 1 */}
        <ContainerDock
          type="unfinished"
          plans={optimisticData.unfinished.plans}
          adHocPlans={optimisticData.unfinished.adHocPlans}
          totalCount={optimisticData.unfinished.totalCount}
          onPlanSelect={handlePlanSelect}
          onMoveToDaily={createMoveToDaily('unfinished')}
          onMoveToWeekly={createMoveToWeekly('unfinished')}
        />

        {/* 오늘 할 일 Dock - 우선순위 2 */}
        <ContainerDock
          type="daily"
          plans={optimisticData.daily.plans}
          adHocPlans={optimisticData.daily.adHocPlans}
          totalCount={optimisticData.daily.totalCount}
          completedCount={optimisticData.daily.completedCount}
          onPlanSelect={handlePlanSelect}
          onMoveToWeekly={createMoveToWeekly('daily')}
        />

        {/* 주간 유동 Dock - 우선순위 3 */}
        <ContainerDock
          type="weekly"
          plans={optimisticData.weekly.plans}
          adHocPlans={optimisticData.weekly.adHocPlans}
          totalCount={optimisticData.weekly.totalCount}
          onPlanSelect={handlePlanSelect}
          onMoveToDaily={createMoveToDaily('weekly')}
        />

        {/* 날짜 표시 */}
        <div className="text-center text-sm text-gray-400 pt-2">
          {formatDateDisplay(date)}
        </div>
      </div>
    </ContainerDragDropProvider>
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
