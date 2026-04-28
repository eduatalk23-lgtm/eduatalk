"use server";

// ============================================
// AI 보완전략 제안 Server Action
// Phase 7 — Gemini Grounding (웹 검색) 활용
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse } from "../prompts/strategyRecommend";
import type { SuggestStrategiesInput, SuggestStrategiesResult } from "../types";

const LOG_CTX = { domain: "record-analysis", action: "suggestStrategies" };

export async function suggestStrategies(
  input: SuggestStrategiesInput,
  /**
   * 현재 task 의 절대 마감 시각 (ms, Date.now() 기준).
   * withRetry 에 전달하여 wrapper timeout 이후 추가 retry 를 즉시 차단 (좀비 promise 방지).
   * 파이프라인 외부에서 직접 호출하는 경우 미지정 — 기존 동작 유지.
   */
  deadline?: number,
): Promise<{ success: true; data: SuggestStrategiesResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (input.weaknesses.length === 0 && input.weakCompetencies.length === 0 && (!input.rubricWeaknesses || input.rubricWeaknesses.length === 0)) {
      return { success: false, error: "진단 약점이나 부족 역량 데이터가 없습니다. 먼저 종합 진단을 실행해주세요." };
    }

    const userPrompt = buildUserPrompt(input);

    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "fast",
        temperature: 0.4,
        maxTokens: 3000,
        grounding: { enabled: true, mode: "dynamic", dynamicThreshold: 0.3 },
      }),
      { label: "suggestStrategies", deadline },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }

    // Grounding 웹 검색 출처 추출
    const sourceUrls = result.groundingMetadata?.webResults
      ?.map((r) => r.url)
      .filter(Boolean) as string[] | undefined;

    const parsed = parseResponse(result.content, sourceUrls);

    if (parsed.suggestions.length === 0) {
      return {
        success: true,
        data: { suggestions: [], summary: "현재 진단 데이터로는 구체적인 보완전략을 도출하기 어렵습니다." },
      };
    }

    // L4-D / L1+L2+L3: Hypothesis-Verify Loop
    // L1 규칙 검증 → L2 coherence (Flash judge) → L3 targeted repair (Flash, MAX=1)
    // 각 단계 실패는 non-fatal — 이전 단계 결과로 진행.
    const warnings: string[] = [];
    const { formatViolationLabels } = await import("../validators/types");
    let strategyData: SuggestStrategiesResult = parsed;
    const l1Violations: import("../validators/types").Violation[] = [];
    const l2Violations: import("../validators/types").Violation[] = [];

    try {
      const { validateStrategyOutput } = await import("../validators/strategy-validator");
      const validation = validateStrategyOutput(strategyData);
      if (validation.violations.length > 0) {
        l1Violations.push(...validation.violations);
        logActionWarn(LOG_CTX, "L1 validator violations", {
          errorCount: validation.errorCount,
          warningCount: validation.warningCount,
          rules: validation.violations.map((v) => v.rule),
        });
      }
    } catch (validatorErr) {
      logActionWarn(LOG_CTX, "L1 validator skipped (non-fatal)", { error: String(validatorErr) });
    }

    try {
      const { checkStrategyCoherence } = await import("../validators/strategy-coherence-checker");
      const coherence = await checkStrategyCoherence(strategyData, input);
      if (coherence.violations.length > 0) {
        l2Violations.push(...coherence.violations);
        logActionWarn(LOG_CTX, "L2 coherence violations", {
          errorCount: coherence.errorCount,
          warningCount: coherence.warningCount,
          rules: coherence.violations.map((v) => v.rule),
        });
      }
    } catch (coherenceErr) {
      logActionWarn(LOG_CTX, "L2 coherence check skipped (non-fatal)", {
        error: coherenceErr instanceof Error ? coherenceErr.message : String(coherenceErr),
      });
    }

    // L3 Targeted Repair — suggestions[i] 단위 error만 대상, MAX=1
    const combinedViolations = [...l1Violations, ...l2Violations];
    const hasErrors = combinedViolations.some((v) => v.severity === "error");
    let repairApplied = false;
    let postRepairViolations: import("../validators/types").Violation[] | null = null;

    if (hasErrors) {
      try {
        const { repairStrategies } = await import("../validators/strategy-repair");
        const repair = await repairStrategies(strategyData, combinedViolations, input);
        if (repair.repaired) {
          strategyData = repair.output;
          repairApplied = true;
          postRepairViolations = repair.remainingViolations;
          warnings.push(
            `[REPAIRED] ${repair.repairedFieldPaths.join(", ")} suggestions를 L3 repair로 재생성했습니다`,
          );
          logActionWarn(LOG_CTX, "L3 repair applied", {
            repairedFieldPaths: repair.repairedFieldPaths,
            remainingViolationCount: repair.remainingViolations.length,
            usage: repair.usage,
          });
        }
      } catch (repairErr) {
        logActionWarn(LOG_CTX, "L3 repair skipped (non-fatal)", {
          error: repairErr instanceof Error ? repairErr.message : String(repairErr),
        });
      }
    }

    if (repairApplied && postRepairViolations) {
      warnings.push(...formatViolationLabels(postRepairViolations));
      const l2Warnings = l2Violations.filter((v) => v.severity === "warning");
      if (l2Warnings.length > 0) warnings.push(...formatViolationLabels(l2Warnings));
    } else if (combinedViolations.length > 0) {
      warnings.push(...formatViolationLabels(combinedViolations));
    }

    return {
      success: true,
      data: warnings.length > 0 ? { ...strategyData, warnings } : strategyData,
    };
  } catch (error) {
    return handleLlmActionError(error, "보완전략 제안", LOG_CTX);
  }
}
