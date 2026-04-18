import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { apiSuccess, handleApiError } from "@/lib/api";
import { ensureBootstrap, BootstrapError } from "@/lib/domains/record-analysis/pipeline/bootstrap";

/**
 * Phase 1 Auto-Bootstrap 수동 실행.
 *
 * POST /api/admin/students/[studentId]/bootstrap
 *
 * 내부 동작: target_major 검증 + main_exploration/course_plan 자동 생성(없을 때만).
 * `runFullOrchestration` 이 진입 시 자동 호출하므로 일반 경로에서는 호출 불필요.
 * seed/ops/테스트 스크립트용.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireAdminOrConsultant({ requireTenant: true });
    const { studentId } = await context.params;
    const tenantId = auth.tenantId!;

    const result = await ensureBootstrap(studentId, tenantId);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof BootstrapError) {
      return Response.json(
        { ok: false, error: err.message, step: err.step },
        { status: 400 },
      );
    }
    return handleApiError(err);
  }
}
