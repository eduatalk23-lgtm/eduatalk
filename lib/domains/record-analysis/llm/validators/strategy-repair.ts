// ============================================
// L4-D / L3 Targeted Repair — suggestStrategies
//
// L1(deterministic) + L2(coherence) 에서 감지된 error violations 중
// suggestions[i] 단위 위반을 식별하고, 해당 인덱스의 suggestion만 Flash로 재생성.
// MAX=1 — 재시도 금지(루프 방지).
//
// diagnosis-repair와 구조 유사(필드 단위 vs 배열 인덱스 단위).
// ============================================

import { z } from "zod";
import { zodSchema } from "ai";
import { generateObjectWithRateLimit } from "../ai-client";
import { STRATEGY_TARGET_AREAS } from "@/lib/domains/student-record/constants";
import type { Violation } from "./types";
import type {
  SuggestStrategiesInput,
  SuggestStrategiesResult,
  StrategySuggestion,
} from "../types";
import {
  type RepairResult,
  extractErrorViolations,
  extractArrayIndex,
  getTopLevelField,
} from "./repair-engine";

// ─────────────────────────────────────────────
// LLM 응답 스키마 — 수리된 suggestion 목록 (index 포함)
// ─────────────────────────────────────────────

const VALID_TARGET_AREAS = Object.keys(STRATEGY_TARGET_AREAS) as [string, ...string[]];
const VALID_PRIORITIES = ["critical", "high", "medium", "low"] as const;

const repairedSuggestionSchema = z.object({
  index: z
    .number()
    .int()
    .nonnegative()
    .describe("원본 suggestions 배열의 인덱스 (요청된 값과 동일)"),
  targetArea: z
    .enum(VALID_TARGET_AREAS)
    .describe("보완 영역 (enum)"),
  priority: z
    .enum(VALID_PRIORITIES)
    .describe("우선순위"),
  strategyContent: z
    .string()
    .min(30)
    .describe("수리된 전략 내용 (30자 이상)"),
  reasoning: z
    .string()
    .min(15)
    .describe("수리된 제안 이유 — 약점/부족역량/전공과의 연결 명시 (15자 이상)"),
});

const repairResponseSchema = z.object({
  repairedSuggestions: z
    .array(repairedSuggestionSchema)
    .min(1)
    .describe("수리된 suggestion 목록 (요청된 인덱스와 1:1 매칭)"),
});

export type StrategyRepairResponse = z.infer<typeof repairResponseSchema>;

// ─────────────────────────────────────────────
// 프롬프트
// ─────────────────────────────────────────────

export const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가이자 생기부 보완전략 수리자입니다.
주어진 AI 전략 출력에서 "지정된 인덱스의 suggestions만" 수리하여 반환하세요.

## 수리 원칙

1. **인덱스 유지**: 요청된 index와 동일한 index로 응답합니다. 다른 index는 생성하지 않습니다.
2. **위반 직접 해결**: 각 suggestion의 violations가 지적한 문제를 직접 해결합니다.
3. **원문 근거 준수**: reasoning은 반드시 입력의 weaknesses / weakCompetencies / rubricWeaknesses / diagnosisImprovements 중 하나에 근거합니다.
4. **targetArea 정합**: targetArea는 실제 약점이 가리키는 영역과 일치해야 합니다.
   - 세특 약점 → setek / personal_setek
   - 창체 약점 → autonomy / club / career / community 중 해당
   - 행특 약점 → haengteuk
   - 독서 약점 → reading
   - 성적 관련 → score
5. **priority 정합**: critical=심각 약점(C등급/중대), high=B- 약점, medium=B, low=소소한 보강.
6. **targetMajor 정합**: 목표 전공과 상반되는 방향 금지.
7. **미이수 과목**: notTakenSubjects가 제공된 경우 최소 하나 다루는 suggestion 필요.
8. **최소 변경**: 요청되지 않은 suggestion은 건드리지 않습니다 (응답에서 제외).
9. **구체성 유지**: strategyContent는 실행 가능한 구체적 활동을 명시 (공허한 "더 열심히" 금지).`;

// ─────────────────────────────────────────────
// 사용자 프롬프트 빌더
// ─────────────────────────────────────────────

export function buildUserPrompt(
  output: SuggestStrategiesResult,
  input: SuggestStrategiesInput,
  targetIndices: number[],
  violationsByIndex: Map<number, Violation[]>,
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

  parts.push(`\n# 원본 전략 출력 (참조용, 요청 외 suggestion은 유지)\n`);
  parts.push(`**suggestions** (${output.suggestions.length}건):`);
  output.suggestions.forEach((s, i) => {
    parts.push(
      `  [${i}] targetArea=${s.targetArea} priority=${s.priority}\n      content="${s.strategyContent}"\n      reasoning="${s.reasoning}"`,
    );
  });
  parts.push(`**summary**: ${output.summary}`);

  parts.push(`\n# 수리 요청 suggestions 및 위반 내역\n`);
  for (const idx of targetIndices) {
    parts.push(`## suggestions[${idx}]`);
    const indexViolations = violationsByIndex.get(idx) ?? [];
    for (const v of indexViolations) {
      parts.push(
        `- [${v.severity}] ${v.rule}${v.fieldPath ? ` (${v.fieldPath})` : ""}: ${v.message}`,
      );
    }
  }

  parts.push(
    `\n위 위반이 지적한 문제를 해결하도록 **요청된 인덱스의 suggestions만** 수리하여 반환하세요.`,
  );
  parts.push(
    `repairedSuggestions의 각 항목은 원본과 동일한 index를 유지합니다. 요청되지 않은 인덱스는 응답에 포함하지 마세요.`,
  );

  return parts.join("\n");
}

// ─────────────────────────────────────────────
// 수리 대상 인덱스 추출
// ─────────────────────────────────────────────

export function extractRepairTargetIndices(
  violations: Violation[],
  totalSuggestions: number,
): number[] {
  const indices = new Set<number>();
  for (const v of violations) {
    const top = getTopLevelField(v.fieldPath);
    if (top !== "suggestions") continue;
    const idx = extractArrayIndex(v.fieldPath);
    if (idx == null) continue;
    if (idx < 0 || idx >= totalSuggestions) continue;
    indices.add(idx);
  }
  return [...indices].sort((a, b) => a - b);
}

// ─────────────────────────────────────────────
// Merge — 수리된 suggestions를 원본에 병합
// ─────────────────────────────────────────────

function mergeRepairedSuggestions(
  original: SuggestStrategiesResult,
  repaired: StrategyRepairResponse,
  targetIndices: number[],
): SuggestStrategiesResult {
  const nextSuggestions: StrategySuggestion[] = [...original.suggestions];
  for (const r of repaired.repairedSuggestions) {
    if (!targetIndices.includes(r.index)) continue;
    if (r.index < 0 || r.index >= nextSuggestions.length) continue;
    nextSuggestions[r.index] = {
      ...nextSuggestions[r.index],
      targetArea: r.targetArea as StrategySuggestion["targetArea"],
      priority: r.priority as StrategySuggestion["priority"],
      strategyContent: r.strategyContent,
      reasoning: r.reasoning,
    };
  }
  return { ...original, suggestions: nextSuggestions };
}

// ─────────────────────────────────────────────
// 메인 진입점
// ─────────────────────────────────────────────

/**
 * L1+L2 error violations 기반 보완전략 부분 재생성.
 * suggestions[i] 단위 위반이 없으면 원본 그대로 반환 (LLM 호출 0회).
 *
 * 실패(LLM 에러, timeout) 시 호출부에서 non-fatal로 처리 권장.
 */
export async function repairStrategies(
  output: SuggestStrategiesResult,
  violations: Violation[],
  input: SuggestStrategiesInput,
): Promise<RepairResult<SuggestStrategiesResult>> {
  const errors = extractErrorViolations(violations);
  if (errors.length === 0) {
    return {
      repaired: false,
      output,
      repairedFieldPaths: [],
      remainingViolations: violations,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const targetIndices = extractRepairTargetIndices(errors, output.suggestions.length);
  if (targetIndices.length === 0) {
    return {
      repaired: false,
      output,
      repairedFieldPaths: [],
      remainingViolations: violations,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const violationsByIndex = new Map<number, Violation[]>();
  for (const v of errors) {
    const top = getTopLevelField(v.fieldPath);
    if (top !== "suggestions") continue;
    const idx = extractArrayIndex(v.fieldPath);
    if (idx == null) continue;
    if (!targetIndices.includes(idx)) continue;
    const arr = violationsByIndex.get(idx) ?? [];
    arr.push(v);
    violationsByIndex.set(idx, arr);
  }

  const userPrompt = buildUserPrompt(output, input, targetIndices, violationsByIndex);

  const result = await generateObjectWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    schema: zodSchema(repairResponseSchema),
    modelTier: "fast",
    temperature: 0.2,
    maxTokens: 2560,
    timeoutMs: 90_000,
  });

  const response = result.object as StrategyRepairResponse;
  const merged = mergeRepairedSuggestions(output, response, targetIndices);

  // Monitor: L1 재검증 — 남은 위반 보고 (재시도는 하지 않음, MAX=1)
  const { validateStrategyOutput } = await import("./strategy-validator");
  const revalidation = validateStrategyOutput(merged);

  return {
    repaired: true,
    output: merged,
    repairedFieldPaths: targetIndices.map((i) => `suggestions[${i}]`),
    remainingViolations: revalidation.violations,
    usage: result.usage,
  };
}
