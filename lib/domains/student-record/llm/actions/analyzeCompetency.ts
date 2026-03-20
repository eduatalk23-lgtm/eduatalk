"use server";

// ============================================
// AI 역량 종합 분석 Server Action
// 전체 세특/창체/행특 → 10항목 등급 초안 제안
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS } from "../../constants";
import type { CompetencyItemCode, CompetencyGrade } from "../../types";

const LOG_CTX = { domain: "student-record", action: "analyzeCompetency" };

export interface CompetencyAnalysisItem {
  competencyItem: CompetencyItemCode;
  suggestedGrade: CompetencyGrade;
  reasoning: string;
  narrative: string;
}

export interface CompetencyAnalysisResult {
  items: CompetencyAnalysisItem[];
  summary: string;
}

type RecordInput = {
  type: string;
  label: string;
  content: string;
};

const COMPETENCY_SCHEMA = COMPETENCY_ITEMS.map((item) => {
  const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];
  return `- ${item.code} (${item.label}): ${item.evalTarget}\n  루브릭: ${questions.join(" / ")}`;
}).join("\n");

const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 생기부 전체 기록을 분석하여 10개 역량 항목의 등급을 평가합니다.

## 역량 체계 (3대 역량 × 10개 항목)

${COMPETENCY_SCHEMA}

## 등급 기준

- A+: 해당 역량이 매우 우수하게 확인됨 (구체적 성과 다수, 자기주도적)
- A-: 우수하게 확인됨 (구체적 근거 있음)
- B+: 양호하게 확인됨 (일부 근거 있음)
- B: 보통 수준 (기본적 활동은 있으나 두드러지지 않음)
- B-: 다소 부족 (근거가 미약)
- C: 부족 (거의 확인되지 않음)

## 규칙

1. 모든 10개 항목에 대해 등급을 제안하세요.
2. 각 등급에 대해 1-2문장의 근거(reasoning)를 제시하세요.
3. 각 등급에 대해 2-3문장의 해석 서술(narrative)을 작성하세요. 해석 서술은 학부모/학생에게 보여줄 수 있는 자연스러운 문장으로, 해당 역량의 현황과 의미를 설명합니다.
4. 텍스트에서 명시적으로 드러나는 내용 기반으로 판단하세요.
5. 근거가 부족한 항목은 B(보통)로 두고 그 이유를 설명하세요.
6. JSON 형식으로만 응답하세요.

## 출력 형식

\`\`\`json
{
  "items": [
    {
      "competencyItem": "academic_achievement",
      "suggestedGrade": "B+",
      "reasoning": "주요 교과 성적이 안정적이며...",
      "narrative": "학업성취도는 B+등급입니다. 수학과 과학 교과에서 꾸준히 상위 성적을 유지하고 있으며, 특히 미적분에서 두드러진 성과를 보이고 있습니다."
    }
  ],
  "summary": "전반적으로 학업역량이 우수하며..."
}
\`\`\``;

export async function analyzeCompetencyFromRecords(
  records: RecordInput[],
): Promise<{ success: true; data: CompetencyAnalysisResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (records.length === 0) {
      return { success: false, error: "분석할 생기부 기록이 없습니다." };
    }

    // 레코드를 하나의 텍스트로 합침
    const recordText = records
      .map((r) => `[${r.label}]\n${r.content}`)
      .join("\n\n---\n\n");

    const userPrompt = `## 분석 대상 학생의 생기부 기록 (${records.length}건)\n\n${recordText}\n\n위 생기부 전체 기록을 종합 분석하여 10개 역량 항목의 등급을 JSON으로 제안해주세요.`;

    const result = await generateTextWithRateLimit({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "fast",
      temperature: 0.3,
      maxTokens: 4000,
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    // JSON 파싱
    let jsonStr = result.content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    const validCodes = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
    const validGrades = new Set<string>(["A+", "A-", "B+", "B", "B-", "C"]);

    const items: CompetencyAnalysisItem[] = (parsed.items ?? [])
      .filter((i: { competencyItem: string; suggestedGrade: string }) =>
        validCodes.has(i.competencyItem) && validGrades.has(i.suggestedGrade),
      )
      .map((i: { competencyItem: string; suggestedGrade: string; reasoning?: string; narrative?: string }) => ({
        competencyItem: i.competencyItem as CompetencyItemCode,
        suggestedGrade: i.suggestedGrade as CompetencyGrade,
        reasoning: String(i.reasoning ?? ""),
        narrative: String(i.narrative ?? ""),
      }));

    return {
      success: true,
      data: { items, summary: String(parsed.summary ?? "") },
    };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    if (error instanceof SyntaxError || msg.includes("JSON")) {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }
    return { success: false, error: "역량 분석 중 오류가 발생했습니다." };
  }
}
