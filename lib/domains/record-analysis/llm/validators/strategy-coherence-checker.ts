// ============================================
// L4-D / L2 Coherence Checker — suggestStrategies 의미 정합성 검증
//
// diagnosis-coherence-checker 패턴 이식 (ai_strategy).
// Deterministic(L1)이 형식/중복/길이를 검사한다면 본 모듈은 Flash 모델로
// 전략 출력과 원본 약점/역량/전공 컨텍스트 간 정합성을 LLM-judge 방식으로 검증.
//
// LLM 호출 1회 추가 (fast tier, temperature 0.1, ~60s timeout).
// ============================================

import { z } from "zod";
import { zodSchema } from "ai";
import { generateObjectWithRateLimit } from "../ai-client";
import type { Violation, ValidationResult } from "./types";
import { summarizeViolations } from "./types";
import type { SuggestStrategiesInput, SuggestStrategiesResult } from "../types";

// ─────────────────────────────────────────────
// LLM 응답 스키마
// ─────────────────────────────────────────────

const COHERENCE_RULES = [
  "SUGGESTION_WEAKNESS_ALIGNMENT",
  "TARGET_AREA_WEAKNESS_MATCH",
  "PRIORITY_SEVERITY_MATCH",
  "MAJORS_ALIGNMENT",
  "NOT_TAKEN_COURSE_COVERAGE",
] as const;

const coherenceViolationSchema = z.object({
  rule: z.enum(COHERENCE_RULES).describe("위반된 규칙 ID"),
  severity: z
    .enum(["error", "warning"])
    .describe("심각도: error=재생성 필요, warning=개선 권장"),
  message: z.string().describe("구체적 위반 설명 (한국어, 1~2문장). 어떤 항목이 어떤 근거와 모순되는지 명시."),
  fieldPath: z.string().optional().describe("위반 발생 필드 경로 (예: suggestions[0], suggestions[2].targetArea)"),
});

const coherenceResponseSchema = z.object({
  violations: z
    .array(coherenceViolationSchema)
    .describe("감지된 의미 정합성 위반 목록. 위반이 없으면 빈 배열."),
});

export type CoherenceResponse = z.infer<typeof coherenceResponseSchema>;

export interface StrategyCoherenceResult extends ValidationResult {
  /** Flash 모델 사용 토큰 */
  usage?: { inputTokens: number; outputTokens: number };
}

// ─────────────────────────────────────────────
// 시스템 프롬프트
// ─────────────────────────────────────────────

export const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가이자 생기부 보완전략의 검수자입니다.
주어진 AI 전략 출력을 원본 진단 약점/부족역량/희망전공 데이터와 대조하여 "의미 정합성" 위반만 검사하세요.

## 검사 규칙 5가지

1. **SUGGESTION_WEAKNESS_ALIGNMENT**: 각 suggestion의 reasoning이 입력의 weaknesses / weakCompetencies / rubricWeaknesses / diagnosisImprovements 중 최소 하나에 근거하는지.
   - error: 입력 진단 어디에도 근거가 없는 제안 (근거 날조)
   - warning: 근거가 있으나 연결이 약함

2. **TARGET_AREA_WEAKNESS_MATCH**: suggestion의 targetArea가 실제 약점이 가리키는 영역과 일치하는지.
   - error: weaknesses가 세특 약점인데 targetArea=club/autonomy 등 무관한 영역 제안
   - warning: 일부만 일치하거나 영역 간 경계가 모호

2개 주의: targetArea는 9개 enum (autonomy/club/career/setek/personal_setek/reading/haengteuk/score/general) 중 하나로 판정.

3. **PRIORITY_SEVERITY_MATCH**: priority가 실제 약점의 심각도와 정합되는지.
   - error: priority=critical인데 대응 weakness가 없거나 심각도 낮은 경우 / priority=low인데 C등급 역량 관련 심각한 약점인 경우
   - warning: high/medium 구간에서 우선순위 역전

4. **MAJORS_ALIGNMENT**: targetMajor가 주어졌을 때, suggestion이 해당 전공 계열과 정합되는지.
   - error: 명백히 상반된 방향 제안 (예: 공학 지망인데 인문 탐구 중심 제안)
   - warning: 정합은 되나 전공 연결이 약함
   - targetMajor가 없으면 이 규칙은 건너뜁니다

5. **NOT_TAKEN_COURSE_COVERAGE**: notTakenSubjects가 제공된 경우, 최소 하나의 suggestion이 해당 과목 이수/보강을 다루는지.
   - warning: notTakenSubjects가 있는데 어떤 suggestion도 다루지 않음
   - notTakenSubjects가 없으면 이 규칙은 건너뜁니다

## 출력 지침

- 위반이 없으면 violations를 빈 배열로 반환하세요.
- 각 message는 구체적이어야 합니다. 어떤 suggestion이 어떤 근거와 어떻게 모순되는지 명시.
- 불확실한 위반은 보고하지 마세요. 명확한 경우만 보고합니다.
- severity 판단: 전략이 상담에 오해/시간 낭비를 유발하면 error, 아쉽지만 참고 가능하면 warning.
- fieldPath는 가능하면 제공 (suggestions[0], suggestions[2].targetArea 등).`;

// ─────────────────────────────────────────────
// 사용자 프롬프트 빌더 — 원본 컨텍스트 + 출력
// ─────────────────────────────────────────────

export function buildUserPrompt(
  output: SuggestStrategiesResult,
  input: SuggestStrategiesInput,
): string {
  const parts: string[] = [];

  parts.push(`# 원본 진단 컨텍스트\n`);
  parts.push(`**학년**: ${input.grade}학년`);
  if (input.targetMajor) parts.push(`**희망 전공 계열**: ${input.targetMajor}`);

  if (input.weaknesses.length > 0) {
    parts.push(`\n**종합 진단 약점** (${input.weaknesses.length}건):`);
    input.weaknesses.forEach((w, i) => parts.push(`  [${i}] ${w}`));
  }

  if (input.weakCompetencies.length > 0) {
    parts.push(`\n**부족 역량 (B- 이하)** (${input.weakCompetencies.length}건):`);
    input.weakCompetencies.forEach((c) => parts.push(`  - ${c.label} (${c.grade})`));
  }

  if (input.rubricWeaknesses && input.rubricWeaknesses.length > 0) {
    parts.push(`\n**루브릭 질문별 약점** (${input.rubricWeaknesses.length}건):`);
    input.rubricWeaknesses.forEach((r, i) => parts.push(`  [${i}] ${r}`));
  }

  if (input.diagnosisImprovements && input.diagnosisImprovements.length > 0) {
    parts.push(`\n**AI 진단 개선 전략 (시드)** (${input.diagnosisImprovements.length}건):`);
    input.diagnosisImprovements.forEach((imp, i) =>
      parts.push(
        `  [${i}] priority=${imp.priority} area=${imp.area} gap="${imp.gap}" action="${imp.action}"`,
      ),
    );
  }

  if (input.notTakenSubjects && input.notTakenSubjects.length > 0) {
    parts.push(`\n**미이수 추천 과목**: ${input.notTakenSubjects.join(", ")}`);
  }

  if (input.qualityPatterns && input.qualityPatterns.length > 0) {
    parts.push(`\n**세특 품질 반복 패턴**:`);
    input.qualityPatterns.forEach((p) =>
      parts.push(`  - ${p.pattern} (${p.count}건)`),
    );
  }

  parts.push(`\n# 검증 대상 전략 출력\n`);

  parts.push(`**suggestions** (${output.suggestions.length}건):`);
  output.suggestions.forEach((s, i) => {
    parts.push(
      `  [${i}] targetArea=${s.targetArea} priority=${s.priority}\n      content="${s.strategyContent}"\n      reasoning="${s.reasoning}"`,
    );
  });

  parts.push(`\n**summary**: ${output.summary}`);

  parts.push(
    `\n\n위 원본 진단 컨텍스트와 전략 출력을 대조하여 5개 규칙 기준으로 의미 정합성 위반을 감지하세요.`,
  );

  return parts.join("\n");
}

// ─────────────────────────────────────────────
// 메인 진입점
// ─────────────────────────────────────────────

/**
 * suggestStrategies 출력에 대한 L2 Coherence Check.
 * Flash 모델(fast tier) 1회 호출.
 *
 * 실패(LLM 에러, timeout) 시 호출부에서 non-fatal로 처리 권장.
 */
export async function checkStrategyCoherence(
  output: SuggestStrategiesResult,
  input: SuggestStrategiesInput,
): Promise<StrategyCoherenceResult> {
  const userPrompt = buildUserPrompt(output, input);

  const result = await generateObjectWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    schema: zodSchema(coherenceResponseSchema),
    modelTier: "fast",
    temperature: 0.1,
    maxTokens: 2048,
    timeoutMs: 60_000,
  });

  const response = result.object as CoherenceResponse;

  const violations: Violation[] = response.violations.map((v) => ({
    rule: v.rule,
    severity: v.severity,
    message: v.message,
    fieldPath: v.fieldPath,
  }));

  const summary = summarizeViolations(violations);
  return {
    ...summary,
    usage: result.usage,
  };
}
