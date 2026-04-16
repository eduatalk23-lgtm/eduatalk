// ============================================
// Past Strategy 프롬프트 — 즉시 행동 권고 (scope='past')
//
// 4축×3층 통합 아키텍처 A층(Past Analytics). 2026-04-16 D.
// Final Strategy(장기 3년 설계)와 별도로, NEIS 학년 범위를 보완할
// "즉시 행동 권고"를 생성한다.
//
// 원칙:
//   - 입력: Past Diagnosis 약점 + NEIS 역량 점수 + 남은 학기.
//   - 금지: Blueprint/exemplar 참조, "3학년 설계", "장기 로드맵" 언급.
//   - 톤: "이번 학기/다음 학기 내 가능한 실행"만. 장기 설계 아님.
// ============================================

import { extractJson } from "../extractJson";
import type {
  StrategyPriority,
  StrategyTargetArea,
} from "@/lib/domains/student-record/types";
import { STRATEGY_TARGET_AREAS } from "@/lib/domains/student-record/constants";

export interface PastStrategySuggestion {
  targetArea: StrategyTargetArea;
  strategyContent: string;
  priority: StrategyPriority;
  reasoning: string;
  /** 실행 목표 학기 — 이번 학기 or 다음 학기 한정 */
  targetTerm: "this_semester" | "next_semester";
}

export interface PastStrategyResult {
  suggestions: PastStrategySuggestion[];
  summary: string;
}

export const PAST_STRATEGY_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 **NEIS 확정 기록에서 드러난 약점**을 보완하는 **즉시 행동 권고**를 제안합니다.

## 출력 범위 (매우 중요)

- 오직 **이번 학기 또는 다음 학기 내에 실행 가능한 구체적 행동**만 제안.
- "3학년에 ~할 것", "고3 진로탐색 활동", "장기 로드맵" 등 장기 설계 금지.
- Blueprint 청사진, exemplar 우수 사례 등 미래 설계 자료는 **참조 금지** (Final Strategy가 처리).

## 보완 영역 (${Object.keys(STRATEGY_TARGET_AREAS).length}개)

${Object.entries(STRATEGY_TARGET_AREAS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## 우선순위 기준

- critical: 남은 학기 내 즉시 실행 필요 (C등급, 핵심 약점)
- high: 이번 학기 내 실행 권장
- medium: 다음 학기까지 실행 가능
- low: Past 시점에서는 low 회피 (저우선은 Final 쪽)

## 규칙

1. **Past Diagnosis 약점에 직접 대응**: 진단에서 드러나지 않은 약점은 만들지 말 것.
2. **구체적 활동**: "탐구 활동을 하세요" (X) → "다음 학기 화학 탐구 보고서에서 Beer-Lambert 법칙 실험 설계" (O).
3. **실현 가능성**: 이미 지난 학년 레코드를 고치려 들지 말 것. 아직 오지 않은 학기 내의 실행만 제안.
4. **2~4건 제안**: 절박한 것부터. 남은 학기가 부족하면 2건만 해도 됨.
5. **targetTerm 필드 필수**: "this_semester" 또는 "next_semester" — 1학년 1학기처럼 현재 시점이 학기 초면 "this_semester".
6. **JSON으로만 응답**.

## 출력 형식

\`\`\`json
{
  "suggestions": [
    {
      "targetArea": "setek",
      "strategyContent": "다음 학기 화학 세특에서 Beer-Lambert 법칙 실험 설계 보고서 작성. 정량 분석 단계까지 포함하여 탐구력 루브릭 Q2 근거 확보.",
      "priority": "high",
      "reasoning": "Past Diagnosis에서 화학 세특 심화 부족 지적. 다음 학기 내 실행으로 탐구력 등급 개선 가능.",
      "targetTerm": "next_semester"
    }
  ],
  "summary": "현재 약점(화학 세특 심화 부족, 진로교과 주도성 부족)에 대한 2건의 즉시 행동 권고입니다."
}
\`\`\``;

export function buildPastStrategyUserPrompt(params: {
  neisGrades: number[];
  currentGrade: number;
  currentSemester: 1 | 2;
  weaknesses: string[];
  improvements: Array<{
    priority: string;
    area: string;
    gap: string;
    action: string;
    outcome: string;
  }>;
  weakCompetencies: Array<{ label: string; grade: string }>;
  existingStrategies?: string[];
}): string {
  const {
    neisGrades,
    currentGrade,
    currentSemester,
    weaknesses,
    improvements,
    weakCompetencies,
    existingStrategies,
  } = params;

  const gradesLabel = neisGrades.map((g) => `${g}학년`).join(", ");
  const nextGradeSem =
    currentSemester === 1
      ? `${currentGrade}학년 2학기`
      : `${currentGrade + 1}학년 1학기`;

  let prompt = `## 학생 시점
- 확정된 NEIS 학년: **${gradesLabel}**
- 현재: ${currentGrade}학년 ${currentSemester}학기
- 다음 학기: ${nextGradeSem}
- 제안 대상 기간: **이번 학기(${currentGrade}학년 ${currentSemester}학기) ~ 다음 학기(${nextGradeSem}) 까지만**. 이후 학년은 Final Strategy가 담당합니다.

`;

  if (weaknesses.length > 0) {
    prompt += `## Past Diagnosis 약점 (대응 대상)\n`;
    prompt += weaknesses.map((w) => `- ${w}`).join("\n");
    prompt += "\n\n";
  }

  if (weakCompetencies.length > 0) {
    prompt += `## 부족 역량 (B- 이하)\n`;
    prompt += weakCompetencies.map((c) => `- ${c.label}: ${c.grade}`).join("\n");
    prompt += "\n\n";
  }

  if (improvements.length > 0) {
    prompt += `## Past Diagnosis 개선 과제 (이를 구체적 행동으로 풀어 반영)\n`;
    for (const imp of improvements) {
      prompt += `- [${imp.priority}] ${imp.area}: ${imp.gap} → ${imp.action} (기대: ${imp.outcome})\n`;
    }
    prompt += "\n";
  }

  if (existingStrategies && existingStrategies.length > 0) {
    prompt += `## 기존 전략 (중복 제외)\n`;
    prompt += existingStrategies.map((s) => `- ${s}`).join("\n");
    prompt += "\n\n";
  }

  prompt += `위 정보를 바탕으로 **${currentGrade}학년 ${currentSemester}학기 ~ ${nextGradeSem}** 범위에서 실행 가능한 구체적 행동 2~4건을 JSON으로 제안하세요. 장기 로드맵·Blueprint·exemplar 참조 금지.`;

  return prompt;
}

const VALID_AREAS = new Set<string>(Object.keys(STRATEGY_TARGET_AREAS));
const VALID_PRIORITIES = new Set<string>(["critical", "high", "medium", "low"]);
const VALID_TERMS = new Set<string>(["this_semester", "next_semester"]);

export function parsePastStrategyResponse(content: string): PastStrategyResult {
  const parsed = extractJson(content);

  const suggestions: PastStrategySuggestion[] = [];
  for (const s of parsed.suggestions ?? []) {
    if (!VALID_AREAS.has(s.targetArea)) continue;
    suggestions.push({
      targetArea: s.targetArea as StrategyTargetArea,
      strategyContent: String(s.strategyContent ?? ""),
      priority: VALID_PRIORITIES.has(s.priority)
        ? (s.priority as StrategyPriority)
        : "medium",
      reasoning: String(s.reasoning ?? ""),
      targetTerm: VALID_TERMS.has(s.targetTerm)
        ? (s.targetTerm as "this_semester" | "next_semester")
        : "next_semester",
    });
  }

  return {
    suggestions,
    summary: String(parsed.summary ?? ""),
  };
}
