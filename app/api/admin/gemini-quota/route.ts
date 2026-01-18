import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import {
  getGeminiQuotaStatus,
  resetGeminiQuotaTracker,
} from "@/lib/domains/plan/llm/providers/gemini";

/**
 * Gemini API 할당량 상태 조회 (관리자용)
 *
 * GET /api/admin/gemini-quota
 *
 * @returns
 * 성공: { success: true, data: GeminiQuotaStatus }
 *
 * @example
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "dailyQuota": 20,
 *     "used": 15,
 *     "remaining": 5,
 *     "usagePercent": 75,
 *     "isNearLimit": false,
 *     "isExceeded": false,
 *     "rateLimitHits": 2,
 *     "lastRateLimitTime": 1705569600000,
 *     "resetDate": "2026-01-18"
 *   }
 * }
 */
export async function GET() {
  try {
    // 관리자/컨설턴트 권한 체크
    const authResult = await requireAdminOrConsultant();
    if (!authResult) {
      return apiUnauthorized("관리자 또는 컨설턴트 권한이 필요합니다.");
    }

    const quotaStatus = getGeminiQuotaStatus();

    return apiSuccess({
      ...quotaStatus,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Gemini API 할당량 트래커 리셋 (관리자용, 테스트 목적)
 *
 * POST /api/admin/gemini-quota
 *
 * @returns
 * 성공: { success: true, data: { reset: true, message: "..." } }
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자/컨설턴트 권한 체크
    const authResult = await requireAdminOrConsultant();
    if (!authResult) {
      return apiUnauthorized("관리자 또는 컨설턴트 권한이 필요합니다.");
    }

    // Body 파싱 (선택적)
    let body: { action?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body가 없어도 OK
    }

    if (body.action === "reset") {
      resetGeminiQuotaTracker();
      return apiSuccess({
        reset: true,
        message: "Gemini API 할당량 트래커가 리셋되었습니다.",
        newStatus: getGeminiQuotaStatus(),
      });
    }

    return apiSuccess({
      error: "유효하지 않은 action입니다. 'reset'을 사용하세요.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
