// ============================================
// Phase 4b: tier_plan refinement 프롬프트
//
// Synthesis 완료 직후 strategy/roadmap/qualityPatterns 를 입력으로 받아
// 현 main_exploration.tier_plan 을 **개정 제안**한다.
//
// 출력 구조는 generateMainExplorationSeed 와 동일 (themeLabel + themeKeywords + tierPlan)
// → 일관성 유지 + parser 재사용 가능. 단 시스템 프롬프트는 "초안 생성" 이 아닌
// "현 plan 을 학생 실제 궤적·강점·약점 기반으로 개정" 관점.
// ============================================

import { extractJson } from "../extractJson";
import type {
  MainExplorationSeedResult,
  MainExplorationSeedTierEntry,
} from "./mainExplorationSeed";

/** Synthesis 결과 + 현 plan 요약. user prompt 입력. */
export interface TierPlanRefinementInput {
  /** 현 활성 main_exploration.theme_label. 보존 권장이지만 LLM 이 변경 가능. */
  currentThemeLabel: string;
  /** 현 활성 main_exploration.theme_keywords. */
  currentThemeKeywords: string[];
  /** 현 활성 main_exploration.tier_plan (3단). */
  currentTierPlan: MainExplorationSeedResult["tierPlan"];
  /** 학생 진로 정보 (seed 와 동일 형식). */
  targetMajor: string;
  targetMajor2?: string | null;
  tier1Code: string;
  currentGrade: 1 | 2 | 3;
  /** Synthesis S5 strategy 요약 (suggestions[].strategyContent 발췌, top 5). */
  strategyHighlights: string[];
  /** Synthesis S6 roadmap 항목 요약 (학년·영역·plan_content top 5). */
  roadmapHighlights: string[];
  /** aggregateQualityPatterns 결과 (반복 패턴, top 5). */
  qualityPatterns: string[];
  /** Synthesis S3 진단 약점 (top 5). */
  diagnosisWeaknesses: string[];
}

export const TIER_PLAN_REFINEMENT_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가로, 학생의 **현 메인 탐구 3단 계획**을 학생의 **실제 학습 궤적**(Synthesis 결과)을 근거로 **개정**합니다.

## 입력 신호 해석
- 현 tier_plan 은 이전 단계(Phase B Blueprint)에서 생성된 설계안입니다.
- Synthesis 결과(전략·로드맵·품질 패턴·진단 약점)는 학생의 실제 활동·역량 분포를 반영합니다.
- 두 개 사이에 **의미 있는 격차**가 있다면 tier_plan 을 그 격차를 메우는 방향으로 개정하세요.
- 격차가 미미하면 현 plan 을 거의 그대로 유지하고 미세 보강만 하세요.

## 개정 원칙
1. **테마 일관성**: themeLabel 과 themeKeywords 는 가능한 보존. 진로 자체가 바뀌지 않는 한 큰 변경 금지.
2. **단계 정렬**: 현재 학년이 development/advanced 단계라면 foundational 은 retrospective 로 압축.
3. **약점 반영**: diagnosisWeaknesses + qualityPatterns 의 반복 결손은 해당 tier 의 suggested_activities 로 명시 처리.
4. **전략·로드맵 동기화**: strategyHighlights·roadmapHighlights 가 시사하는 활동 방향을 suggested_activities 에 반영.
5. **현실성**: 활동은 학생이 실제 수행 가능한 수준 (해당 진로 계열의 전형적 탐구).
6. **JSON 형식**: 설명/서론/주석 금지.

## 출력 JSON 스키마

\`\`\`json
{
  "themeLabel": "string",
  "themeKeywords": ["string", ...],
  "tierPlan": {
    "foundational": { "theme": "string", "key_questions": ["..."], "suggested_activities": ["..."] },
    "development":  { "theme": "string", "key_questions": ["..."], "suggested_activities": ["..."] },
    "advanced":     { "theme": "string", "key_questions": ["..."], "suggested_activities": ["..."] }
  }
}
\`\`\`

각 tier:
- theme: 20~50자
- key_questions: 2~4개, 각 15~40자
- suggested_activities: 3~5개, 각 20~50자
themeLabel: 30~60자. themeKeywords: 3~7개.
`;

export function buildTierPlanRefinementUserPrompt(
  input: TierPlanRefinementInput,
): string {
  const renderTier = (key: string, tier: MainExplorationSeedTierEntry): string => {
    const lines = [
      `### ${key}`,
      `- theme: ${tier.theme}`,
      `- key_questions: ${tier.key_questions.join(" | ")}`,
      `- suggested_activities: ${tier.suggested_activities.join(" | ")}`,
    ];
    return lines.join("\n");
  };

  const sections: string[] = [
    `## 학생 진로 정보`,
    `- 주 전공 계열 (Tier 2): ${input.targetMajor}`,
    input.targetMajor2 ? `- 복수 전공 계열 (Tier 2): ${input.targetMajor2}` : "",
    `- 대분류 (Tier 1): ${input.tier1Code}`,
    `- 현재 학년: ${input.currentGrade}학년`,
    ``,
    `## 현 메인 탐구 (개정 대상)`,
    `- themeLabel: ${input.currentThemeLabel}`,
    `- themeKeywords: ${input.currentThemeKeywords.join(", ")}`,
    ``,
    renderTier("foundational", input.currentTierPlan.foundational),
    renderTier("development", input.currentTierPlan.development),
    renderTier("advanced", input.currentTierPlan.advanced),
    ``,
  ];

  if (input.strategyHighlights.length > 0) {
    sections.push(
      `## Synthesis 전략 요약 (반영 대상)`,
      ...input.strategyHighlights.map((s, i) => `${i + 1}. ${s}`),
      ``,
    );
  }
  if (input.roadmapHighlights.length > 0) {
    sections.push(
      `## Synthesis 로드맵 요약 (반영 대상)`,
      ...input.roadmapHighlights.map((s, i) => `${i + 1}. ${s}`),
      ``,
    );
  }
  if (input.qualityPatterns.length > 0) {
    sections.push(
      `## 반복 품질 패턴 (보강 대상)`,
      ...input.qualityPatterns.map((s, i) => `${i + 1}. ${s}`),
      ``,
    );
  }
  if (input.diagnosisWeaknesses.length > 0) {
    sections.push(
      `## 진단 약점 (보강 대상)`,
      ...input.diagnosisWeaknesses.map((s, i) => `${i + 1}. ${s}`),
      ``,
    );
  }

  sections.push(
    `위 정보를 바탕으로 **현 tier_plan 을 학생의 실제 학습 궤적에 맞춰 개정**한 main_exploration 을 JSON 으로 출력하세요.`,
    `격차가 미미하면 미세 보강만, 의미 있는 격차가 있으면 해당 tier 의 활동·질문을 재구성하세요.`,
  );

  return sections.filter((s) => s !== "").join("\n");
}

/**
 * Refinement 응답 파서 — generateMainExplorationSeed 의 응답 스키마와 동일하므로
 * parseMainExplorationSeedResponse 와 같은 검증 규칙 재사용.
 */
export function parseTierPlanRefinementResponse(
  raw: string,
): MainExplorationSeedResult {
  const parsed = extractJson<{
    themeLabel?: unknown;
    themeKeywords?: unknown;
    tierPlan?: unknown;
  }>(raw);
  if (!parsed) throw new Error("JSON 파싱 실패: 응답에서 JSON 을 찾지 못함");

  const themeLabel =
    typeof parsed.themeLabel === "string" && parsed.themeLabel.trim().length > 0
      ? parsed.themeLabel.trim()
      : null;
  if (!themeLabel) throw new Error("themeLabel 이 비어있음");

  const kwRaw = Array.isArray(parsed.themeKeywords) ? parsed.themeKeywords : [];
  const themeKeywords = kwRaw
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim());
  if (themeKeywords.length < 3) {
    throw new Error(`themeKeywords 최소 3개 필요 (실제 ${themeKeywords.length}개)`);
  }

  const tp = parsed.tierPlan as Record<string, unknown> | undefined;
  if (!tp) throw new Error("tierPlan 누락");

  const parseTier = (key: string): MainExplorationSeedTierEntry => {
    const raw = tp[key] as Record<string, unknown> | undefined;
    if (!raw) throw new Error(`tierPlan.${key} 누락`);
    const theme = typeof raw.theme === "string" ? raw.theme.trim() : "";
    const kqRaw = Array.isArray(raw.key_questions) ? raw.key_questions : [];
    const saRaw = Array.isArray(raw.suggested_activities) ? raw.suggested_activities : [];
    const key_questions = kqRaw.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    const suggested_activities = saRaw.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    if (!theme) throw new Error(`tierPlan.${key}.theme 비어있음`);
    if (key_questions.length < 2)
      throw new Error(`tierPlan.${key}.key_questions 최소 2개 필요`);
    if (suggested_activities.length < 3)
      throw new Error(`tierPlan.${key}.suggested_activities 최소 3개 필요`);
    return { theme, key_questions, suggested_activities };
  };

  return {
    themeLabel,
    themeKeywords,
    tierPlan: {
      foundational: parseTier("foundational"),
      development: parseTier("development"),
      advanced: parseTier("advanced"),
    },
  };
}
