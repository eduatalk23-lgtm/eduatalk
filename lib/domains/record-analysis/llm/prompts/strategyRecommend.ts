// ============================================
// 보완전략 AI 제안 프롬프트
// Phase 7 — Gemini Grounding (웹 검색) 활용
// ============================================

import type { SuggestStrategiesInput, SuggestStrategiesResult, StrategySuggestion } from "../types";
import type { StrategyPriority } from "@/lib/domains/student-record/types";
import { STRATEGY_TARGET_AREAS, type StrategyTargetArea } from "@/lib/domains/student-record/constants";
import { extractJson } from "../extractJson";

// ============================================
// 시스템 프롬프트
// ============================================

export const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 진단 결과(약점, 부족 역량)를 분석하여 생기부 보완전략을 제안합니다.

## 보완 영역 (${Object.keys(STRATEGY_TARGET_AREAS).length}개)

${Object.entries(STRATEGY_TARGET_AREAS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

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
7. **Blueprint Bridge 대응 (필수)**: "정합성 분석 (Gap Tracker)"의 Bridge 행동 제안이 주어지면, 각 Bridge 제안별로 이를 실현하는 구체적 전략을 **최소 1건** 포함하세요. Bridge는 Blueprint 설계 청사진에서 드러난 정합성 공백(unmatched/partial/competency_gap)이므로 가장 우선순위가 높습니다. reasoning에 "Bridge: {urgency} — {recommendedAction}"을 명시 인용하세요.
8. **JSON 형식으로만 응답합니다.**

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

  // 진단이 식별한 약점 (S3 구조화 출력 — 전략 정합성 보장)
  if (input.diagnosisImprovements && input.diagnosisImprovements.length > 0) {
    // priority 순서: critical > high > medium > low
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...input.diagnosisImprovements].sort(
      (a, b) => (priorityOrder[a.priority.toLowerCase()] ?? 9) - (priorityOrder[b.priority.toLowerCase()] ?? 9),
    );
    prompt += `## 진단이 식별한 약점\n`;
    prompt += `다음 약점들은 종합 진단(S3)에서 식별되었습니다.\n`;
    prompt += `**제안하는 전략은 가능한 한 이 약점들을 직접 보완해야 합니다.**\n\n`;
    for (const imp of sorted) {
      const priority = imp.priority.toUpperCase();
      const detail = imp.gap ? `: ${imp.gap} → ${imp.action}` : `: ${imp.action}`;
      prompt += `- [${priority}] ${imp.area}${detail}\n`;
    }
    prompt += `\n진단 약점 외에 추가로 발견한 패턴이 있다면 별도 섹션에 제안하세요.\n\n`;
  }

  // 미이수 추천 과목
  if (input.notTakenSubjects && input.notTakenSubjects.length > 0) {
    prompt += `## 미이수 추천 과목 (교과이수적합도 부족)\n\n`;
    prompt += input.notTakenSubjects.map((s) => `- ${s}`).join("\n");
    prompt += "\n\n";
  }

  // 전 학년 세특 품질 반복 패턴
  if (input.qualityPatterns && input.qualityPatterns.length > 0) {
    prompt += `## 세특 품질 반복 패턴 (전 학년 종합 — 습관적 약점)\n\n`;
    for (const p of input.qualityPatterns) {
      const subjectList = p.subjects.length > 0 ? p.subjects.join(", ") : "복수 기록";
      prompt += `- ${p.pattern} (${p.count}건: ${subjectList}) — 학생의 반복 패턴으로 보완전략에 우선 반영\n`;
    }
    prompt += "\n";
  }

  // 대학 계열 적합도 분석 (eval)
  if (input.universityMatchContext) {
    prompt += `## 대학 계열 적합도 분석\n\n${input.universityMatchContext}\n\n`;
  }

  // 배정 가이드 컨텍스트 (P4-P6 탐구 방향/키워드)
  if (input.guideContextSection) {
    prompt += `${input.guideContextSection}\n\n`;
  }

  // Layer 2 통합 테마 (hyperedge) — 3+ 레코드가 수렴하는 서사축
  if (input.hyperedgeSummarySection) {
    prompt += `${input.hyperedgeSummarySection}\n\n`;
  }

  // Phase δ-6: 메인 탐구 (5축 진단 / G11) — tier_plan 빈 셀 우선 채움
  if (input.mainExplorationSection) {
    prompt += `${input.mainExplorationSection}\n\n`;
  }

  // β 격차 1: MidPlan 핵심 탐구 축 가설 + 우려 플래그 (buildMidPlanSynthesisSection 결과)
  if (input.midPlanSynthesisSection) {
    prompt += `${input.midPlanSynthesisSection}\n\n`;
  }

  prompt += `위 진단 결과를 바탕으로 구체적인 보완전략을 JSON으로 제안해주세요. "AI 진단 개선 전략"이 있다면 이를 기반으로 구체적 활동/일정/방법을 보강하세요. 루브릭 질문별 약점이 있다면 해당 질문을 보완하는 구체적 활동을 포함하세요. 최신 대입 트렌드를 반영하여 실현 가능한 활동을 제안하세요. 미이수 과목이 있다면 해당 과목 이수를 우선적으로 포함하세요. 대학 계열 적합도 분석이 제공된 경우, 적합 계열의 갭(gap) 역량 보완을 전략에 반영하세요. 배정 가이드가 제공된 경우, 가이드의 탐구 방향과 정합하는 보완전략을 우선 제안하세요. 메인 탐구 tier_plan 이 제공된 경우, 빈 tier 셀을 우선적으로 채우는 활동을 보완전략에 1개 이상 포함하세요. **"정합성 분석 (Gap Tracker)" Bridge 행동 제안이 제공된 경우, 각 Bridge 제안별 실현 전략을 최소 1건 포함하세요 (urgency high 우선).** 컨설턴트 메타 판정(핵심 탐구 축 가설)이 제공된 경우, 해당 가설을 검증·심화하는 보강 방향을 전략에 반드시 포함하고, 우려 플래그가 있으면 해당 영역의 전략을 우선순위 높게 배치하세요.`;

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_AREAS = new Set<string>(Object.keys(STRATEGY_TARGET_AREAS));
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
