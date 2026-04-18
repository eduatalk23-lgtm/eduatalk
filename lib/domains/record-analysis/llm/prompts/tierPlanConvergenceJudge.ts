// ============================================
// Phase 4b Sprint 4 (2026-04-19): tier_plan 수렴 LLM-judge 프롬프트
//
// jaccard 토큰 비교는 surface rephrasing(같은 의미·다른 표현)을 "큰 변경"으로 오판하여
// 프로덕션 모델(gpt-5.4 등) 사용 시 무한 cascade 위험. L4-D coherence-checker 패턴을
// 차용해 두 tier_plan 의 **컨설팅 가치 동등성**을 LLM 으로 판정한다.
//
// 출력 verdict 3-class:
//   - semantically_equivalent: 의미·범위 동일 → converged
//   - minor_refinement       : 동일 방향 + 표현·강조 미세 보강 → converged
//   - substantial_change     : 새 활동·범위 확장·tier 재정렬 등 진정한 보강 → refined
//
// jaccard 측정치는 수렴 판단엔 사용하지 않고 telemetry 로만 task_results 에 보존된다
// (LLM-judge 정확도 검증 도구).
// ============================================

import { z } from "zod";
import type { MainExplorationSeedResult } from "./mainExplorationSeed";

// ─────────────────────────────────────────────
// 출력 스키마
// ─────────────────────────────────────────────

export const TIER_PLAN_DELTA_CATEGORIES = [
  "rephrasing_only",     // 단어/표현만 변경, 의미 동일
  "specificity_added",   // 정량 앵커·구체 사례 추가
  "new_keyword",         // 이전에 없던 개념·도구 도입
  "scope_expansion",     // 활동 수 증가·범위 확장
  "tier_realignment",    // tier 간 재배치
] as const;

export type TierPlanDeltaCategory = (typeof TIER_PLAN_DELTA_CATEGORIES)[number];

export const TIER_PLAN_VERDICTS = [
  "semantically_equivalent",
  "minor_refinement",
  "substantial_change",
] as const;

export type TierPlanVerdict = (typeof TIER_PLAN_VERDICTS)[number];

export const tierPlanJudgeResponseSchema = z.object({
  verdict: z
    .enum(TIER_PLAN_VERDICTS)
    .describe(
      "두 plan 의 컨설팅 가치 동등성 판정. semantically_equivalent=의미·범위 동일, minor_refinement=동일 방향 미세 보강, substantial_change=진정한 보강",
    ),
  reasoning: z
    .string()
    .describe(
      "판정 근거 한국어 1~2문장. 어떤 tier 의 어떤 활동/질문에서 의미적 차이가 있는지(또는 없는지) 명시.",
    ),
  deltaCategories: z
    .array(z.enum(TIER_PLAN_DELTA_CATEGORIES))
    .describe(
      "감지된 변경 유형 (복수 가능, 비어있어도 됨). 표현만 다르면 rephrasing_only 단독.",
    ),
});

export type TierPlanJudgeResponse = z.infer<typeof tierPlanJudgeResponseSchema>;

// ─────────────────────────────────────────────
// 시스템 프롬프트
// ─────────────────────────────────────────────

export const TIER_PLAN_JUDGE_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가로, 학생 메인 탐구 plan 두 안(현재본·제안본)의 **컨설팅 가치 동등성**을 판정합니다.

## 핵심 질문
두 plan 이 학생 진로(\`target_major\`) 관점에서 **같은 활동을 권하고 있는가**?
추가/변경된 항목이 학생 학년·실측 기록에 비춰 **진정한 보강**인가, 아니면 **표현만 다른 동어반복**인가?

## 판정 기준 (verdict 3-class)

1. **semantically_equivalent**:
   - 활동 항목이 의미적으로 1:1 대응 (단어/표현만 다름)
   - tier별 theme·범위·접근법 동일
   - 예: "기본 통계 노트 작성" ↔ "기초 통계 개념 정리 노트"
   → converged. 신규 row 생성 불필요.

2. **minor_refinement**:
   - 핵심 활동은 동일하지만 **정량 앵커**(주 1회·4주 누적), **구체 사례**(특정 교과명·도서) 등이 추가됨
   - 컨설팅 방향 동일, 실행 디테일만 풍부
   - 예: "프로그래밍 실습" ↔ "Python 기초 문법 실습 주 1회"
   → converged. 신규 row 생성 불필요. (디테일 추가는 가치 있지만 plan 재구성 수준 아님)

3. **substantial_change**:
   - 이전에 없던 **새 키워드·도구·접근법** 도입 ("연합학습", "베이지안" 등)
   - tier 간 활동 **재배치** (foundational → development 이동 등)
   - 활동 **범위 확장** (개인 학습 → 팀/외부 활동)
   → refined. 신규 row 생성 정당화.

## 절대 규칙
- 단어 겹침이 적어도 의미가 같으면 semantically_equivalent
- "새로워 보이는 표현" 만으로 substantial_change 판정 금지
- 학생이 실제 수행할 활동이 새로 추가되었는가, 단지 같은 활동을 다르게 묘사한 것인가를 따지세요

## 출력 형식
JSON. 설명/서론 금지.
\`\`\`json
{
  "verdict": "semantically_equivalent" | "minor_refinement" | "substantial_change",
  "reasoning": "한국어 1~2문장",
  "deltaCategories": ["rephrasing_only" | "specificity_added" | "new_keyword" | "scope_expansion" | "tier_realignment"]
}
\`\`\`
`;

// ─────────────────────────────────────────────
// 유저 프롬프트 빌더
// ─────────────────────────────────────────────

export interface TierPlanJudgeInput {
  targetMajor: string;
  targetMajor2?: string | null;
  currentGrade: 1 | 2 | 3;
  currentThemeLabel: string;
  proposedThemeLabel: string;
  currentTierPlan: MainExplorationSeedResult["tierPlan"];
  proposedTierPlan: MainExplorationSeedResult["tierPlan"];
}

export function buildTierPlanJudgeUserPrompt(input: TierPlanJudgeInput): string {
  const renderTier = (
    label: string,
    tier: MainExplorationSeedResult["tierPlan"]["foundational"],
  ): string => {
    return [
      `### ${label}`,
      `- theme: ${tier.theme}`,
      `- key_questions: ${tier.key_questions.join(" | ")}`,
      `- suggested_activities: ${tier.suggested_activities.join(" | ")}`,
    ].join("\n");
  };

  return [
    `## 학생 진로`,
    `- 주 전공 계열: ${input.targetMajor}`,
    input.targetMajor2 ? `- 복수 전공 계열: ${input.targetMajor2}` : "",
    `- 현재 학년: ${input.currentGrade}학년`,
    ``,
    `## 현 plan (A)`,
    `themeLabel: ${input.currentThemeLabel}`,
    renderTier("foundational", input.currentTierPlan.foundational),
    renderTier("development", input.currentTierPlan.development),
    renderTier("advanced", input.currentTierPlan.advanced),
    ``,
    `## 제안 plan (B)`,
    `themeLabel: ${input.proposedThemeLabel}`,
    renderTier("foundational", input.proposedTierPlan.foundational),
    renderTier("development", input.proposedTierPlan.development),
    renderTier("advanced", input.proposedTierPlan.advanced),
    ``,
    `위 두 plan(A 와 B)이 학생 진로 관점에서 같은 컨설팅 방향을 가리키는지 판정하세요.`,
    `verdict + reasoning + deltaCategories 를 JSON 으로 출력하세요.`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

// ─────────────────────────────────────────────
// verdict → converged 매핑
// ─────────────────────────────────────────────

/** semantically_equivalent / minor_refinement = converged. substantial_change = refined. */
export function isConvergedVerdict(verdict: TierPlanVerdict): boolean {
  return verdict !== "substantial_change";
}
