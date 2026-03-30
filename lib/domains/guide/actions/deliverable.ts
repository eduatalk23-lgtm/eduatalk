"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOG_CTX = { domain: "guide", action: "deliverable" };

/** 배정별 결과물 파일 수 배치 조회 (레이어 뷰 요약용) */
export async function getAssignmentFileCountsAction(
  assignmentIds: string[],
): Promise<ActionResponse<Record<string, number>>> {
  try {
    await requireAdminOrConsultant();
    if (assignmentIds.length === 0) return createSuccessResponse({});

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("file_contexts")
      .select("context_id")
      .eq("context_type", "guide")
      .in("context_id", assignmentIds);

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.context_id] = (counts[row.context_id] ?? 0) + 1;
    }
    return createSuccessResponse(counts);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getAssignmentFileCounts" }, error);
    return createErrorResponse("파일 수 조회 실패");
  }
}
