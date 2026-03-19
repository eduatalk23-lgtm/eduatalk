import { queryOptions } from "@tanstack/react-query";
import { runAllocationSimulation } from "@/lib/domains/admission/allocation/actions";
import type { AllocationCandidate, AllocationConfig } from "@/lib/domains/admission/allocation/types";

// ============================================
// Allocation Simulation Query Options
// Phase 8.5b — 수동 실행 (enabled: false)
// ============================================

export const allocationKeys = {
  all: ["allocation"] as const,
  simulation: (studentId: string) =>
    [...allocationKeys.all, "simulation", studentId] as const,
};

/**
 * 배분 시뮬레이션 쿼리 옵션.
 * enabled: false → 수동 실행 (refetch로 트리거).
 */
export function allocationSimulationQueryOptions(
  studentId: string,
  candidates: AllocationCandidate[],
  config?: Partial<AllocationConfig>,
) {
  return queryOptions({
    queryKey: allocationKeys.simulation(studentId),
    queryFn: async () => {
      if (candidates.length === 0) throw new Error("후보를 추가해주세요");
      const result = await runAllocationSimulation(candidates, config);
      if (!result.success) throw new Error("error" in result ? result.error : "시뮬레이션 실패");
      return result.data!;
    },
    staleTime: 0, // 항상 새 계산
    gcTime: 5 * 60_000,
    enabled: false, // 수동 실행
  });
}
