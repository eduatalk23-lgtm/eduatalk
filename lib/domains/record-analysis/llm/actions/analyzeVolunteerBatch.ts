"use server";

// ============================================
// α1-2: 봉사활동 역량 태깅 액션
// 학년 묶음 1회 LLM 호출로 공동체 역량(community_caring/leadership) 태깅 + recurringThemes 추출
// ============================================

import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { extractJson } from "../extractJson";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { buildVolunteerCompetencyPrompt } from "../prompts/volunteerCompetency";
import type {
  VolunteerAnalysisInput,
  VolunteerAnalysisResult,
} from "../types";
import type { CompetencyItemCode } from "@/lib/domains/student-record/types";

const LOG_CTX = { domain: "record-analysis", action: "analyzeVolunteerBatch" };

const ALLOWED_COMPETENCY_CODES: ReadonlySet<CompetencyItemCode> = new Set([
  "community_caring",
  "community_leadership",
  "community_collaboration",
  "community_integrity",
  "career_exploration",
]);

const ALLOWED_EVALUATIONS: ReadonlySet<"positive" | "negative" | "needs_review"> = new Set([
  "positive",
  "negative",
  "needs_review",
]);

export interface AnalyzeVolunteerResponse {
  success: true;
  data: VolunteerAnalysisResult;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AnalyzeVolunteerError {
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
  validVolunteerIds: Set<string>,
): VolunteerAnalysisResult["competencyTags"] {
  if (!Array.isArray(raw)) return [];
  const out: VolunteerAnalysisResult["competencyTags"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const volunteerId = typeof t.volunteerId === "string" ? t.volunteerId : null;
    const competencyItem = typeof t.competencyItem === "string" ? t.competencyItem : null;
    const evaluation = typeof t.evaluation === "string" ? t.evaluation : "needs_review";
    const reasoning = typeof t.reasoning === "string" ? t.reasoning.trim() : "";

    if (!volunteerId || !validVolunteerIds.has(volunteerId)) continue;
    if (!competencyItem || !ALLOWED_COMPETENCY_CODES.has(competencyItem as CompetencyItemCode)) continue;
    const evalNormalized = ALLOWED_EVALUATIONS.has(evaluation as "positive" | "negative" | "needs_review")
      ? (evaluation as "positive" | "negative" | "needs_review")
      : "needs_review";
    if (!reasoning) continue;

    out.push({
      volunteerId,
      competencyItem: competencyItem as CompetencyItemCode,
      evaluation: evalNormalized,
      reasoning,
    });
  }
  return out;
}

/**
 * 학년 봉사 묶음 → 역량 태깅 + 반복 주제 추출.
 * 빈 activities 는 호출자가 short-circuit — 이 함수는 빈 배열 들어오면 그대로 반환.
 */
export async function analyzeVolunteerBatch(
  input: VolunteerAnalysisInput,
): Promise<AnalyzeVolunteerResponse | AnalyzeVolunteerError> {
  const startMs = Date.now();
  const totalHours = input.activities.reduce((acc, a) => acc + (a.hours ?? 0), 0);

  if (input.activities.length === 0) {
    return {
      success: true,
      data: {
        totalHours: 0,
        recurringThemes: [],
        caringEvidence: [],
        leadershipEvidence: [],
        competencyTags: [],
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  const { system, user } = buildVolunteerCompetencyPrompt(input);

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
      { label: "analyzeVolunteerBatch" },
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
    const validIds = new Set(input.activities.map((a) => a.id));

    const data: VolunteerAnalysisResult = {
      totalHours,
      recurringThemes: coerceStringArray(obj.recurringThemes, 5),
      caringEvidence: coerceStringArray(obj.caringEvidence, 3),
      leadershipEvidence: coerceStringArray(obj.leadershipEvidence, 2),
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
