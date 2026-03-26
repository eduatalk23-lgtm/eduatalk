// ============================================
// 보완전략 AI 제안 프롬프트
// Phase 7 — Gemini Grounding (웹 검색) 활용
// ============================================

import type { SuggestStrategiesInput, SuggestStrategiesResult, StrategySuggestion } from "../types";
import type { StrategyTargetArea, StrategyPriority } from "../../types";
import { extractJson } from "../extractJson";

// ============================================
// 시스템 프롬프트
// ============================================

export const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 진단 결과(약점, 부족 역량)를 분석하여 생기부 보완전략을 제안합니다.

## 보완 영역 (9개)

- autonomy: 자율활동 (자치활동, 학급 프로젝트, 리더십)
- club: 동아리활동 (학술/봉사/체육 동아리)
- career: 진로활동 (진로 탐색, 멘토링, 체험)
- setek: 교과 세특 (과목별 심화 탐구, 보고서, 발표)
- personal_setek: 개인 세특 (학교자율과정)
- reading: 독서활동 (전공 관련 도서)
- haengteuk: 행동특성 및 종합의견 (인성, 공동체 역량)
- score: 성적 (전공교과 성적 관리)
- general: 종합 (스토리라인, 일관성)

## 우선순위 기준

- critical: 즉시 보완 필요 (해당 역량 C등급, 또는 핵심 약점)
- high: 이번 학기 중 보완 필요
- medium: 다음 학기까지 보완 가능
- low: 장기적 개선 사항

## 규칙

1. **진단 근거 기반**: 약점과 부족 역량에 직접 대응하는 전략만 제안
2. **구체적 활동 제안**: "탐구 활동을 하세요" (X) → "CT촬영 원리 탐구 보고서 작성, 물리학Ⅱ 세특 연계" (O)
3. **실현 가능성**: 고등학생이 교내에서 실행 가능한 활동만 제안
4. **중복 방지**: 기존 전략과 유사한 내용은 제외
5. **3~6개 전략 제안**: 영역별로 분산하되, 가장 급한 것부터 제안
6. **최신 트렌드 반영**: 웹 검색을 통해 최신 대입 트렌드, 교육 정보를 참고
7. **JSON 형식으로만 응답합니다.**

## 출력 형식

\`\`\`json
{
  "suggestions": [
    {
      "targetArea": "setek",
      "strategyContent": "2학년 물리학 세특에서 의료영상 원리(CT/MRI) 탐구 보고서 작성. X선 감쇠계수와 Beer-Lambert 법칙을 중심으로 교과 심화 탐구.",
      "priority": "high",
      "reasoning": "탐구력 B- 등급으로 교과 심화 탐구 근거가 부족. 진로(의료공학)와 연계한 탐구로 탐구력+진로탐색 동시 보강 가능."
    }
  ],
  "summary": "탐구력과 진로탐색 역량을 중심으로 교과 세특과 진로활동을 강화하는 전략을 제안합니다."
}
\`\`\``;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

export function buildUserPrompt(input: SuggestStrategiesInput): string {
  let prompt = `## 학생 정보\n\n`;
  prompt += `- 학년: ${input.grade}학년\n`;
  if (input.targetMajor) prompt += `- 희망 전공 계열: ${input.targetMajor}\n`;
  prompt += "\n";

  // 약점
  if (input.weaknesses.length > 0) {
    prompt += `## 종합 진단 약점\n\n`;
    prompt += input.weaknesses.map((w) => `- ${w}`).join("\n");
    prompt += "\n\n";
  }

  // 부족 역량
  if (input.weakCompetencies.length > 0) {
    prompt += `## 부족 역량 (B- 이하)\n\n`;
    prompt += input.weakCompetencies.map((c) => `- ${c.label}: ${c.grade}`).join("\n");
    prompt += "\n\n";
  }

  // 기존 전략
  if (input.existingStrategies && input.existingStrategies.length > 0) {
    prompt += `## 기존 보완전략 (중복 제외)\n\n`;
    prompt += input.existingStrategies.map((s) => `- ${s}`).join("\n");
    prompt += "\n\n";
  }

  // 루브릭 질문별 약점
  if (input.rubricWeaknesses && input.rubricWeaknesses.length > 0) {
    prompt += `## 루브릭 질문별 약점 (B- 이하)\n\n`;
    prompt += input.rubricWeaknesses.map((s) => `- ${s}`).join("\n");
    prompt += "\n\n";
  }

  // 미이수 추천 과목
  if (input.notTakenSubjects && input.notTakenSubjects.length > 0) {
    prompt += `## 미이수 추천 과목 (교과이수적합도 부족)\n\n`;
    prompt += input.notTakenSubjects.map((s) => `- ${s}`).join("\n");
    prompt += "\n\n";
  }

  prompt += `위 진단 결과를 바탕으로 구체적인 보완전략을 JSON으로 제안해주세요. 루브릭 질문별 약점이 있다면 해당 질문을 보완하는 구체적 활동을 포함하세요. 최신 대입 트렌드를 반영하여 실현 가능한 활동을 제안하세요. 미이수 과목이 있다면 해당 과목 이수를 우선적으로 포함하세요.`;

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_AREAS = new Set<string>([
  "autonomy", "club", "career", "setek", "personal_setek",
  "reading", "haengteuk", "score", "general",
]);
const VALID_PRIORITIES = new Set<string>(["critical", "high", "medium", "low"]);

export function parseResponse(content: string, sourceUrls?: string[]): SuggestStrategiesResult {
  const parsed = extractJson(content);

  const suggestions: StrategySuggestion[] = [];
  for (const s of parsed.suggestions ?? []) {
    if (!VALID_AREAS.has(s.targetArea)) continue;

    suggestions.push({
      targetArea: s.targetArea as StrategyTargetArea,
      strategyContent: String(s.strategyContent ?? ""),
      priority: VALID_PRIORITIES.has(s.priority) ? (s.priority as StrategyPriority) : "medium",
      reasoning: String(s.reasoning ?? ""),
      sourceUrls: sourceUrls && sourceUrls.length > 0 ? sourceUrls : undefined,
    });
  }

  return {
    suggestions,
    summary: String(parsed.summary ?? ""),
  };
}
