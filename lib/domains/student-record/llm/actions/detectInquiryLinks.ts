"use server";

// ============================================
// 학년간 후속탐구 연결 감지 Server Action
// Phase 6.3 — 전 학년 세특에서 탐구 주제 연결 자동 감지
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import {
  INQUIRY_LINK_SYSTEM_PROMPT,
  buildInquiryLinkUserPrompt,
  parseInquiryLinkResponse,
} from "../prompts/inquiryLinking";
import type { RecordSummary, InquiryLinkResult } from "../prompts/inquiryLinking";

const LOG_CTX = { domain: "student-record", action: "detectInquiryLinks" };

export type { RecordSummary, InquiryLinkResult, InquiryConnection, SuggestedStoryline } from "../prompts/inquiryLinking";

export async function detectInquiryLinks(
  records: RecordSummary[],
): Promise<{ success: true; data: InquiryLinkResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (records.length < 2) {
      return { success: false, error: "탐구 연결 감지에는 최소 2건의 기록이 필요합니다." };
    }

    const userPrompt = buildInquiryLinkUserPrompt(records);

    // 레코드 20건 이상이면 Pro 모델 사용 (다중 레코드 교차 분석 품질)
    const tier = records.length >= 20 ? "advanced" : "fast";
    const maxTokens = records.length >= 20 ? 8000 : 4000;

    const result = await generateTextWithRateLimit({
      system: INQUIRY_LINK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: tier,
      temperature: 0.3,
      maxTokens,
      responseFormat: "json",
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const parsed = parseInquiryLinkResponse(result.content, records.length - 1);

    return { success: true, data: parsed };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    if (error instanceof SyntaxError || msg.includes("JSON")) {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }
    return { success: false, error: "탐구 연결 감지 중 오류가 발생했습니다." };
  }
}
