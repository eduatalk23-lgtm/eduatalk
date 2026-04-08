// ============================================
// 역량 태그 자동 제안 프롬프트
// Phase 5.5a — 루브릭 기반 구조화 추론
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS } from "@/lib/domains/student-record/constants";
import type { SuggestTagsInput, SuggestTagsResult, TagSuggestion } from "../types";
import type { CompetencyItemCode } from "@/lib/domains/student-record/types";
import { extractJson } from "../extractJson";

// ============================================
// 시스템 프롬프트
// ============================================

const COMPETENCY_SCHEMA = COMPETENCY_ITEMS.map((item) => {
  const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];
  return `- ${item.code} (${item.label}): ${item.evalTarget}\n  루브릭: ${questions.join(" / ")}`;
}).join("\n");

export const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 생기부(학교생활기록부) 텍스트를 분석하여 역량 태그를 제안합니다.

## 역량 체계 (3대 역량 × 10개 항목)

${COMPETENCY_SCHEMA}

## 태깅 규칙

1. **근거 중심**: 텍스트에 명시적으로 드러나는 역량만 태깅합니다. 추측하지 않습니다.
2. **키워드 추출**: 태깅의 근거가 되는 원문 키워드를 정확히 인용합니다.
3. **루브릭 매칭**: 각 태그가 어떤 루브릭 질문에 해당하는지 명시합니다.
4. **평가 구분**:
   - positive: 해당 역량이 긍정적으로 드러남 (구체적 성과, 자발적 참여)
   - negative: 해당 역량이 부족함을 시사 (소극적, 미달)
   - needs_review: 텍스트만으로 판단 어려움 (컨설턴트 확인 필요)
5. **적정 개수**: 기록 전체에서 핵심 역량 2~5개를 선별합니다. 가장 강한 근거가 있는 태그만 선별하세요 (※ 구절별 하이라이트 분석과 다릅니다. 여기서는 대표 역량만 추출합니다).
6. **JSON 형식으로만 응답합니다.**

## 출력 형식

\`\`\`json
{
  "suggestions": [
    {
      "competencyItem": "academic_inquiry",
      "evaluation": "positive",
      "evidenceKeywords": ["자발적으로", "실험 설계", "보고서 작성"],
      "reasoning": "자발적 실험 설계 및 보고서 산출물이 탐구력을 보여줌",
      "matchedRubricQuestion": "교과와 탐구활동에서 구체적인 성과를 보이고 있는가?"
    }
  ],
  "summary": "학업 탐구력이 두드러지며, 자기주도적 학습 태도가 확인됨"
}
\`\`\``;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

export function buildUserPrompt(input: SuggestTagsInput): string {
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
  prompt += `\n## 텍스트 내용\n\n${input.content}\n\n`;
  prompt += `위 텍스트에서 드러나는 역량을 분석하여 JSON 형식으로 태그를 제안해주세요.`;

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_ITEMS = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
const VALID_EVALS = new Set(["positive", "negative", "needs_review"]);

export function parseResponse(content: string): SuggestTagsResult {
  const parsed = extractJson(content);

  const suggestions: TagSuggestion[] = [];
  for (const s of parsed.suggestions ?? []) {
    if (!VALID_ITEMS.has(s.competencyItem)) continue;
    if (!VALID_EVALS.has(s.evaluation)) continue;

    suggestions.push({
      competencyItem: s.competencyItem as CompetencyItemCode,
      evaluation: s.evaluation,
      evidenceKeywords: Array.isArray(s.evidenceKeywords) ? s.evidenceKeywords : [],
      reasoning: String(s.reasoning ?? ""),
      matchedRubricQuestion: String(s.matchedRubricQuestion ?? ""),
    });
  }

  return {
    suggestions,
    summary: String(parsed.summary ?? ""),
  };
}
