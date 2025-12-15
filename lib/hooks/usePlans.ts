"use client";

import { useQuery } from "@tanstack/react-query";
import { getPlansForStudent } from "@/lib/data/studentPlans";
import { CACHE_STALE_TIME_DYNAMIC } from "@/lib/constants/queryCache";

type UsePlansOptions = {
  studentId: string;
  tenantId: string | null;
  planDate: string;
  enabled?: boolean;
};

export function usePlans({
  studentId,
  tenantId,
  planDate,
  enabled = true,
}: UsePlansOptions) {
  return useQuery({
    queryKey: ["plans", studentId, planDate],
    queryFn: async () => {
      return await getPlansForStudent({
        studentId,
        tenantId,
        planDate,
      });
    },
    enabled,
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
  });
}

