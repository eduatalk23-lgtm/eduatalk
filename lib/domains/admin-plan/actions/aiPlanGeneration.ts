"use server";

/**
 * AI 플랜 생성 관련 관리자 액션
 *
 * LLM 응답을 받아 student_plan 테이블에 저장합니다.
 *
 * @module lib/domains/admin-plan/actions/aiPlanGeneration
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandlingSafe } from "@/lib/errors";
import { getPlanPersistenceService } from "@/lib/plan/services/PlanPersistenceService";
import type {
  LLMPlanGenerationResponse,
  TransformContext,
  BlockInfo,
} from "@/lib/domains/plan/llm";
import {
  transformLLMResponseToPlans,
  buildContentTypeMap,
  buildAllocationMap,
} from "../transformers/llmResponseTransformer";
import type { ContentType } from "@/lib/types/plan-generation";

/**
 * 콘텐츠 정보 (TransformContext 생성용)
 */
interface ContentInfoForContext {
  id: string;
  contentType: ContentType;
}

/**
 * 할당 정보 (TransformContext 생성용)
 */
interface AllocationInfoForContext {
  contentId: string;
  subject: string;
  subjectCategory?: string;
  subject_type: "strategy" | "weakness" | null;
}

/**
 * AI 생성 플랜 저장 입력
 */
interface SaveAIPlanInput {
  planGroupId: string;
  studentId: string;
  response: LLMPlanGenerationResponse;
  deleteExisting?: boolean;
  /** Phase 3: 정확한 변환을 위한 컨텍스트 정보 (선택) */
  contextData?: {
    contents?: ContentInfoForContext[];
    blockSets?: BlockInfo[];
    allocations?: AllocationInfoForContext[];
    excludeDays?: number[];
    excludeDates?: string[];
  };
}

/**
 * AI 생성 플랜 저장 결과
 */
interface SaveAIPlanResult {
  success: boolean;
  savedCount: number;
}

/**
 * TransformContext 빌드 헬퍼
 */
function buildTransformContext(
  contextData?: SaveAIPlanInput["contextData"]
): TransformContext | undefined {
  if (!contextData) return undefined;

  const context: TransformContext = {
    contentTypeMap: new Map(),
    blockSets: [],
    allocationMap: new Map(),
    excludeDays: contextData.excludeDays,
    excludeDates: contextData.excludeDates,
  };

  // 콘텐츠 타입 맵 빌드
  if (contextData.contents && contextData.contents.length > 0) {
    context.contentTypeMap = buildContentTypeMap(contextData.contents);
  }

  // 블록 세트 복사
  if (contextData.blockSets && contextData.blockSets.length > 0) {
    context.blockSets = contextData.blockSets;
  }

  // 할당 맵 빌드
  if (contextData.allocations && contextData.allocations.length > 0) {
    context.allocationMap = buildAllocationMap(contextData.allocations);
  }

  return context;
}

/**
 * AI 생성 플랜 저장 액션
 *
 * 관리자가 AI로 생성한 플랜을 student_plan 테이블에 저장합니다.
 */
async function _saveAIGeneratedPlans(
  input: SaveAIPlanInput
): Promise<SaveAIPlanResult> {
  const { planGroupId, studentId, response, deleteExisting = true, contextData } = input;

  // 권한 확인
  const user = await getCurrentUser();
  if (!user || !["admin", "consultant"].includes(user.role)) {
    throw new AppError(
      "관리자 또는 컨설턴트 권한이 필요합니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 테넌트 컨텍스트
  const tenantContext = await requireTenantContext();

  // LLM 응답 검증
  if (!response.success) {
    throw new AppError(
      response.error ?? "AI 플랜 생성에 실패했습니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  if (response.totalPlans === 0 || response.weeklyMatrices.length === 0) {
    throw new AppError(
      "생성된 플랜이 없습니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  // Phase 3: TransformContext 빌드 (선택적)
  const transformContext = buildTransformContext(contextData);

  // LLM 응답을 플랜 배열로 변환 (TransformContext 전달)
  const planPayloads = transformLLMResponseToPlans(response, transformContext);

  if (planPayloads.length === 0) {
    throw new AppError(
      "변환된 플랜이 없습니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  // 플랜 저장 서비스 사용
  const persistenceService = getPlanPersistenceService();
  const result = await persistenceService.savePlans({
    plans: planPayloads,
    planGroupId,
    context: {
      studentId,
      tenantId: tenantContext.tenantId,
      userId: user.userId,
      role: user.role as "admin" | "consultant" | "student",
      isCampMode: false,
    },
    options: {
      deleteExisting,
    },
  });

  if (!result.success) {
    throw new AppError(
      result.error ?? "플랜 저장에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
      { errorCode: result.errorCode }
    );
  }

  return {
    success: true,
    savedCount: result.data?.savedCount ?? 0,
  };
}

export const saveAIGeneratedPlansAction = withErrorHandlingSafe(_saveAIGeneratedPlans);
