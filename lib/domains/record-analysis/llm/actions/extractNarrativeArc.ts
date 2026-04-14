"use server";

// ============================================
// Phase 2 Layer 3: Narrative Arc 8단계 서사 태깅 액션
// 단일 레코드 → Gemini Flash 1차 호출 → 파싱 실패 시 Pro fallback
// ============================================

import { generateTextWithRateLimit, type ModelTier } from "../ai-client";
import { withRetry } from "../retry";
import {
  NARRATIVE_ARC_SYSTEM_PROMPT,
  buildNarrativeArcUserPrompt,
  parseNarrativeArcResponse,
} from "../prompts/narrativeArc";
import type {
  NarrativeArcExtractionInput,
  NarrativeArcExtractionResult,
} from "../types";

export interface ExtractNarrativeArcResponse {
  success: true;
  data: NarrativeArcExtractionResult;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ExtractNarrativeArcError {
  success: false;
  error: string;
}

/** content가 너무 짧으면 서사 판정 불가 — 기본 false로 단락 처리 */
const MIN_CONTENT_CHARS = 40;

async function callNarrativeArcLlm(
  input: NarrativeArcExtractionInput,
  tier: ModelTier,
): Promise<{ content: string; modelName?: string; usage?: { inputTokens: number; outputTokens: number } }> {
  const userPrompt = buildNarrativeArcUserPrompt(input);
  const result = await withRetry(
    () =>
      generateTextWithRateLimit({
        system: NARRATIVE_ARC_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: tier,
        temperature: 0.2,  // 보수적 판정 위해 낮게
        maxTokens: 1200,   // 8 stages × ~120 chars ≈ 1000 chars
        responseFormat: "json",
      }),
    { label: `extractNarrativeArc:${tier}` },
  );
  if (!result.content) {
    throw new Error("AI 응답이 비어있습니다.");
  }
  return {
    content: result.content,
    ...(result.modelId ? { modelName: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
  };
}

export async function extractNarrativeArc(
  input: NarrativeArcExtractionInput,
): Promise<ExtractNarrativeArcResponse | ExtractNarrativeArcError> {
  const startMs = Date.now();

  if (!input.content || input.content.trim().length < MIN_CONTENT_CHARS) {
    return {
      success: false,
      error: `원문이 너무 짧습니다 (최소 ${MIN_CONTENT_CHARS}자 필요).`,
    };
  }

  const tryTier = async (tier: ModelTier) => {
    const { content, modelName, usage } = await callNarrativeArcLlm(input, tier);
    const parsed = parseNarrativeArcResponse(content);
    return { parsed, modelName, usage };
  };

  try {
    // 1차: fast (Gemini Flash) — 비용·속도 우선
    const { parsed, modelName, usage } = await tryTier("fast");
    return {
      success: true,
      data: {
        ...parsed,
        elapsedMs: Date.now() - startMs,
        ...(modelName ? { modelName } : {}),
      },
      ...(usage ? { usage } : {}),
    };
  } catch (flashErr) {
    // 2차: standard (Pro) fallback — 파싱/응답 실패 시
    try {
      const { parsed, modelName, usage } = await tryTier("standard");
      return {
        success: true,
        data: {
          ...parsed,
          elapsedMs: Date.now() - startMs,
          ...(modelName ? { modelName } : {}),
        },
        ...(usage ? { usage } : {}),
      };
    } catch (proErr) {
      return {
        success: false,
        error: `Flash: ${flashErr instanceof Error ? flashErr.message : String(flashErr)} | Pro: ${proErr instanceof Error ? proErr.message : String(proErr)}`,
      };
    }
  }
}
