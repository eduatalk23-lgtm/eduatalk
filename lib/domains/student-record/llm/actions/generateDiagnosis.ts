"use server";

// ============================================
// AI 종합 진단 생성 Server Action
// 역량 태그 + 등급 기반 → 강점/약점/추천전공 자동 도출
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { getGeminiProvider } from "@/lib/domains/plan/llm/providers";
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

    // 역량 등급 요약
    const gradesSummary = COMPETENCY_ITEMS.map((item) => {
      const score = competencyScores.find((s) => s.competency_item === item.code);
      return `- ${COMPETENCY_AREA_LABELS[item.area]} > ${item.label}: ${score?.grade_value ?? "미평가"}`;
    }).join("\n");

    // 활동 태그 요약 (긍정/부정 분류)
    const positiveTags = activityTags.filter((t) => t.evaluation === "positive");
    const negativeTags = activityTags.filter((t) => t.evaluation === "negative");
    const reviewTags = activityTags.filter((t) => t.evaluation === "needs_review");

    const tagsSummary = [
      `긍정 태그 (${positiveTags.length}건):`,
      ...positiveTags.slice(0, 15).map((t) => `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${t.evidence_summary?.slice(0, 80) ?? ""}`),
      negativeTags.length > 0 ? `부정 태그 (${negativeTags.length}건):` : "",
      ...negativeTags.map((t) => `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${t.evidence_summary?.slice(0, 80) ?? ""}`),
      reviewTags.length > 0 ? `확인필요 (${reviewTags.length}건):` : "",
      ...reviewTags.map((t) => `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${t.evidence_summary?.slice(0, 80) ?? ""}`),
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

    const provider = getGeminiProvider();
    const result = await provider.createMessage({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "fast",
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    let jsonStr = result.content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    const validGrades = new Set(["A+", "A-", "B+", "B", "B-", "C"]);
    const validStrengths = new Set(["strong", "moderate", "weak"]);

    return {
      success: true,
      data: {
        overallGrade: validGrades.has(parsed.overallGrade) ? parsed.overallGrade : "B",
        recordDirection: String(parsed.recordDirection ?? "").slice(0, 50),
        directionStrength: validStrengths.has(parsed.directionStrength) ? parsed.directionStrength : "moderate",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
        recommendedMajors: Array.isArray(parsed.recommendedMajors) ? parsed.recommendedMajors.map(String) : [],
        strategyNotes: String(parsed.strategyNotes ?? ""),
      },
    };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다." };
    }
    if (error instanceof SyntaxError || msg.includes("JSON")) {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }
    return { success: false, error: "종합 진단 생성 중 오류가 발생했습니다." };
  }
}
