// ============================================
// L4-D / L2 Coherence Checker — ai_diagnosis 의미 정합성 검증
//
// Deterministic(L1)이 구조/길이/중복을 검사한다면 본 모듈은 Flash 모델로
// 진단 출력 간 의미 정합성을 LLM-judge 방식으로 검증한다.
//
// 가이드 도메인 c3.3-v1 coherence-checker.ts 패턴 이식.
// LLM 호출 1회 추가 (fast tier, temperature 0.1, ~60s timeout).
// ============================================

import { z } from "zod";
import { zodSchema } from "ai";
import type { CompetencyScore, ActivityTag, CompetencyItemCode } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record/constants";
import { generateObjectWithRateLimit } from "../ai-client";
import type { Violation, ValidationResult } from "./types";
import { summarizeViolations } from "./types";
import type { DiagnosisGenerationResult } from "../actions/generateDiagnosis";

// ─────────────────────────────────────────────
// LLM 응답 스키마
// ─────────────────────────────────────────────

const COHERENCE_RULES = [
  "STRENGTHS_SCORE_MISMATCH",
  "WEAKNESSES_SCORE_MISMATCH",
  "IMPROVEMENTS_WEAKNESS_LINK",
  "RECOMMENDED_MAJORS_COHERENCE",
  "DIRECTION_REASONING_EVIDENCE",
  "STRATEGY_NOTES_ALIGNMENT",
] as const;

const coherenceViolationSchema = z.object({
  rule: z.enum(COHERENCE_RULES).describe("위반된 규칙 ID"),
  severity: z
    .enum(["error", "warning"])
    .describe("심각도: error=재생성 필요, warning=개선 권장"),
  message: z.string().describe("구체적 위반 설명 (한국어, 1~2문장). 어떤 항목이 어떤 근거와 모순되는지 명시."),
  fieldPath: z.string().optional().describe("위반 발생 필드 경로 (예: strengths[0], improvements[1].action)"),
});

const coherenceResponseSchema = z.object({
  violations: z
    .array(coherenceViolationSchema)
    .describe("감지된 의미 정합성 위반 목록. 위반이 없으면 빈 배열."),
});

export type CoherenceResponse = z.infer<typeof coherenceResponseSchema>;

export interface DiagnosisCoherenceResult extends ValidationResult {
  /** Flash 모델 사용 토큰 */
  usage?: { inputTokens: number; outputTokens: number };
}

// ─────────────────────────────────────────────
// 시스템 프롬프트
// ─────────────────────────────────────────────

export const SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가이자 생기부 진단 결과의 검수자입니다.
주어진 AI 진단 출력을 원본 역량/태그 데이터와 대조하여 "의미 정합성" 위반만 검사하세요.

## 검사 규칙 6가지

1. **STRENGTHS_SCORE_MISMATCH**: strengths에서 언급한 역량이 실제로는 B-/C 등급인 경우.
   - error: 해당 역량이 명백히 약한 등급(B-/C)인데 강점으로 주장
   - warning: B 등급인데 근거 설명이 과도한 경우

2. **WEAKNESSES_SCORE_MISMATCH**: weaknesses에서 언급한 역량이 실제로는 A+/A-인 경우 (모순).
   - error: 해당 역량이 A+/A- 등급인데 약점으로 주장
   - warning: B+ 등급인데 과도하게 약점으로 강조

3. **IMPROVEMENTS_WEAKNESS_LINK**: improvements의 각 항목이 weaknesses의 내용과 연관되는지.
   - error: improvement가 weaknesses에서 전혀 다뤄지지 않은 무관한 주제
   - warning: 연결이 약하거나 우회적

4. **RECOMMENDED_MAJORS_COHERENCE**: 추천 전공이 학생의 강점·태그·recordDirection에서 자연스럽게 도출되는지.
   - error: 명백히 정합되지 않는 추천 (예: 수학/과학 강점 없이 공학 추천)
   - warning: 정합은 되나 뒷받침이 약한 경우

5. **DIRECTION_REASONING_EVIDENCE**: directionReasoning이 실제 태그·역량 등급에 근거한 서술인지.
   - error: 근거 없이 날조된 내용 (태그/등급 데이터와 충돌)
   - warning: 근거가 피상적이거나 일반론에 그침

6. **STRATEGY_NOTES_ALIGNMENT**: strategyNotes가 strengths/weaknesses/improvements의 결론과 정합되는지.
   - error: 본문과 모순되는 지침 (예: 약점이 탐구인데 탐구 강화 불필요로 기술)
   - warning: 본문에서 언급되지 않은 새 주제를 도입

## 출력 지침

- 위반이 없으면 violations를 빈 배열로 반환하세요.
- 각 message는 구체적이어야 합니다. 어떤 항목이 어떤 근거와 어떻게 모순되는지 명시.
- 불확실한 위반은 보고하지 마세요. 명확한 경우만 보고합니다.
- severity 판단: 진단이 상담에 오해를 유발하면 error, 아쉽지만 활용 가능하면 warning.
- fieldPath는 가능하면 제공 (strengths[0], improvements[2].action 등).`;

// ─────────────────────────────────────────────
// 사용자 프롬프트 빌더 — 원본 컨텍스트 요약
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
      (s) => s.competency_item === item.code && (s.source === "manual" || s.source === "ai"),
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

export function buildUserPrompt(
  diagnosis: DiagnosisGenerationResult,
  ctx: ContextSummary,
  studentInfo?: { targetMajor?: string },
): string {
  const parts: string[] = [];

  parts.push(`# 원본 컨텍스트 요약\n`);

  if (studentInfo?.targetMajor) {
    parts.push(`**희망 전공 계열**: ${studentInfo.targetMajor}`);
  }

  parts.push(`**강한 역량 (A+/A-)**: ${ctx.strongItems.length > 0 ? ctx.strongItems.join(", ") : "없음"}`);
  parts.push(`**약한 역량 (B-/C)**: ${ctx.weakItems.length > 0 ? ctx.weakItems.join(", ") : "없음"}`);

  if (ctx.tagsByArea.size > 0) {
    parts.push(`**영역별 태그 분포**:`);
    for (const [area, stats] of ctx.tagsByArea.entries()) {
      parts.push(`  - ${area}: 긍정 ${stats.positive} / 부정 ${stats.negative}`);
    }
  }

  parts.push(`\n# 검증 대상 진단 출력\n`);
  parts.push(`**overallGrade**: ${diagnosis.overallGrade}`);
  parts.push(`**recordDirection**: ${diagnosis.recordDirection}`);
  parts.push(`**directionStrength**: ${diagnosis.directionStrength}`);
  parts.push(`**directionReasoning**: ${diagnosis.directionReasoning}`);

  parts.push(`\n**strengths** (${diagnosis.strengths.length}건):`);
  diagnosis.strengths.forEach((s, i) => parts.push(`  [${i}] ${s}`));

  parts.push(`\n**weaknesses** (${diagnosis.weaknesses.length}건):`);
  diagnosis.weaknesses.forEach((w, i) => parts.push(`  [${i}] ${w}`));

  parts.push(`\n**improvements** (${diagnosis.improvements.length}건):`);
  diagnosis.improvements.forEach((imp, i) => {
    parts.push(
      `  [${i}] priority=${imp.priority} area=${imp.area} gap="${imp.gap}" action="${imp.action}" outcome="${imp.outcome}"`,
    );
  });

  parts.push(`\n**recommendedMajors**: ${diagnosis.recommendedMajors.join(", ") || "(없음)"}`);
  parts.push(`\n**strategyNotes**: ${diagnosis.strategyNotes}`);

  parts.push(
    `\n\n위 원본 컨텍스트(강한/약한 역량, 태그 분포)와 진단 출력을 대조하여 6개 규칙 기준으로 의미 정합성 위반을 감지하세요.`,
  );

  return parts.join("\n");
}

// ─────────────────────────────────────────────
// 메인 진입점
// ─────────────────────────────────────────────

/**
 * ai_diagnosis 출력에 대한 L2 Coherence Check.
 * Flash 모델(fast tier) 1회 호출.
 *
 * 실패(LLM 에러, timeout) 시 호출부에서 non-fatal로 처리 권장.
 */
export async function checkDiagnosisCoherence(
  diagnosis: DiagnosisGenerationResult,
  competencyScores: CompetencyScore[],
  activityTags: ActivityTag[],
  studentInfo?: { targetMajor?: string },
): Promise<DiagnosisCoherenceResult> {
  const ctx = summarizeCompetencyContext(competencyScores, activityTags);
  const userPrompt = buildUserPrompt(diagnosis, ctx, studentInfo);

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
