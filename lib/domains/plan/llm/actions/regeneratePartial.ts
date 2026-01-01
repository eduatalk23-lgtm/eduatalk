/**
 * 부분 재생성 액션
 *
 * 기존 플랜의 특정 부분만 AI로 재생성합니다.
 */

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getModelConfig, createMessage, estimateCost } from "../client";
import {
  PARTIAL_REGENERATION_SYSTEM_PROMPT,
  buildPartialRegenerationPrompt,
  type RegenerateScope,
} from "../prompts/partialRegeneration";
import type {
  GeneratedPlanItem,
  LLMPlanGenerationResponse,
  ModelTier,
} from "../types";

// ============================================
// 타입 정의
// ============================================

export interface PartialRegenerateInput {
  /** 기존 플랜 목록 */
  existingPlans: GeneratedPlanItem[];
  /** 재생성 범위 */
  scope: RegenerateScope;
  /** 사용자 피드백/요청 */
  feedback?: string;
  /** 기존 플랜 유지 여부 */
  keepExisting?: boolean;
  /** 사용 가능한 콘텐츠 ID */
  availableContentIds?: string[];
  /** 일일 학습 시간 */
  dailyStudyMinutes?: number;
  /** 모델 티어 */
  modelTier?: ModelTier;
}

export interface PartialRegenerateResult {
  success: boolean;
  regeneratedPlans?: GeneratedPlanItem[];
  explanation?: string;
  affectedDates?: string[];
  recommendations?: {
    adjustmentNotes?: string[];
    warnings?: string[];
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedUSD: number;
  };
  error?: string;
}

// ============================================
// 응답 파싱
// ============================================

interface PartialRegenerationLLMResponse {
  regeneratedPlans: GeneratedPlanItem[];
  explanation: string;
  affectedDates: string[];
  recommendations: {
    adjustmentNotes?: string[];
    warnings?: string[];
  };
}

function parsePartialResponse(
  content: string
): PartialRegenerationLLMResponse | null {
  try {
    // JSON 블록 추출
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonStr.trim());

    // 필수 필드 검증
    if (!parsed.regeneratedPlans || !Array.isArray(parsed.regeneratedPlans)) {
      console.error("Invalid response: missing regeneratedPlans array");
      return null;
    }

    return {
      regeneratedPlans: parsed.regeneratedPlans,
      explanation: parsed.explanation || "",
      affectedDates: parsed.affectedDates || [],
      recommendations: parsed.recommendations || {},
    };
  } catch (error) {
    console.error("Failed to parse partial regeneration response:", error);
    return null;
  }
}

// ============================================
// 부분 재생성 액션
// ============================================

export async function regeneratePartialPlan(
  input: PartialRegenerateInput
): Promise<PartialRegenerateResult> {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user?.userId) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 입력 검증
    if (!input.existingPlans || input.existingPlans.length === 0) {
      return { success: false, error: "기존 플랜이 없습니다." };
    }

    if (!input.scope || !input.scope.type) {
      return { success: false, error: "재생성 범위가 지정되지 않았습니다." };
    }

    // 프롬프트 구성
    const userPrompt = buildPartialRegenerationPrompt({
      existingPlans: input.existingPlans,
      scope: input.scope,
      feedback: input.feedback,
      keepExisting: input.keepExisting,
      availableContentIds: input.availableContentIds,
      dailyStudyMinutes: input.dailyStudyMinutes,
    });

    // LLM 호출
    const modelTier = input.modelTier || "standard";
    const result = await createMessage({
      system: PARTIAL_REGENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
    });

    // 응답 파싱
    const parsed = parsePartialResponse(result.content);
    if (!parsed) {
      return { success: false, error: "AI 응답 파싱에 실패했습니다." };
    }

    // 비용 계산
    const estimatedUSD = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    return {
      success: true,
      regeneratedPlans: parsed.regeneratedPlans,
      explanation: parsed.explanation,
      affectedDates: parsed.affectedDates,
      recommendations: parsed.recommendations,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedUSD,
      },
    };
  } catch (error) {
    console.error("Partial regeneration error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "부분 재생성 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 특정 날짜 재생성 (편의 함수)
// ============================================

export async function regenerateDatePlans(
  existingPlans: GeneratedPlanItem[],
  dates: string[],
  feedback?: string,
  modelTier?: ModelTier
): Promise<PartialRegenerateResult> {
  return regeneratePartialPlan({
    existingPlans,
    scope: { type: "date", dates },
    feedback,
    modelTier,
  });
}

// ============================================
// 특정 과목 재생성 (편의 함수)
// ============================================

export async function regenerateSubjectPlans(
  existingPlans: GeneratedPlanItem[],
  subjects: string[],
  feedback?: string,
  modelTier?: ModelTier
): Promise<PartialRegenerateResult> {
  return regeneratePartialPlan({
    existingPlans,
    scope: { type: "subject", subjects },
    feedback,
    modelTier,
  });
}

// ============================================
// 특정 콘텐츠 재생성 (편의 함수)
// ============================================

export async function regenerateContentPlans(
  existingPlans: GeneratedPlanItem[],
  contentIds: string[],
  feedback?: string,
  modelTier?: ModelTier
): Promise<PartialRegenerateResult> {
  return regeneratePartialPlan({
    existingPlans,
    scope: { type: "content", contentIds },
    feedback,
    modelTier,
  });
}

// ============================================
// 기간 재생성 (편의 함수)
// ============================================

export async function regenerateDateRangePlans(
  existingPlans: GeneratedPlanItem[],
  startDate: string,
  endDate: string,
  feedback?: string,
  modelTier?: ModelTier
): Promise<PartialRegenerateResult> {
  return regeneratePartialPlan({
    existingPlans,
    scope: { type: "dateRange", dateRange: { start: startDate, end: endDate } },
    feedback,
    modelTier,
  });
}
