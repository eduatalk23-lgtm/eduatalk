import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getUnifiedContentRecommendation,
  type UnifiedRecommendInput,
} from "@/lib/domains/plan/llm/actions/unifiedContentRecommendation";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

/**
 * 콘텐츠 추천 요청 스키마
 */
const ContentRecommendationRequestSchema = z.object({
  /** 학생 ID (선택) */
  studentId: z.string().uuid().optional(),

  /** 교과 (필수) */
  subjectCategory: z.string().min(1, "교과를 선택해주세요"),

  /** 과목 (선택) */
  subject: z.string().optional(),

  /** 난이도 (선택) */
  difficultyLevel: z.string().optional(),

  /** 콘텐츠 타입 */
  contentType: z.enum(["book", "lecture", "all"]).optional().default("all"),

  /** 최대 결과 개수 */
  maxResults: z.number().int().min(1).max(20).optional().default(5),

  /** 캐시 사용 여부 */
  useCache: z.boolean().optional().default(true),

  /** 강제 콜드 스타트 */
  forceColdStart: z.boolean().optional().default(false),

  /** 결과 DB 저장 여부 */
  saveResults: z.boolean().optional().default(true),
});

type ContentRecommendationRequest = z.infer<
  typeof ContentRecommendationRequestSchema
>;

/**
 * 통합 콘텐츠 추천 API
 *
 * POST /api/plan/content-recommendation
 *
 * 학생 데이터 유무에 따라 적절한 추천 전략을 자동 선택합니다:
 * - 캐시: 기존 저장된 콘텐츠 활용
 * - 추천: 학생 데이터 기반 AI 추천
 * - 콜드 스타트: 웹 검색 기반 추천
 *
 * @example Request Body
 * ```json
 * {
 *   "subjectCategory": "수학",
 *   "subject": "미적분",
 *   "difficultyLevel": "기본",
 *   "contentType": "book",
 *   "maxResults": 5,
 *   "forceColdStart": true
 * }
 * ```
 *
 * @example Response
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "strategy": "coldStart",
 *     "recommendations": [
 *       {
 *         "id": "uuid",
 *         "title": "개념원리 미적분",
 *         "contentType": "book",
 *         "totalRange": 320,
 *         "chapters": [...],
 *         "matchScore": 92,
 *         "reason": "미적분 기본 개념 학습에 적합",
 *         "source": "cold_start"
 *       }
 *     ],
 *     "stats": {
 *       "fromCache": 0,
 *       "fromWebSearch": 5,
 *       "newlySaved": 5
 *     }
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const user = await getCurrentUser();
    const { role } = await getCurrentUserRole();

    if (!user) {
      return apiUnauthorized("로그인이 필요합니다.");
    }

    // 관리자, 상담사, 학생만 접근 가능
    if (role !== "admin" && role !== "consultant" && role !== "student") {
      return apiUnauthorized("권한이 없습니다.");
    }

    // 2. 테넌트 컨텍스트 조회
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return apiBadRequest("테넌트 정보를 찾을 수 없습니다.");
    }

    // 3. 요청 본문 파싱 및 검증
    let body: ContentRecommendationRequest;

    try {
      const rawBody = await request.json();
      body = ContentRecommendationRequestSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        return apiBadRequest(firstError?.message ?? "잘못된 요청입니다.");
      }
      return apiBadRequest("요청 본문을 파싱할 수 없습니다.");
    }

    // 4. 학생인 경우 자기 자신만 조회 가능
    if (role === "student" && body.studentId && body.studentId !== user.userId) {
      return apiUnauthorized("다른 학생의 추천을 조회할 수 없습니다.");
    }

    // 5. 통합 추천 서비스 호출
    const input: UnifiedRecommendInput = {
      tenantId: tenantContext.tenantId,
      studentId: body.studentId ?? (role === "student" ? user.userId : undefined),
      subjectCategory: body.subjectCategory,
      subject: body.subject,
      difficultyLevel: body.difficultyLevel,
      contentType: body.contentType,
      maxResults: body.maxResults,
      useCache: body.useCache,
      forceColdStart: body.forceColdStart,
      saveResults: body.saveResults,
    };

    const result = await getUnifiedContentRecommendation(input);

    // 6. 결과 반환
    if (!result.success) {
      return apiBadRequest(result.error ?? "추천 생성에 실패했습니다.");
    }

    return apiSuccess({
      strategy: result.strategy,
      recommendations: result.recommendations,
      stats: result.stats,
    });
  } catch (error) {
    return handleApiError(error, "[api/plan/content-recommendation]");
  }
}
