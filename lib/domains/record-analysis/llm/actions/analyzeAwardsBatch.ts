"use server";

// ============================================
// α1-4-b: 수상 역량 태깅 액션
// 학년 묶음 1회 LLM 호출로 leadership/career_exploration/academic_inquiry 태깅
// + recurringThemes / leadershipEvidence / careerRelevance 추출
// ============================================

import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { extractJson } from "../extractJson";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { buildAwardsCompetencyPrompt } from "../prompts/awardsCompetency";
import type {
  AwardsAnalysisInput,
  AwardsAnalysisResult,
} from "../types";
import type { CompetencyItemCode } from "@/lib/domains/student-record/types";

const LOG_CTX = { domain: "record-analysis", action: "analyzeAwardsBatch" };

const ALLOWED_COMPETENCY_CODES: ReadonlySet<CompetencyItemCode> = new Set([
  "community_leadership",
  "career_exploration",
  "academic_inquiry",
  // 드물지만 community_collaboration / career_course_effort 도 드러날 수 있어 허용.
  "community_collaboration",
  "career_course_effort",
]);

const ALLOWED_EVALUATIONS: ReadonlySet<"positive" | "negative" | "needs_review"> = new Set([
  "positive",
  "negative",
  "needs_review",
]);

export interface AnalyzeAwardsResponse {
  success: true;
  data: AwardsAnalysisResult;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AnalyzeAwardsError {
  success: false;
  error: string;
}

function coerceStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, max)
    .map((s) => s.trim());
}

function coerceCompetencyTags(
  raw: unknown,
  validAwardIds: Set<string>,
): AwardsAnalysisResult["competencyTags"] {
  if (!Array.isArray(raw)) return [];
  const out: AwardsAnalysisResult["competencyTags"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const awardId = typeof t.awardId === "string" ? t.awardId : null;
    const competencyItem = typeof t.competencyItem === "string" ? t.competencyItem : null;
    const evaluation = typeof t.evaluation === "string" ? t.evaluation : "needs_review";
    const reasoning = typeof t.reasoning === "string" ? t.reasoning.trim() : "";

    if (!awardId || !validAwardIds.has(awardId)) continue;
    if (!competencyItem || !ALLOWED_COMPETENCY_CODES.has(competencyItem as CompetencyItemCode)) continue;
    const evalNormalized = ALLOWED_EVALUATIONS.has(evaluation as "positive" | "negative" | "needs_review")
      ? (evaluation as "positive" | "negative" | "needs_review")
      : "needs_review";
    if (!reasoning) continue;

    out.push({
      awardId,
      competencyItem: competencyItem as CompetencyItemCode,
      evaluation: evalNormalized,
      reasoning,
    });
  }
  return out;
}

/**
 * 학년 수상 묶음 → 역량 태깅 + 반복 주제 추출.
 * 빈 awards 는 호출자가 short-circuit — 이 함수는 방어적으로 빈 결과만 반환.
 */
export async function analyzeAwardsBatch(
  input: AwardsAnalysisInput,
): Promise<AnalyzeAwardsResponse | AnalyzeAwardsError> {
  const startMs = Date.now();

  if (input.awards.length === 0) {
    return {
      success: true,
      data: {
        recurringThemes: [],
        leadershipEvidence: [],
        careerRelevance: [],
        competencyTags: [],
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  const { system, user } = buildAwardsCompetencyPrompt(input);

  try {
    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system,
          messages: [{ role: "user", content: user }],
          modelTier: "standard",
          temperature: 0.3,
          maxTokens: 2500,
          responseFormat: "json",
        }),
      { label: "analyzeAwardsBatch" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    let parsed: unknown;
    try {
      parsed = extractJson(result.content);
    } catch (err) {
      logActionWarn(LOG_CTX, "JSON 파싱 실패", {
        error: err instanceof Error ? err.message : String(err),
        rawPreview: result.content.slice(0, 200),
      });
      return { success: false, error: "AI 응답 JSON 파싱 실패" };
    }

    const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    const validIds = new Set(input.awards.map((a) => a.id));

    const data: AwardsAnalysisResult = {
      recurringThemes: coerceStringArray(obj.recurringThemes, 5),
      leadershipEvidence: coerceStringArray(obj.leadershipEvidence, 2),
      careerRelevance: coerceStringArray(obj.careerRelevance, 2),
      competencyTags: coerceCompetencyTags(obj.competencyTags, validIds),
      elapsedMs: Date.now() - startMs,
    };

    return {
      success: true,
      data,
      ...(result.usage ? { usage: result.usage } : {}),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
