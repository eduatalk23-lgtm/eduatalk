"use client";

import { useQuery } from "@tanstack/react-query";
import { getPlansForStudent } from "@/lib/data/studentPlans";

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
    staleTime: 1000 * 30, // 30초
  });
}

