// ============================================
// L4-D / L3 Targeted Repair — ai_diagnosis
//
// L1(deterministic) + L2(coherence) 에서 감지된 error violations를 Flash로 부분 재생성.
// 전체 재생성 대비 비용 대폭 절약. MAX=1 — 재시도 금지(루프 방지).
//
// 전략: 위반의 최상위 필드(strengths/weaknesses/improvements/recommendedMajors/strategyNotes/directionReasoning)를
// 식별하고, 해당 필드만 LLM에 다시 생성하도록 요청한다. 원본의 나머지 필드는 보존.
// ============================================

import { z } from "zod";
import { zodSchema } from "ai";
import type { CompetencyScore, ActivityTag, CompetencyItemCode } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record/constants";
import { generateObjectWithRateLimit } from "../ai-client";
import type { Violation } from "./types";
import type { DiagnosisGenerationResult } from "../actions/generateDiagnosis";
import type { DiagnosisImprovement } from "../actions/diagnosis-helpers";
import {
  type RepairResult,
  extractErrorViolations,
  groupViolationsByTopField,
} from "./repair-engine";

// ─────────────────────────────────────────────
// Repair 대상 필드 정의
// ─────────────────────────────────────────────

/** 재생성 가능한 필드 집합. 그 외 필드(overallGrade 등)는 fallback으로 처리되어 repair 대상 아님. */
const REPAIRABLE_FIELDS = new Set<string>([
  "strengths",
  "weaknesses",
  "improvements",
  "recommendedMajors",
  "strategyNotes",
  "directionReasoning",
]);

// ─────────────────────────────────────────────
// LLM 응답 스키마 — 수리된 필드만 선택적 반환
// ─────────────────────────────────────────────

const improvementSchema = z.object({
  priority: z.enum(["높음", "중간", "낮음"]),
  area: z.string().min(1),
  gap: z.string(),
  action: z.string().min(1),
  outcome: z.string(),
});

const repairResponseSchema = z.object({
  strengths: z
    .array(z.string().min(1))
    .optional()
    .describe("수리된 강점 목록 (요청된 경우에만)"),
  weaknesses: z
    .array(z.string().min(1))
    .optional()
    .describe("수리된 약점 목록 (요청된 경우에만)"),
  improvements: z
    .array(improvementSchema)
    .optional()
    .describe("수리된 개선전략 목록 (요청된 경우에만)"),
  recommendedMajors: z
    .array(z.string().min(1))
    .optional()
    .describe("수리된 추천 전공 목록 (요청된 경우에만)"),
  strategyNotes: z
    .string()
    .optional()
    .describe("수리된 strategyNotes (요청된 경우에만)"),
  directionReasoning: z
    .string()
    .optional()
    .describe("수리된 directionReasoning (요청된 경우에만)"),
});

export type DiagnosisRepairResponse = z.infer<typeof repairResponseSchema>;

// ─────────────────────────────────────────────
// 프롬프트
// ─────────────────────────────────────────────

export const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가이자 생기부 진단 수리자입니다.
주어진 AI 진단 출력에서 "요청된 필드만" 수리하여 반환하세요.

## 수리 원칙

1. **최소 변경**: 위반이 지적한 필드만 다시 생성합니다. 요청되지 않은 필드는 출력에서 제외.
2. **컨텍스트 일관성**: 수리된 필드는 원본의 나머지 필드와 모순되면 안 됩니다.
3. **위반 해결**: 각 violation이 지적한 문제를 직접 해결합니다. 회피·희석 금지.
4. **원문 증거 준수**: 강한/약한 역량 데이터와 모순되는 새 내용 금지.
5. **길이 유지**: 원본과 비슷한 개수·길이를 유지합니다 (과도한 확장/축소 금지).

## 필드별 규칙

- **strengths**: 2~5건. 각 항목은 "[영역] 항목명 — 등급. 근거" 형식. 부정 단어("약함", "부족" 등) 금지.
- **weaknesses**: 2~4건. 각 항목은 "[영역] 항목명 — 등급. 개선" 형식. 강한 칭찬어 금지.
- **improvements**: 2~5건. priority=높음|중간|낮음, area/gap/action/outcome 모두 비어있지 않게.
- **recommendedMajors**: 1~3건. 학생의 강점·태그와 정합. 무관한 전공 금지.
- **strategyNotes**: 50자 이상, 500자 이하. strengths/weaknesses/improvements 결론과 정합.
- **directionReasoning**: 태그·역량 등급 근거 명시. 일반론 금지.`;

// ─────────────────────────────────────────────
// 컨텍스트 요약 (coherence-checker와 동일 구조 재사용)
// ─────────────────────────────────────────────

interface ContextSummary {
  strongItems: string[];
  weakItems: string[];
  tagsByArea: Map<string, { positive: number; negative: number }>;
}

function summarizeCompetencyContext(
  competencyScores: CompetencyScore[],
  activityTags: ActivityTag[],
): ContextSummary {
  const strongItems: string[] = [];
  const weakItems: string[] = [];

  for (const item of COMPETENCY_ITEMS) {
    const score = competencyScores.find(
      (s) =>
        s.competency_item === item.code &&
        (s.source === "manual" || s.source === "ai"),
    );
    const grade = score?.grade_value;
    if (!grade) continue;
    const label = `${COMPETENCY_AREA_LABELS[item.area]} > ${item.label} (${grade})`;
    if (grade === "A+" || grade === "A-") strongItems.push(label);
    else if (grade === "B-" || grade === "C") weakItems.push(label);
  }

  const tagsByArea = new Map<string, { positive: number; negative: number }>();
  for (const t of activityTags) {
    const itemCode = t.competency_item as CompetencyItemCode;
    const item = COMPETENCY_ITEMS.find((i) => i.code === itemCode);
    if (!item) continue;
    const areaLabel = COMPETENCY_AREA_LABELS[item.area];
    const entry = tagsByArea.get(areaLabel) ?? { positive: 0, negative: 0 };
    if (t.evaluation === "positive") entry.positive++;
    else if (t.evaluation === "negative") entry.negative++;
    tagsByArea.set(areaLabel, entry);
  }

  return { strongItems, weakItems, tagsByArea };
}

// ─────────────────────────────────────────────
// 사용자 프롬프트 빌더
// ─────────────────────────────────────────────

export function buildUserPrompt(
  diagnosis: DiagnosisGenerationResult,
  targetFields: string[],
  violationsByField: Map<string, Violation[]>,
  ctx: ContextSummary,
  studentInfo?: { targetMajor?: string },
): string {
  const parts: string[] = [];

  parts.push(`# 원본 컨텍스트 요약\n`);
  if (studentInfo?.targetMajor) {
    parts.push(`**희망 전공 계열**: ${studentInfo.targetMajor}`);
  }
  parts.push(
    `**강한 역량 (A+/A-)**: ${ctx.strongItems.length > 0 ? ctx.strongItems.join(", ") : "없음"}`,
  );
  parts.push(
    `**약한 역량 (B-/C)**: ${ctx.weakItems.length > 0 ? ctx.weakItems.join(", ") : "없음"}`,
  );
  if (ctx.tagsByArea.size > 0) {
    parts.push(`**영역별 태그 분포**:`);
    for (const [area, stats] of ctx.tagsByArea.entries()) {
      parts.push(`  - ${area}: 긍정 ${stats.positive} / 부정 ${stats.negative}`);
    }
  }

  parts.push(`\n# 원본 진단 (참조용, 요청 외 필드는 유지)\n`);
  parts.push(`**overallGrade**: ${diagnosis.overallGrade}`);
  parts.push(`**recordDirection**: ${diagnosis.recordDirection}`);
  parts.push(`**directionStrength**: ${diagnosis.directionStrength}`);
  parts.push(`**directionReasoning**: ${diagnosis.directionReasoning}`);
  parts.push(`**strengths** (${diagnosis.strengths.length}건):`);
  diagnosis.strengths.forEach((s, i) => parts.push(`  [${i}] ${s}`));
  parts.push(`**weaknesses** (${diagnosis.weaknesses.length}건):`);
  diagnosis.weaknesses.forEach((w, i) => parts.push(`  [${i}] ${w}`));
  parts.push(`**improvements** (${diagnosis.improvements.length}건):`);
  diagnosis.improvements.forEach((imp, i) =>
    parts.push(
      `  [${i}] priority=${imp.priority} area=${imp.area} gap="${imp.gap}" action="${imp.action}" outcome="${imp.outcome}"`,
    ),
  );
  parts.push(
    `**recommendedMajors**: ${diagnosis.recommendedMajors.join(", ") || "(없음)"}`,
  );
  parts.push(`**strategyNotes**: ${diagnosis.strategyNotes}`);

  parts.push(`\n# 수리 요청 필드 및 위반 내역\n`);
  for (const field of targetFields) {
    parts.push(`## ${field}`);
    const fieldViolations = violationsByField.get(field) ?? [];
    for (const v of fieldViolations) {
      parts.push(
        `- [${v.severity}] ${v.rule}${v.fieldPath ? ` (${v.fieldPath})` : ""}: ${v.message}`,
      );
    }
  }

  parts.push(
    `\n위 위반이 지적한 문제를 해결하도록 **요청된 필드만** 수리하여 반환하세요.`,
  );
  parts.push(
    `요청되지 않은 필드는 출력에서 제외합니다 (undefined/omit). 원본 필드의 개수와 길이를 크게 변경하지 마세요.`,
  );

  return parts.join("\n");
}

// ─────────────────────────────────────────────
// 수리 대상 필드 추출
// ─────────────────────────────────────────────

export function extractRepairTargetFields(violations: Violation[]): string[] {
  const grouped = groupViolationsByTopField(violations);
  const targets: string[] = [];
  for (const field of grouped.keys()) {
    if (REPAIRABLE_FIELDS.has(field)) targets.push(field);
  }
  // 안정적 순서
  return targets.sort();
}

// ─────────────────────────────────────────────
// Merge — 수리된 필드를 원본에 병합
// ─────────────────────────────────────────────

function mergeRepairedFields(
  original: DiagnosisGenerationResult,
  repaired: DiagnosisRepairResponse,
  targetFields: string[],
): DiagnosisGenerationResult {
  const next: DiagnosisGenerationResult = { ...original };
  if (targetFields.includes("strengths") && repaired.strengths) {
    next.strengths = repaired.strengths;
  }
  if (targetFields.includes("weaknesses") && repaired.weaknesses) {
    next.weaknesses = repaired.weaknesses;
  }
  if (targetFields.includes("improvements") && repaired.improvements) {
    next.improvements = repaired.improvements as DiagnosisImprovement[];
  }
  if (targetFields.includes("recommendedMajors") && repaired.recommendedMajors) {
    next.recommendedMajors = repaired.recommendedMajors;
  }
  if (
    targetFields.includes("strategyNotes") &&
    typeof repaired.strategyNotes === "string"
  ) {
    next.strategyNotes = repaired.strategyNotes.slice(0, 500);
  }
  if (
    targetFields.includes("directionReasoning") &&
    typeof repaired.directionReasoning === "string"
  ) {
    next.directionReasoning = repaired.directionReasoning;
  }
  return next;
}

// ─────────────────────────────────────────────
// 메인 진입점
// ─────────────────────────────────────────────

/**
 * L1+L2 error violations 기반 진단 부분 재생성.
 * error가 없거나 수리 가능한 필드가 없으면 원본 그대로 반환 (LLM 호출 0회).
 *
 * 실패(LLM 에러, timeout) 시 호출부에서 non-fatal로 처리 권장.
 */
export async function repairDiagnosis(
  diagnosis: DiagnosisGenerationResult,
  violations: Violation[],
  competencyScores: CompetencyScore[],
  activityTags: ActivityTag[],
  studentInfo?: { targetMajor?: string },
): Promise<RepairResult<DiagnosisGenerationResult>> {
  const errors = extractErrorViolations(violations);
  if (errors.length === 0) {
    return {
      repaired: false,
      output: diagnosis,
      repairedFieldPaths: [],
      remainingViolations: violations,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const targetFields = extractRepairTargetFields(errors);
  if (targetFields.length === 0) {
    return {
      repaired: false,
      output: diagnosis,
      repairedFieldPaths: [],
      remainingViolations: violations,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const violationsByField = groupViolationsByTopField(errors);
  const ctx = summarizeCompetencyContext(competencyScores, activityTags);
  const userPrompt = buildUserPrompt(
    diagnosis,
    targetFields,
    violationsByField,
    ctx,
    studentInfo,
  );

  const result = await generateObjectWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    schema: zodSchema(repairResponseSchema),
    modelTier: "fast",
    temperature: 0.2,
    maxTokens: 3072,
    timeoutMs: 90_000,
  });

  const response = result.object as DiagnosisRepairResponse;
  const merged = mergeRepairedFields(diagnosis, response, targetFields);

  // Monitor: L1 재검증 — 남은 위반 보고 (재시도는 하지 않음, MAX=1)
  const { validateDiagnosisOutput } = await import("./diagnosis-validator");
  const revalidation = validateDiagnosisOutput(merged);

  return {
    repaired: true,
    output: merged,
    repairedFieldPaths: targetFields,
    remainingViolations: revalidation.violations,
    usage: result.usage,
  };
}
