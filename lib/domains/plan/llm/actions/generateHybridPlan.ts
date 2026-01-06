"use server";

/**
 * 하이브리드 플랜 생성 액션
 *
 * AI의 전략적 결정과 코드 기반 스케줄러를 결합하여
 * 최적화된 학습 플랜을 생성합니다.
 *
 * 흐름:
 * 1. AI가 경량 프레임워크(전략, 과목 분류, 시간 힌트) 생성
 * 2. 프레임워크를 SchedulerOptions로 변환
 * 3. 변환된 옵션으로 기존 코드 기반 스케줄러 호출
 *
 * @module lib/domains/plan/llm/actions/generateHybridPlan
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandlingSafe } from "@/lib/errors";
import { getModelConfig, createMessage } from "../client";
import {
  FRAMEWORK_SYSTEM_PROMPT,
  buildFrameworkUserPrompt,
  parseFrameworkResponse,
  updateFrameworkMeta,
} from "../prompts/frameworkGeneration";
import {
  convertFrameworkToSchedulerOptions,
  isHighConfidenceFramework,
} from "../converters/frameworkToSchedulerOptions";
import type {
  AIFramework,
  AIFrameworkInput,
  FrameworkConversionResult,
} from "../types/aiFramework";
import type { ModelTier } from "../types";
import type { WebSearchResult, GroundingConfig } from "../providers/base";

// ============================================
// 입력/출력 타입
// ============================================

/**
 * 하이브리드 프레임워크 생성 입력
 */
export interface GenerateFrameworkInput {
  /** 학생 정보 */
  student: AIFrameworkInput["student"];
  /** 성적 정보 */
  scores: AIFrameworkInput["scores"];
  /** 콘텐츠 목록 */
  contents: AIFrameworkInput["contents"];
  /** 학습 이력 (선택) */
  learningHistory?: AIFrameworkInput["learningHistory"];
  /** 기간 정보 */
  period: AIFrameworkInput["period"];
  /** 추가 지시사항 (선택) */
  additionalInstructions?: string;
  /** 모델 티어 (기본: standard) */
  modelTier?: ModelTier;
  /** 콘텐츠 매핑 (변환용) */
  contentMappings?: Array<{
    contentId: string;
    subjectCategory: string;
    contentType: "book" | "lecture" | "custom";
  }>;
  /** 웹 검색 활성화 여부 (Gemini Grounding) */
  enableWebSearch?: boolean;
  /** 웹 검색 설정 */
  webSearchConfig?: {
    /** 검색 모드 - dynamic: 필요시 검색, always: 항상 검색 */
    mode?: "dynamic" | "always";
    /** 동적 검색 임계값 (0.0 - 1.0) */
    dynamicThreshold?: number;
    /** 검색 결과를 DB에 저장할지 여부 */
    saveResults?: boolean;
  };
}

/**
 * 하이브리드 프레임워크 생성 결과
 */
export interface GenerateFrameworkResult {
  success: boolean;
  /** 생성된 AI 프레임워크 */
  framework?: AIFramework;
  /** 변환된 스케줄러 옵션 */
  conversionResult?: FrameworkConversionResult;
  /** 에러 메시지 */
  error?: string;
  /** 토큰 사용량 */
  tokensUsed?: {
    input: number;
    output: number;
  };
  /** 처리 시간 (ms) */
  processingTimeMs?: number;
  /** 낮은 신뢰도 경고 */
  lowConfidenceWarning?: boolean;
  /** 웹 검색 결과 (grounding 활성화 시) */
  webSearchResults?: {
    searchQueries: string[];
    resultsCount: number;
    results: WebSearchResult[];
  };
}

// ============================================
// 메인 액션
// ============================================

/**
 * AI 프레임워크 생성 및 SchedulerOptions 변환
 *
 * 이 액션은 AI를 사용하여 학습 전략 프레임워크를 생성하고,
 * 이를 코드 기반 스케줄러에서 사용할 수 있는 형식으로 변환합니다.
 *
 * @example
 * ```typescript
 * const result = await generateAIFrameworkAction({
 *   student: { id: "...", name: "홍길동", grade: "고2" },
 *   scores: [{ subject: "수학", subjectCategory: "수학", score: 65 }],
 *   contents: [...],
 *   period: { startDate: "2026-01-06", endDate: "2026-01-19", totalDays: 14, studyDays: 12 },
 * });
 *
 * if (result.success) {
 *   // conversionResult.schedulerOptions를 plan_groups에 저장하거나
 *   // generatePlansWithServices에 전달
 * }
 * ```
 */
async function _generateAIFramework(
  input: GenerateFrameworkInput
): Promise<GenerateFrameworkResult> {
  const startTime = Date.now();

  // 권한 확인
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  // 테넌트 컨텍스트
  await requireTenantContext();

  // 입력 검증
  if (!input.student || !input.period) {
    throw new AppError(
      "학생 정보와 기간 정보는 필수입니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  if (input.contents.length === 0) {
    throw new AppError(
      "최소 1개 이상의 콘텐츠가 필요합니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  // 모델 설정
  const modelTier = input.modelTier || "standard";
  const modelConfig = getModelConfig(modelTier);

  // 프레임워크 입력 구성
  const frameworkInput: AIFrameworkInput = {
    student: input.student,
    scores: input.scores,
    contents: input.contents,
    learningHistory: input.learningHistory,
    period: input.period,
    additionalInstructions: input.additionalInstructions,
  };

  // 사용자 프롬프트 생성
  const userPrompt = buildFrameworkUserPrompt(frameworkInput);

  // Grounding 설정 (웹 검색 활성화 시)
  const groundingConfig: GroundingConfig | undefined = input.enableWebSearch
    ? {
        enabled: true,
        mode: input.webSearchConfig?.mode || "dynamic",
        dynamicThreshold: input.webSearchConfig?.dynamicThreshold,
      }
    : undefined;

  try {
    // AI 호출
    const response = await createMessage({
      system: FRAMEWORK_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      modelTier,
      maxTokens: 4000, // 프레임워크는 상대적으로 작은 출력
      grounding: groundingConfig,
    });

    // 응답 파싱
    const responseText = response.content;

    const parseResult = parseFrameworkResponse(responseText);

    if (!parseResult.success || !parseResult.framework) {
      return {
        success: false,
        error: parseResult.error || "프레임워크 파싱 실패",
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 메타데이터 업데이트
    const framework = updateFrameworkMeta(parseResult.framework, {
      modelId: modelConfig.modelId,
      tokensUsed: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens,
      },
      processingTimeMs: Date.now() - startTime,
    });

    // SchedulerOptions로 변환
    const conversionResult = convertFrameworkToSchedulerOptions(framework, {
      contentMappings: input.contentMappings,
    });

    // 신뢰도 확인
    const lowConfidenceWarning = !isHighConfidenceFramework(framework, 0.7);

    // 웹 검색 결과 처리
    let webSearchResults:
      | {
          searchQueries: string[];
          resultsCount: number;
          results: WebSearchResult[];
        }
      | undefined;

    if (
      response.groundingMetadata &&
      response.groundingMetadata.webResults.length > 0
    ) {
      webSearchResults = {
        searchQueries: response.groundingMetadata.searchQueries,
        resultsCount: response.groundingMetadata.webResults.length,
        results: response.groundingMetadata.webResults,
      };
    }

    return {
      success: true,
      framework,
      conversionResult,
      tokensUsed: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens,
      },
      processingTimeMs: Date.now() - startTime,
      lowConfidenceWarning,
      webSearchResults,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "프레임워크 생성 실패";

    if (error instanceof AppError) {
      throw error;
    }

    return {
      success: false,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export const generateAIFrameworkAction = withErrorHandlingSafe(_generateAIFramework);
