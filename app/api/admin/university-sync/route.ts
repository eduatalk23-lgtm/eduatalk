import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/api";
import { syncUniversities } from "@/lib/domains/school/sync";
import { testConnection } from "@/lib/services/dataGoKrApi";

/**
 * 대학 DB 동기화 (data.go.kr API)
 *
 * POST /api/admin/university-sync
 * - body: { svyYr?: string, dryRun?: boolean }
 *
 * GET /api/admin/university-sync
 * - API 연결 상태 확인
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrConsultant();
    if (!user) return apiUnauthorized();

    const body = (await request.json().catch(() => ({}))) as {
      svyYr?: string;
      dryRun?: boolean;
    };

    const result = await syncUniversities({
      svyYr: body.svyYr,
      dryRun: body.dryRun,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const user = await requireAdminOrConsultant();
    if (!user) return apiUnauthorized();

    const status = await testConnection();
    return apiSuccess(status);
  } catch (error) {
    return handleApiError(error);
  }
}
