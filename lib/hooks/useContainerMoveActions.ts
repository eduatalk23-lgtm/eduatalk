'use client';

import { useOptimistic, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { moveToDaily, moveToWeekly } from '@/lib/domains/today/actions/containerPlans';
import type { ContainerSummary, ContainerPlan } from '@/lib/domains/today/actions/containerPlans';
import type { AdHocPlan, ContainerType } from '@/lib/domains/admin-plan/types';

type MoveAction = {
  type: 'moveToDaily' | 'moveToWeekly';
  planId: string;
  planType: 'student_plan' | 'ad_hoc_plan';
  sourceContainer: ContainerType;
};

/**
 * 컨테이너 이동 액션을 위한 커스텀 훅
 * - useOptimistic을 사용하여 즉각적인 UI 피드백 제공
 * - 성공/실패 시 토스트 알림 표시
 * - router.refresh()로 서버 데이터와 동기화
 */
export function useContainerMoveActions(initialData: ContainerSummary) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Optimistic state management
  const [optimisticData, addOptimisticUpdate] = useOptimistic(
    initialData,
    (currentData: ContainerSummary, action: MoveAction): ContainerSummary => {
      const { type, planId, planType, sourceContainer } = action;
      const targetContainer: ContainerType = type === 'moveToDaily' ? 'daily' : 'weekly';

      // 같은 컨테이너로 이동하는 경우 무시
      if (sourceContainer === targetContainer) {
        return currentData;
      }

      // Deep clone the current data
      const newData: ContainerSummary = {
        unfinished: {
          plans: [...currentData.unfinished.plans],
          adHocPlans: [...currentData.unfinished.adHocPlans],
          totalCount: currentData.unfinished.totalCount,
        },
        daily: {
          plans: [...currentData.daily.plans],
          adHocPlans: [...currentData.daily.adHocPlans],
          totalCount: currentData.daily.totalCount,
          completedCount: currentData.daily.completedCount,
        },
        weekly: {
          plans: [...currentData.weekly.plans],
          adHocPlans: [...currentData.weekly.adHocPlans],
          totalCount: currentData.weekly.totalCount,
        },
      };

      // Find and remove from source container
      let movedPlan: ContainerPlan | undefined;
      let movedAdHocPlan: AdHocPlan | undefined;

      const sourceContainerData = newData[sourceContainer];
      if (planType === 'student_plan') {
        const planIndex = sourceContainerData.plans.findIndex((p) => p.id === planId);
        if (planIndex !== -1) {
          [movedPlan] = sourceContainerData.plans.splice(planIndex, 1);
          // Update container_type on the moved plan
          movedPlan = { ...movedPlan, container_type: targetContainer };
        }
      } else {
        const planIndex = sourceContainerData.adHocPlans.findIndex((p) => p.id === planId);
        if (planIndex !== -1) {
          [movedAdHocPlan] = sourceContainerData.adHocPlans.splice(planIndex, 1);
          // Update container_type on the moved plan
          movedAdHocPlan = { ...movedAdHocPlan, container_type: targetContainer };
        }
      }

      // Add to target container
      const targetContainerData = newData[targetContainer];
      if (movedPlan) {
        targetContainerData.plans.push(movedPlan);
      }
      if (movedAdHocPlan) {
        targetContainerData.adHocPlans.push(movedAdHocPlan);
      }

      // Recalculate counts
      newData.unfinished.totalCount =
        newData.unfinished.plans.length + newData.unfinished.adHocPlans.length;
      newData.daily.totalCount =
        newData.daily.plans.length + newData.daily.adHocPlans.length;
      newData.weekly.totalCount =
        newData.weekly.plans.length + newData.weekly.adHocPlans.length;

      return newData;
    }
  );

  const handleMoveToDaily = useCallback(
    (planId: string, planType: 'student_plan' | 'ad_hoc_plan', sourceContainer: ContainerType) => {
      // Immediate optimistic update
      addOptimisticUpdate({
        type: 'moveToDaily',
        planId,
        planType,
        sourceContainer,
      });

      startTransition(async () => {
        try {
          const result = await moveToDaily(planId, planType);
          if (result.success) {
            showToast('오늘 할 일로 이동했습니다', 'success');
          } else {
            showToast(result.error ?? '이동에 실패했습니다', 'error');
          }
        } catch {
          showToast('오류가 발생했습니다', 'error');
        }
        // 항상 서버 데이터와 동기화 (성공/실패 모두)
        router.refresh();
      });
    },
    [addOptimisticUpdate, showToast, router]
  );

  const handleMoveToWeekly = useCallback(
    (planId: string, planType: 'student_plan' | 'ad_hoc_plan', sourceContainer: ContainerType) => {
      // Immediate optimistic update
      addOptimisticUpdate({
        type: 'moveToWeekly',
        planId,
        planType,
        sourceContainer,
      });

      startTransition(async () => {
        try {
          const result = await moveToWeekly(planId, planType);
          if (result.success) {
            showToast('주간 유동으로 이동했습니다', 'success');
          } else {
            showToast(result.error ?? '이동에 실패했습니다', 'error');
          }
        } catch {
          showToast('오류가 발생했습니다', 'error');
        }
        // 항상 서버 데이터와 동기화 (성공/실패 모두)
        router.refresh();
      });
    },
    [addOptimisticUpdate, showToast, router]
  );

  return {
    optimisticData,
    isPending,
    handleMoveToDaily,
    handleMoveToWeekly,
  };
}
