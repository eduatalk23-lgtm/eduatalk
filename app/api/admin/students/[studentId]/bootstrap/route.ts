import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { apiSuccess, handleApiError } from "@/lib/api";
import { runBootstrapPipeline } from "@/lib/domains/student-record/actions/pipeline-orchestrator-init";

/**
 * Auto-Bootstrap 수동 큐잉 (ops 전용).
 *
 * POST /api/admin/students/[studentId]/bootstrap
 *
 * pipelineType="bootstrap" row 를 INSERT 하고 BT0/BT1/BT2 태스크를 pending 으로 큐잉한다.
 * 실제 phase 실행은 클라이언트가 `/api/admin/pipeline/bootstrap/phase-1` 로 주도.
 * `runFullOrchestration` 진입 시 자동 큐잉되므로 일반 경로에서는 호출 불필요 — seed/ops 스크립트용.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireAdminOrConsultant({ requireTenant: true });
    const { studentId } = await context.params;
    const tenantId = auth.tenantId!;

    const result = await runBootstrapPipeline(studentId, tenantId);
    if (!result.success || !result.data) {
      return Response.json(
        { ok: false, error: result.success ? "pipelineId 누락" : result.error },
        { status: 400 },
      );
    }
    return apiSuccess({ pipelineId: result.data.pipelineId });
  } catch (err) {
    return handleApiError(err);
  }
}
