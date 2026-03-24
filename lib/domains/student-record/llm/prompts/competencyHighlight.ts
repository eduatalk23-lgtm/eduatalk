// ============================================
// 세특 인라인 하이라이트 + 역량 분석 프롬프트
// Phase 6.1 — 원문 구절 인용 기반 역량 태깅
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS } from "../../constants";
import type { HighlightAnalysisInput, HighlightAnalysisResult, AnalyzedSection, HighlightTag } from "../types";
import type { CompetencyItemCode, CompetencyGrade } from "../../types";
import { extractJson } from "../extractJson";

const COMPETENCY_SCHEMA = COMPETENCY_ITEMS.map((item) => {
  const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];
  return `- ${item.code} (${item.label}): ${item.evalTarget}\n  루브릭: ${questions.join(" / ")}`;
}).join("\n");

export const HIGHLIGHT_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 생기부 세특/창체/행특 텍스트를 분석하여 **원문의 어느 구절이 어떤 역량에 해당하는지** 정확히 표시합니다.

## 역량 체계 (3대 역량 × 10개 항목)

${COMPETENCY_SCHEMA}

## 분석 규칙

1. **원문 정확 인용**: highlight 필드에 원문의 구절을 **그대로** 인용합니다. 단어를 바꾸거나 요약하지 않습니다.
2. **구간 분류**: 세특 텍스트를 다음 3구간으로 분류하고, 각 구간의 원문을 sectionText에 포함합니다:
   - "학업태도": 수업 참여, 발표, 과제 성실성, 학습 의지
   - "학업수행능력": 개념 이해, 문제 해결력, 교과 성취도
   - "탐구활동": 심화 탐구, 보고서, 독서 연계, 실험, 프로젝트
   sectionText는 원문을 그대로 인용합니다. 문장 단위로 빠짐없이 포함하되 순서를 바꾸지 마세요.
   (창체/행특은 "전체"로 분류, sectionText에 전체 텍스트)
   (100자 미만의 짧은 텍스트는 "전체"로 분류)
3. **다중 태그**: 하나의 구절이 여러 역량에 해당할 수 있습니다.
4. **평가 구분**:
   - positive: 해당 역량이 긍정적으로 드러남 (예: "심화 탐구를 수행하여 우수한 결과를 얻었다")
   - negative: 부족함을 시사 (예: "기본 개념 이해가 미흡하여 추가 학습이 필요하다")
   - needs_review: 활동은 언급되나 성과/수준이 불명확할 때 (예: "여러 주제를 살펴봤다" → 깊이 불확실, "관심을 가졌다" → 실행 여부 불명)
5. **빠짐없이**: 텍스트의 핵심 구절을 모두 분석합니다. 중요한 활동이나 성과를 놓치지 마세요.
6. **종합 등급**: 분석한 태그들을 종합하여 10개 항목 등급을 제안합니다.
   근거가 부족한 항목은 등급을 제안하지 않습니다.

## JSON 출력 형식

\`\`\`json
{
  "sections": [
    {
      "sectionType": "학업태도",
      "sectionText": "방학 동안 스스로 모의고사를 풀면서 문제 해결과 개념 이해에 몰두함.",
      "tags": [
        {
          "competencyItem": "academic_attitude",
          "evaluation": "positive",
          "highlight": "방학 동안 스스로 모의고사를 풀면서 문제 해결과 개념 이해에 몰두",
          "reasoning": "자기주도적 학습 태도를 보여줌"
        }
      ],
      "needsReview": false
    },
    {
      "sectionType": "탐구활동",
      "sectionText": "연립방정식과 CT 촬영 원리에 대해 연구하여 탐구 보고서를 제출함.",
      "tags": [
        {
          "competencyItem": "academic_inquiry",
          "evaluation": "positive",
          "highlight": "연립방정식과 CT 촬영 원리에 대해 연구하여 탐구 보고서를 제출",
          "reasoning": "교과 심화 탐구의 구체적 성과"
        }
      ],
      "needsReview": false
    }
  ],
  "competencyGrades": [
    { "item": "academic_attitude", "grade": "B+", "reasoning": "자기주도적 학습은 보이나 수업 참여 근거 부족" }
  ],
  "summary": "학업 탐구력이 두드러지며 진로 연결이 우수함"
}
\`\`\``;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

export function buildHighlightUserPrompt(input: HighlightAnalysisInput): string {
  const typeLabel: Record<string, string> = {
    setek: "교과 세특(세부능력 및 특기사항)",
    personal_setek: "개인 세특(학교자율과정)",
    changche: "창의적 체험활동",
    haengteuk: "행동특성 및 종합의견",
  };

  let prompt = `## 분석 대상\n\n`;
  prompt += `- 기록 유형: ${typeLabel[input.recordType] ?? input.recordType}\n`;
  if (input.subjectName) prompt += `- 과목: ${input.subjectName}\n`;
  if (input.grade) prompt += `- 학년: ${input.grade}학년\n`;
  prompt += `\n## 텍스트 원문\n\n${input.content}\n\n`;
  prompt += `위 텍스트의 핵심 구절을 빠짐없이 분석하여, 각 구절이 어떤 역량에 해당하는지 원문을 정확히 인용하여 JSON으로 응답하세요.`;

  if ((input.recordType === "setek" || input.recordType === "personal_setek") && input.content.length >= 100) {
    prompt += `\n\n이 텍스트는 교과 세특이므로 3구간(학업태도/학업수행능력/탐구활동)으로 분리하여 각 구간의 원문을 sectionText에 포함하세요. 모든 문장이 빠짐없이 어느 한 구간에 포함되어야 합니다.`;
  }

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_ITEMS = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
const VALID_EVALS = new Set(["positive", "negative", "needs_review"]);
const VALID_SECTIONS = new Set(["학업태도", "학업수행능력", "탐구활동", "전체"]);
const VALID_GRADES = new Set(["A+", "A-", "B+", "B", "B-", "C"]);

const EMPTY_RESULT: HighlightAnalysisResult = { sections: [], competencyGrades: [], summary: "" };

export function parseHighlightResponse(content: string): HighlightAnalysisResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch {
    return EMPTY_RESULT;
  }

  // 필드 타입 가드
  if (!parsed || typeof parsed !== "object") return EMPTY_RESULT;
  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const rawGrades = Array.isArray(parsed.competencyGrades) ? parsed.competencyGrades : [];

  const sections: AnalyzedSection[] = [];
  for (const s of rawSections) {
    if (!s || typeof s !== "object") continue;
    const sectionType = VALID_SECTIONS.has(s.sectionType) ? s.sectionType : "전체";
    const tags: HighlightTag[] = [];

    for (const t of s.tags ?? []) {
      if (!VALID_ITEMS.has(t.competencyItem)) continue;
      if (!VALID_EVALS.has(t.evaluation)) continue;
      if (!t.highlight || typeof t.highlight !== "string") continue;

      tags.push({
        competencyItem: t.competencyItem as CompetencyItemCode,
        evaluation: t.evaluation,
        highlight: t.highlight,
        reasoning: String(t.reasoning ?? ""),
      });
    }

    if (tags.length > 0) {
      sections.push({
        sectionType: sectionType as AnalyzedSection["sectionType"],
        ...(typeof s.sectionText === "string" && s.sectionText.length > 0 ? { sectionText: s.sectionText } : {}),
        tags,
        needsReview: s.needsReview === true,
      });
    }
  }

  const competencyGrades = rawGrades
    .filter((g: unknown): g is { item: string; grade: string; reasoning?: string } =>
      !!g && typeof g === "object" && "item" in g && "grade" in g &&
      VALID_ITEMS.has((g as { item: string }).item) && VALID_GRADES.has((g as { grade: string }).grade),
    )
    .map((g: { item: string; grade: string; reasoning?: string }) => ({
      item: g.item as CompetencyItemCode,
      grade: g.grade as CompetencyGrade,
      reasoning: String(g.reasoning ?? ""),
    }));

  return {
    sections,
    competencyGrades,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}
