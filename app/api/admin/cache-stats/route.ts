import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getWebSearchContentService } from "@/lib/domains/plan/llm/services";

/**
 * 캐시 통계 조회 API (관리자용)
 *
 * GET /api/admin/cache-stats
 *
 * Query Parameters:
 * - action: "stats" | "clear" (기본: "stats")
 *   - stats: 캐시 통계 조회
 *   - clear: 캐시 초기화 (POST 권장하지만 편의상 GET으로도 지원)
 *
 * @returns
 * 성공: { success: true, data: CacheStatsResponse }
 * 에러: { success: false, error: { code, message } }
 *
 * @example
 * // 캐시 통계 조회
 * GET /api/admin/cache-stats
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "webSearchContent": {
 *       "hits": 42,
 *       "misses": 10,
 *       "size": 15,
 *       "hitRate": 0.81
 *     },
 *     "generatedAt": "2026-01-18T12:00:00.000Z"
 *   }
 * }
 *
 * @example
 * // 캐시 초기화
 * GET /api/admin/cache-stats?action=clear
 * // Response:
 * {
 *   "success": true,
 *   "data": {
 *     "cleared": true,
 *     "message": "캐시가 초기화되었습니다."
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자/컨설턴트 권한 체크
    const authResult = await requireAdminOrConsultant();
    if (!authResult) {
      return apiUnauthorized("관리자 또는 컨설턴트 권한이 필요합니다.");
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action") || "stats";

    const webSearchContentService = getWebSearchContentService();

    if (action === "clear") {
      webSearchContentService.clearCache();
      return apiSuccess({
        cleared: true,
        message: "캐시가 초기화되었습니다.",
      });
    }

    // 캐시 통계 조회
    const stats = webSearchContentService.getCacheStats();
    const hitRate =
      stats.hits + stats.misses > 0
        ? stats.hits / (stats.hits + stats.misses)
        : 0;

    return apiSuccess({
      webSearchContent: {
        hits: stats.hits,
        misses: stats.misses,
        size: stats.size,
        hitRate: Math.round(hitRate * 100) / 100, // 소수점 2자리
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 캐시 초기화 API (관리자용)
 *
 * POST /api/admin/cache-stats
 *
 * Body (optional):
 * - tenantId: string | null - 특정 테넌트 캐시만 무효화
 * - subjectCategory: string - 특정 교과 카테고리만 무효화
 *
 * @returns
 * 성공: { success: true, data: { cleared: true, scope: "..." } }
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자/컨설턴트 권한 체크
    const authResult = await requireAdminOrConsultant();
    if (!authResult) {
      return apiUnauthorized("관리자 또는 컨설턴트 권한이 필요합니다.");
    }

    const webSearchContentService = getWebSearchContentService();

    // Body 파싱 (optional)
    let body: { tenantId?: string | null; subjectCategory?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body가 없거나 파싱 실패 시 전체 캐시 초기화
    }

    if (body.tenantId !== undefined || body.subjectCategory) {
      // 부분 무효화
      webSearchContentService.invalidateCache(
        body.tenantId ?? null,
        body.subjectCategory
      );
      return apiSuccess({
        cleared: true,
        scope: `tenantId=${body.tenantId ?? "null"}, subjectCategory=${body.subjectCategory ?? "all"}`,
        message: "지정된 범위의 캐시가 무효화되었습니다.",
      });
    }

    // 전체 캐시 초기화
    webSearchContentService.clearCache();
    return apiSuccess({
      cleared: true,
      scope: "all",
      message: "전체 캐시가 초기화되었습니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
