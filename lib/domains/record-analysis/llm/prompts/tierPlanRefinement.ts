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
import type {
  BlueprintGap,
  MultiScenarioBlueprintGap,
  ScenarioType,
} from "@/lib/domains/student-record/types/blueprint-gap";
import type { HakjongScore } from "@/lib/domains/student-record/types/student-state";

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
  /**
   * α3-4 (2026-04-20): 청사진 GAP 엔진 결과.
   * 학생 StudentState × Blueprint 목표의 거리. priority/summary + axisGaps.
   * null 이면 섹션 생략 — GAP 엔진 미적용 학생 또는 blueprint 미수립.
   * 있으면 LLM 이 "gap 큰 축이 속한 tier" 를 우선 개정 대상으로 식별.
   */
  blueprintGap?: BlueprintGap | null;
  /**
   * α3-3-2 (2026-04-20): 3 시나리오(baseline/stable/aggressive) GAP.
   * dominantScenario 가 baseline 과 다르면 "대안 경로" 힌트로 프롬프트에 추가.
   * baseline 우세/빈 targets 일 경우 섹션 생략. blueprintGap 과 중복이지만
   * LLM 이 "현 plan 유지 vs 목표 ±1등급 조정" 축으로 판단하게 돕는 신호.
   */
  multiScenarioGap?: MultiScenarioBlueprintGap | null;
  /**
   * α2 Step C (2026-04-20): 학종 Reward 맥락 (v1 + v2-pre 병행).
   * 전 영역 null 또는 total null 이면 섹션 생략 — 계산 불가 상태.
   * LLM 이 "현 Reward 낮은 영역" 을 tier_plan 중점 대상으로 식별하도록 돕는 신호.
   * 가이드라인: 전체 섹션 ≤ 300자 (프롬프트 토큰 비용 가드).
   */
  hakjongScore?: HakjongScore | null;
  hakjongScoreV2Pre?: HakjongScore | null;
  /**
   * 격차 C (2026-04-26): MidPipeline Planner focusHypothesis 섹션.
   * buildMidPlanSynthesisSection() 결과. undefined/"" 이면 섹션 생략.
   * tier_plan 개정 방향이 핵심 탐구 축 가설과 정합되도록 LLM 에 힌트 제공.
   */
  midPlanSynthesisSection?: string;
  /**
   * 격차 1 다학년 통합: 학년별 MidPlan 분포 섹션. buildMidPlanByGradeSection() 결과.
   * tier_plan 개정 시 학년 간 탐구 축 연속성/변화 지점을 반영하기 위해 주입. 없으면 생략.
   */
  midPlanByGradeSection?: string;
  /** Phase B G1: 세특 8단계 서사 완성도 섹션. 없으면 생략. */
  narrativeArcSection?: string;
  /** Phase B G2: hyperedge(N-ary 수렴 테마) 요약 섹션. 없으면 생략. */
  hyperedgeSummarySection?: string;
  /**
   * Phase C A1: 직전 실행 미해결 격차 섹션 (previousRunOutputs 기반).
   * undefined/"" 이면 섹션 생략. tier_plan 개정 시 직전 실행에서 미해결된
   * 면접/로드맵 격차를 반영하도록 LLM 에 힌트 제공.
   */
  previousRunOutputsSection?: string;
  /** Phase C A3: 학년 지배 교과 교차 테마 섹션 (buildGradeThemesSection() 결과). 없으면 생략. */
  gradeThemesSection?: string;
  /** Phase C A6: 학생 정체성 프로필 카드 텍스트 (ctx.belief.profileCard). 없으면 생략. */
  profileCardSection?: string;
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
6. **청사진 GAP 우선** (제공 시): 입력 하단의 "청사진 GAP" 섹션은 학생 StudentState ↔ Blueprint 목표의 축별 거리.
   priority='high'/'medium' 인 axisGap 이 속한 tier 의 suggested_activities 를 그 축을 강화하는 방향으로 우선 개정.
   'mismatch' 패턴은 실측 데이터 확보 활동(예: 관련 세특/독서 집중)을, 'latent' 는 해당 역량 진입 경로 제시.
7. **시나리오 브랜치 비교** (제공 시): 입력 하단의 "시나리오 비교" 섹션은 각 목표 등급을 −1 / 0 / +1 로 시프트한 3 브랜치.
   dominantScenario 가 'aggressive' 이면 현 baseline 이 학생의 성장 여력을 과소평가했을 가능성 — advanced tier 를 공세적으로 개정.
   'stable' 이면 현 baseline 이 과도한 부담 — development/advanced 의 범위를 현실화해 step-down.
   'baseline' 이 dominant 이면 현 목표가 균형적 — 현 plan 을 유지하고 미세 보강만.
8. **학종 Reward 맥락** (제공 시): "학종 Reward 맥락" 섹션의 영역별 점수(학업/진로/공동체)는 0~100 스케일.
   65 미만인 영역은 해당 tier 의 suggested_activities 에 그 영역 강화 활동을 우선 배치.
   v2-pre delta 가 음수(−) 로 크면 aux(봉사·수상·출결) 보강이 부족 — community tier 활동에 구체 aux 근거 확보 활동 포함.
9. **탐구 축 가설 정합** (제공 시): 입력 하단의 "MidPlan 탐구 축 가설" 섹션은 컨설턴트가 설정한 핵심 탐구 초점.
   focusHypothesis 에서 제시된 탐구 방향이 tier_plan 의 key_questions·suggested_activities 에 반영되어야 한다.
   concernFlags 가 있으면 해당 우려 영역을 tier 내 보강 활동으로 명시.
10. **JSON 형식**: 설명/서론/주석 금지.

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

  if (input.blueprintGap) {
    sections.push(...renderBlueprintGapSection(input.blueprintGap));
  }

  const scenarioSection = renderScenarioCompareSection(input.multiScenarioGap);
  if (scenarioSection.length > 0) {
    sections.push(...scenarioSection);
  }

  const rewardSection = renderHakjongRewardSection(
    input.hakjongScore ?? null,
    input.hakjongScoreV2Pre ?? null,
  );
  if (rewardSection.length > 0) {
    sections.push(...rewardSection);
  }

  // 격차 C (2026-04-26): MidPlan focusHypothesis 섹션 주입
  if (input.midPlanSynthesisSection && input.midPlanSynthesisSection.trim().length > 0) {
    sections.push(input.midPlanSynthesisSection, "");
  }

  // 격차 1 다학년 통합: 학년별 MidPlan 분포 주입
  if (input.midPlanByGradeSection && input.midPlanByGradeSection.trim().length > 0) {
    sections.push(input.midPlanByGradeSection, "");
  }

  // Phase B G1: narrativeArc 8단계 서사 완성도 주입
  if (input.narrativeArcSection && input.narrativeArcSection.trim().length > 0) {
    sections.push(input.narrativeArcSection, "");
  }

  // Phase B G2: hyperedge(N-ary 수렴 테마) 주입
  if (input.hyperedgeSummarySection && input.hyperedgeSummarySection.trim().length > 0) {
    sections.push(input.hyperedgeSummarySection, "");
  }

  // Phase C A1: 직전 실행 미해결 격차 주입
  if (input.previousRunOutputsSection && input.previousRunOutputsSection.trim().length > 0) {
    sections.push(input.previousRunOutputsSection, "");
  }

  // Phase C A3: 학년 지배 교과 교차 테마 주입
  if (input.gradeThemesSection && input.gradeThemesSection.trim().length > 0) {
    sections.push(input.gradeThemesSection, "");
  }

  // Phase C A6: 학생 정체성 프로필 카드 주입
  if (input.profileCardSection && input.profileCardSection.trim().length > 0) {
    sections.push(input.profileCardSection, "");
  }

  sections.push(
    `위 정보를 바탕으로 **현 tier_plan 을 학생의 실제 학습 궤적에 맞춰 개정**한 main_exploration 을 JSON 으로 출력하세요.`,
    `격차가 미미하면 미세 보강만, 의미 있는 격차가 있으면 해당 tier 의 활동·질문을 재구성하세요.`,
    input.blueprintGap && input.blueprintGap.priority !== "low"
      ? `**청사진 GAP priority=${input.blueprintGap.priority}**. 위 axisGaps 가 속한 tier 를 우선 개정하세요.`
      : "",
    input.multiScenarioGap && input.multiScenarioGap.dominantScenario && input.multiScenarioGap.dominantScenario !== "baseline"
      ? `**dominantScenario=${input.multiScenarioGap.dominantScenario}**. 원칙 #7 에 따라 tier_plan 의 공세/현실화 방향을 선택하세요.`
      : "",
    input.previousRunOutputsSection && input.previousRunOutputsSection.trim().length > 0
      ? `직전 실행 미해결 격차가 제공된 경우, 해당 격차를 보완하는 방향으로 적합한 tier 의 활동·질문을 우선 개정하세요.`
      : "",
  );

  return sections.filter((s) => s !== "").join("\n");
}

// α3-4 (2026-04-20): blueprintGap 섹션 렌더 — LLM 이 gap 큰 tier 를 우선 식별.
function renderBlueprintGapSection(gap: BlueprintGap): string[] {
  const AREA_KO: Record<string, string> = {
    academic: "학업",
    career: "진로",
    community: "공동체",
  };
  const PATTERN_KO: Record<string, string> = {
    insufficient: "부족",
    excess: "과잉",
    mismatch: "불일치",
    latent: "잠재",
  };

  const lines: string[] = [
    `## 청사진 GAP (우선 개정 대상)`,
    `- priority: ${gap.priority.toUpperCase()}`,
    `- remainingSemesters: ${gap.remainingSemesters}`,
    `- summary: ${gap.summary}`,
  ];

  const areaLines: string[] = [];
  for (const [area, g] of Object.entries(gap.areaGaps)) {
    if (g.gapSize === null) continue;
    areaLines.push(
      `  · ${AREA_KO[area] ?? area}: gap ${g.gapSize > 0 ? "+" : ""}${g.gapSize} (${g.currentScore ?? "—"} → ${g.targetScore ?? "—"})`,
    );
  }
  if (areaLines.length > 0) {
    lines.push(`- areaGaps:`, ...areaLines);
  }

  if (gap.axisGaps.length > 0) {
    lines.push(`- axisGaps (상위 ${Math.min(4, gap.axisGaps.length)}):`);
    for (const a of gap.axisGaps.slice(0, 4)) {
      lines.push(
        `  · [${PATTERN_KO[a.pattern] ?? a.pattern}] ${a.code}: ${a.rationale}`,
      );
    }
  }
  lines.push("");
  return lines;
}

// α2 Step C (2026-04-20): 학종 Reward 맥락 섹션 (≤ 300자 가드).
// - v1 total null 이면 생략 (계산 불가)
// - v2-pre 는 있으면 delta 만 1줄 추가
// - 영역별 점수는 0~100 반올림, confidence 는 정수 %
function renderHakjongRewardSection(
  v1: HakjongScore | null,
  v2Pre: HakjongScore | null,
): string[] {
  if (!v1 || v1.total === null) return [];

  const roundOrDash = (n: number | null): string =>
    n === null ? "—" : `${Math.round(n)}`;

  const confPct = Math.round((v1.confidence.total ?? 0) * 100);

  const lines: string[] = [
    `## 학종 Reward 맥락`,
    `- v1 total: ${Math.round(v1.total)} (conf ${confPct}%) · 학업 ${roundOrDash(v1.academic)} / 진로 ${roundOrDash(v1.career)} / 공동체 ${roundOrDash(v1.community)}`,
  ];

  if (v2Pre && v2Pre.total !== null) {
    const delta = Math.round((v2Pre.total - v1.total) * 10) / 10;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    lines.push(
      `- v2-pre total: ${Math.round(v2Pre.total)} (aux 연속 기여, v1 대비 ${deltaStr})`,
    );
  }

  lines.push("");
  return lines;
}

// α3-3-2 (2026-04-20): 3 시나리오 비교 섹션 렌더.
// dominantScenario 가 null 이거나 모든 브랜치가 동일 priority 이면 생략 — LLM 에 노이즈 증가만.
function renderScenarioCompareSection(
  multi: MultiScenarioBlueprintGap | null | undefined,
): string[] {
  if (!multi || !multi.dominantScenario) return [];

  const SCENARIO_KO: Record<ScenarioType, string> = {
    baseline: "기본(현 목표)",
    stable: "보수(각 목표 −1등급)",
    aggressive: "공격(각 목표 +1등급)",
  };

  const maxAreaGap = (gap: BlueprintGap): number | null => {
    const xs = [
      gap.areaGaps.academic.gapSize,
      gap.areaGaps.career.gapSize,
      gap.areaGaps.community.gapSize,
    ].filter((v): v is number => v !== null);
    if (xs.length === 0) return null;
    return Math.max(...xs);
  };

  const entries: ReadonlyArray<[ScenarioType, BlueprintGap | null]> = [
    ["baseline", multi.baseline],
    ["stable", multi.stable],
    ["aggressive", multi.aggressive],
  ];

  const priorityLevels = new Set<string>();
  for (const [, g] of entries) if (g) priorityLevels.add(g.priority);

  // 모든 시나리오 priority 동일 + dominantScenario === baseline → 추가 신호 없음.
  if (priorityLevels.size <= 1 && multi.dominantScenario === "baseline") return [];

  const lines: string[] = [
    `## 시나리오 비교 (브랜치 탐색)`,
    `- dominantScenario: ${multi.dominantScenario} (${SCENARIO_KO[multi.dominantScenario]})`,
  ];
  for (const [scenario, g] of entries) {
    if (!g) {
      lines.push(`  · ${scenario}: 미계산`);
      continue;
    }
    const max = maxAreaGap(g);
    const maxStr = max !== null ? (max > 0 ? `+${Math.round(max * 10) / 10}` : `${Math.round(max * 10) / 10}`) : "—";
    lines.push(
      `  · ${scenario} [${g.priority.toUpperCase()}]: max area gap ${maxStr} · axisGaps ${g.axisGaps.length}건`,
    );
  }
  lines.push("");
  return lines;
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
