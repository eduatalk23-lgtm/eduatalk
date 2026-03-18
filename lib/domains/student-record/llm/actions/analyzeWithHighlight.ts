"use server";

// ============================================
// 세특 인라인 하이라이트 분석 Server Action
// Phase 6.1 — 원문 구절 인용 + 역량 태깅
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { getGeminiProvider } from "@/lib/domains/plan/llm/providers";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
  parseHighlightResponse,
} from "../prompts/competencyHighlight";
import type { HighlightAnalysisInput, HighlightAnalysisResult } from "../types";

const LOG_CTX = { domain: "student-record", action: "analyzeWithHighlight" };

export async function analyzeSetekWithHighlight(
  input: HighlightAnalysisInput,
): Promise<{ success: true; data: HighlightAnalysisResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (!input.content || input.content.trim().length < 20) {
      return { success: false, error: "분석할 텍스트가 너무 짧습니다 (20자 이상 필요)." };
    }

    const provider = getGeminiProvider();
    const userPrompt = buildHighlightUserPrompt(input);

    const result = await provider.createMessage({
      system: HIGHLIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "fast",
      temperature: 0.3,
      maxTokens: 4000,
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const parsed = parseHighlightResponse(result.content);

    // Phase 6.2: sectionText 검증 — 커버리지 40% 미만이면 폴백
    if (input.recordType === "setek" || input.recordType === "personal_setek") {
      const totalCovered = parsed.sections.reduce((sum, s) => sum + (s.sectionText?.length ?? 0), 0);
      if (totalCovered > 0 && totalCovered < input.content.length * 0.4) {
        for (const s of parsed.sections) {
          delete s.sectionText;
        }
      }
    }

    if (parsed.sections.length === 0) {
      return {
        success: true,
        data: { sections: [], competencyGrades: [], summary: "해당 텍스트에서 명확한 역량 근거를 찾지 못했습니다." },
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    return { success: false, error: "역량 분석 중 오류가 발생했습니다." };
  }
}
