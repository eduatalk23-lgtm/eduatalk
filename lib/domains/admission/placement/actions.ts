"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type { SuneungScores } from "../calculator/types";
import type { PlacementAnalysisResult } from "./types";
import { analyzePlacement } from "./service";

const LOG_CTX = { domain: "admission", action: "" };

/**
 * 배치 분석 실행 Server Action.
 */
export async function fetchPlacementAnalysis(
  studentId: string,
  suneungScores: SuneungScores,
  dataYear?: number,
): Promise<ActionResponse<PlacementAnalysisResult>> {
  try {
    await requireAdminOrConsultant();

    // SuneungScores의 inquiry는 Record<string, number>로 직렬화되므로 복원 필요 없음
    const result = await analyzePlacement(studentId, suneungScores, dataYear);

    return createSuccessResponse(result);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPlacementAnalysis" }, error);
    return createErrorResponse("배치 분석 중 오류가 발생했습니다.");
  }
}
