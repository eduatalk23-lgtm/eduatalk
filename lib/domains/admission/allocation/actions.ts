"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type { AllocationCandidate, AllocationConfig, AllocationRecommendation } from "./types";
import { DEFAULT_ALLOCATION_CONFIG } from "./types";
import { simulateAllocation } from "./engine";

const LOG_CTX = { domain: "admission", action: "" };

/**
 * 수시 6장 최적 배분 시뮬레이션 Server Action.
 * 순수 계산 — DB 조회 없음.
 */
export async function runAllocationSimulation(
  candidates: AllocationCandidate[],
  config?: Partial<AllocationConfig>,
  topN?: number,
): Promise<ActionResponse<AllocationRecommendation[]>> {
  try {
    await requireAdminOrConsultant();

    const recommendations = simulateAllocation(
      candidates,
      config ? { ...DEFAULT_ALLOCATION_CONFIG, ...config } : undefined,
      topN,
    );

    return createSuccessResponse(recommendations);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runAllocationSimulation" }, error);
    return createErrorResponse("배분 시뮬레이션 중 오류가 발생했습니다.");
  }
}
