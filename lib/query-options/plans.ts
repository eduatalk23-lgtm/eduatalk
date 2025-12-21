import { queryOptions } from "@tanstack/react-query";
import { getPlansForStudent } from "@/lib/data/studentPlans";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { Plan } from "@/lib/types/plan";

/**
 * 플랜 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 */
export function plansQueryOptions(
  studentId: string,
  tenantId: string | null,
  planDate: string
) {
  return queryOptions({
    queryKey: ["plans", studentId, planDate] as const,
    queryFn: async (): Promise<Plan[]> => {
      const plans = await getPlansForStudent({
        studentId,
        tenantId,
        planDate,
      });
      // plan_group_id를 string | null로 변환 (undefined 제거)
      return plans.map((plan) => ({
        ...plan,
        plan_group_id: plan.plan_group_id ?? null,
      })) as Plan[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

