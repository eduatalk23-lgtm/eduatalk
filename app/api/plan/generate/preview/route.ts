import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  previewUnifiedPlanGeneration,
  unifiedPlanGenerationInputSchema,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiForbidden,
  handleApiError,
} from "@/lib/api";

/**
 * 플랜 생성 미리보기 API
 *
 * POST /api/plan/generate/preview
 *
 * AI 콜드스타트를 활용하여 학습 플랜을 미리보기합니다.
 * - DB 저장 없이 플랜 생성 결과만 반환
 * - 관리자/컨설턴트만 접근 가능
 *
 * @example Request Body
 * ```json
 * {
 *   "studentId": "uuid",
 *   "tenantId": "uuid",
 *   "planName": "1학기 수학 학습 플랜",
 *   "planPurpose": "내신대비",
 *   "periodStart": "2025-03-01",
 *   "periodEnd": "2025-03-31",
 *   "timeSettings": {
 *     "studyHours": { "start": "09:00", "end": "22:00" }
 *   },
 *   "contentSelection": {
 *     "subjectCategory": "수학",
 *     "subject": "미적분"
 *   },
 *   "timetableSettings": {
 *     "studyDays": 6,
 *     "reviewDays": 1,
 *     "studentLevel": "medium",
 *     "subjectType": "weakness"
 *   }
 * }
 * ```
 *
 * @example Response (Success)
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "success": true,
 *     "plans": [...],
 *     "aiRecommendations": { "strategy": "ai_recommendation", "items": [...] },
 *     "markdown": "# 1학기 수학 학습 플랜\n...",
 *     "validation": { "warnings": [], "autoAdjustedCount": 0 }
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return apiUnauthorized("로그인이 필요합니다");
    }

    // 2. 권한 확인 (관리자/컨설턴트만)
    const userRole = await getCurrentUserRole();
    if (userRole.role !== "admin" && userRole.role !== "consultant") {
      return apiForbidden("관리자 또는 컨설턴트만 접근할 수 있습니다");
    }

    // 3. Request body 파싱
    const body = await request.json();

    // 4. 입력 검증 (dryRun, saveToDb는 무시됨)
    const parseResult = unifiedPlanGenerationInputSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return apiBadRequest(`입력 검증 실패: ${errorMessages}`);
    }

    // 5. 테넌트 컨텍스트 검증
    const tenantContext = await getTenantContext();
    if (!tenantContext || tenantContext.tenantId !== parseResult.data.tenantId) {
      return apiForbidden("접근 권한이 없는 테넌트입니다");
    }

    // 6. 미리보기 실행 (DB 저장 없음)
    const result = await previewUnifiedPlanGeneration(parseResult.data);

    // 7. 결과 반환
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
