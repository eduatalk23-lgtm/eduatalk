"use server";

// ============================================
// AI 종합 진단 생성 Server Action
// 역량 태그 + 등급 기반 → 강점/약점/추천전공 자동 도출
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS, MAJOR_RECOMMENDED_COURSES } from "../../constants";
import type { CompetencyScore, ActivityTag } from "../../types";

const LOG_CTX = { domain: "student-record", action: "generateDiagnosis" };

const MAJOR_LIST = Object.keys(MAJOR_RECOMMENDED_COURSES).join(", ");

interface DiagnosisGenerationResult {
  overallGrade: string;
  recordDirection: string;
  directionStrength: "strong" | "moderate" | "weak";
  strengths: string[];
  weaknesses: string[];
  recommendedMajors: string[];
  strategyNotes: string;
  /** AI 응답에 fallback이 적용된 경우 경고 메시지 */
  warnings?: string[];
}

export async function generateAiDiagnosis(
  competencyScores: CompetencyScore[],
  activityTags: ActivityTag[],
  studentInfo?: { targetMajor?: string; schoolName?: string },
): Promise<{ success: true; data: DiagnosisGenerationResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (competencyScores.length === 0 && activityTags.length === 0) {
      return { success: false, error: "역량 등급이나 활동 태그 데이터가 없습니다. 먼저 역량 분석을 실행해주세요." };
    }

    // 역량 등급 요약 (컨설턴트 등급 우선, 없으면 AI 등급)
    const gradesSummary = COMPETENCY_ITEMS.map((item) => {
      const manualScore = competencyScores.find((s) => s.competency_item === item.code && s.source === "manual");
      const aiScore = competencyScores.find((s) => s.competency_item === item.code && s.source === "ai");
      const score = manualScore ?? aiScore;
      const source = manualScore ? "(컨설턴트)" : aiScore ? "(AI)" : "";
      return `- ${COMPETENCY_AREA_LABELS[item.area]} > ${item.label}: ${score?.grade_value ?? "미평가"} ${source}`;
    }).join("\n");

    // 활동 태그 요약 — 역량 항목별 그룹핑 (절삭 없이 전체 포함)
    const tagsByItem = new Map<string, { positive: number; negative: number; needs_review: number; samples: string[] }>();
    for (const t of activityTags) {
      const key = t.competency_item;
      const entry = tagsByItem.get(key) ?? { positive: 0, negative: 0, needs_review: 0, samples: [] };
      if (t.evaluation === "positive") entry.positive++;
      else if (t.evaluation === "negative") entry.negative++;
      else entry.needs_review++;
      if (entry.samples.length < 2 && t.evidence_summary) {
        entry.samples.push(t.evidence_summary.replace(/^\[AI\]\s*/, "").split("\n")[0].slice(0, 60));
      }
      tagsByItem.set(key, entry);
    }

    const tagsSummary = [
      `활동 태그 분석 (총 ${activityTags.length}건):`,
      ...Array.from(tagsByItem.entries()).map(([item, stats]) => {
        const label = COMPETENCY_ITEMS.find((i) => i.code === item)?.label ?? item;
        const parts: string[] = [];
        if (stats.positive > 0) parts.push(`긍정 ${stats.positive}건`);
        if (stats.negative > 0) parts.push(`부정 ${stats.negative}건`);
        if (stats.needs_review > 0) parts.push(`확인필요 ${stats.needs_review}건`);
        const counts = parts.join(", ");
        const samples = stats.samples.length > 0 ? ` (예: ${stats.samples.join("; ")})` : "";
        return `  - ${label}: ${counts}${samples}`;
      }),
    ].filter(Boolean).join("\n");

    const systemPrompt = `당신은 대입 컨설팅 전문가입니다. 학생의 역량 평가 데이터를 종합하여 진단 보고서를 작성합니다.

## 진단 항목

1. overallGrade: 종합 등급 (A+/A-/B+/B/B-/C)
2. recordDirection: 생기부 기록 방향 (진로 일관성, 50자 이내)
3. directionStrength: 방향 강도 (strong/moderate/weak)
4. strengths: 강점 3~5개 (구체적 근거 포함)
5. weaknesses: 약점 2~4개 (개선 방향 포함)
6. recommendedMajors: 추천 전공 2~3개 (다음 중 선택: ${MAJOR_LIST})
7. strategyNotes: 전략 메모 (100자 이내)

## 규칙
- 역량 등급과 활동 태그 데이터에 근거하여 판단
- 긍정 태그가 많은 영역 → 강점
- 부정/확인필요 태그가 있거나 등급이 낮은 영역 → 약점
- 추천 전공은 학생의 활동 패턴과 관심사 기반
- JSON으로만 응답`;

    const userPrompt = `## 학생 정보
${studentInfo?.targetMajor ? `- 희망 전공: ${studentInfo.targetMajor}` : "- 희망 전공: 미정"}
${studentInfo?.schoolName ? `- 학교: ${studentInfo.schoolName}` : ""}

## 역량 등급 (10항목)
${gradesSummary}

## 활동 태그 (총 ${activityTags.length}건)
${tagsSummary}

위 데이터를 종합하여 진단 보고서를 JSON으로 작성해주세요.`;

    const result = await generateTextWithRateLimit({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "fast",
      temperature: 0.3,
      maxTokens: 3000,
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    // JSON 추출 — 닫힌 fence → 열린 fence → raw 순서로 시도
    let jsonStr = result.content.trim();
    const closedMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (closedMatch) {
      jsonStr = closedMatch[1].trim();
    } else {
      const openMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*)/);
      if (openMatch) jsonStr = openMatch[1].trim();
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }

    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "AI 응답 형식이 올바르지 않습니다." };
    }

    const validGrades = new Set(["A+", "A-", "B+", "B", "B-", "C"]);
    const validStrengths = new Set(["strong", "moderate", "weak"]);

    // fallback 발생 시 경고 로깅
    const gradeFallback = !(typeof parsed.overallGrade === "string" && validGrades.has(parsed.overallGrade));
    const strengthFallback = !(typeof parsed.directionStrength === "string" && validStrengths.has(parsed.directionStrength));
    const emptyStrengths = !Array.isArray(parsed.strengths) || parsed.strengths.length === 0;
    const emptyWeaknesses = !Array.isArray(parsed.weaknesses) || parsed.weaknesses.length === 0;

    // fallback 추적
    const warnings: string[] = [];
    if (gradeFallback) warnings.push("종합등급이 기본값(B)으로 설정되었습니다");
    if (strengthFallback) warnings.push("방향 강도가 기본값(보통)으로 설정되었습니다");
    if (emptyStrengths) warnings.push("강점 항목이 추출되지 않았습니다");
    if (emptyWeaknesses) warnings.push("약점 항목이 추출되지 않았습니다");

    if (warnings.length > 0) {
      logActionWarn(LOG_CTX, "AI 진단 응답에 fallback 적용", {
        gradeFallback: gradeFallback ? `"${String(parsed.overallGrade)}" → "B"` : null,
        strengthFallback: strengthFallback ? `"${String(parsed.directionStrength)}" → "moderate"` : null,
        emptyStrengths, emptyWeaknesses,
      });
    }

    return {
      success: true,
      data: {
        overallGrade: !gradeFallback ? (parsed.overallGrade as string) : "B",
        recordDirection: String(parsed.recordDirection ?? "").slice(0, 50),
        directionStrength: !strengthFallback ? (parsed.directionStrength as "strong" | "moderate" | "weak") : "moderate",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
        recommendedMajors: Array.isArray(parsed.recommendedMajors) ? parsed.recommendedMajors.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
        strategyNotes: String(parsed.strategyNotes ?? ""),
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다." };
    }
    return { success: false, error: "종합 진단 생성 중 오류가 발생했습니다." };
  }
}
