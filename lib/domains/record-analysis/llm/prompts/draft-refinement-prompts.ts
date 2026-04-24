// ============================================
// P9: draft_refinement — 가안 재생성 프롬프트 빌더
//
// Phase 5 Sprint 1 (2026-04-19): IMPROVE 논문 component-at-a-time iteration.
// P8 에서 overall_score<70 판정된 레코드를 이전 draft + 5축 score + issues + feedback 을
// 프롬프트에 주입하여 1회 재생성한다.
//
// Phase 5 Sprint 3 (2026-04-20): A/B variant 추가. 결정적 선택(record_id hash) 로 재실행 안정.
//   · v1_baseline       — Sprint 1/2 원본 프롬프트
//   · v2_axis_targeted  — 최하위 축(specificity/depth 등) 에 집중 개선 지시 추가
//
// ─── v1 vs v2 승격 판정 기준 (2주 측정 후 적용) ─────────────────────────────
//
// 대시보드/쿼리 소스:
//   · UI: /superadmin/pipeline-telemetry
//   · SQL: scripts/phase-5-telemetry-queries.sql (Q1~Q6)
//   · 런북: docs/phase-5-production-rollout-checklist.md
//
// 판정 분기 (각 variant 별 refined n ≥ 30 확보 후 적용 — 그 이전은 관찰만):
//
//   [A] v2 승격 (v2 고정, v1 제거):
//       v2.avgScoreDelta ≥ v1.avgScoreDelta + 2.0
//       AND v2.rollbackRate ≤ v1.rollbackRate + 5%p
//       AND v2.skipRate ≈ v1.skipRate (±5%p)
//       → 코드: selectRefinementVariant() 를 "v2_axis_targeted" 상수 반환으로 단순화
//
//   [B] v1 고정 (v2 폐기):
//       v2.avgScoreDelta < v1.avgScoreDelta
//       OR v2.rollbackRate > 15%
//       → 코드: v2 분기 제거, 1-variant 로 원복
//
//   [C] v3 설계 트리거 (프롬프트 엔지니어링 천장 재인식):
//       max(v1.avgScoreDelta, v2.avgScoreDelta) < +8.0
//       → Sprint 3 후속 브리프 작성. Cyclic 전환 Phase 4 로 승계 검토.
//
//   [D] 판정 보류 (계속 관찰):
//       위 A/B/C 중 어느 것도 해당하지 않음 — n 이 더 쌓일 때까지 대기
//
// max_retry 1 → 2 승격:
//   별도 판정. [A] 또는 [B] 확정 후 4주 운영 관찰 필요 (avgΔ 안정·rollback<5% 확인).
//   이 코드 블록에서는 다루지 않음.
//
// 롤백 절차 (긴급):
//   env off (ENABLE_DRAFT_REFINEMENT=false) → P9 runner 가 processed=0 으로 즉시 no-op.
//   이미 retry_count=1 로 마킹된 레코드는 재처리 안 됨 (guard 영속).
// ============================================

export type RefinementVariant = "v1_baseline" | "v2_axis_targeted";

export const REFINEMENT_VARIANTS: readonly RefinementVariant[] = [
  "v1_baseline",
  "v2_axis_targeted",
] as const;

export interface RefinementUserPromptInput {
  /** P7 빌더가 생성한 원본 user prompt 그대로 재활용 */
  originalUserPrompt: string;
  /** DB 에서 조회한 이전 ai_draft_content */
  previousDraft: string;
  /** content_quality.issues 배열 */
  issues: string[];
  /** content_quality.feedback 문자열 */
  feedback: string;
  /** content_quality 5축 점수 */
  axisScores: {
    specificity: number;
    coherence: number;
    depth: number;
    grammar: number;
    scientificValidity: number | null;
  };
  /** Sprint 3 A/B variant. 미지정 시 v1_baseline */
  variant?: RefinementVariant;
}

export function buildSetekRefinementUserPrompt(input: RefinementUserPromptInput): string {
  return buildRefinementUserPrompt(input);
}

export function buildChangcheRefinementUserPrompt(input: RefinementUserPromptInput): string {
  return buildRefinementUserPrompt(input);
}

export function buildHaengteukRefinementUserPrompt(input: RefinementUserPromptInput): string {
  return buildRefinementUserPrompt(input);
}

// ─── variant 결정적 선택 ────────────────────────────────────────────────────
//
// record_id 의 djb2 hash parity 로 50/50 분할. 같은 레코드는 재실행해도 동일 variant 사용.

export function selectRefinementVariant(recordId: string): RefinementVariant {
  let hash = 5381;
  for (let i = 0; i < recordId.length; i++) {
    hash = ((hash << 5) + hash + recordId.charCodeAt(i)) | 0;
  }
  return (hash & 1) === 0 ? "v1_baseline" : "v2_axis_targeted";
}

// ─── 내부 공통 빌더 ─────────────────────────────────────────────────────────

function formatAxisScores(
  axisScores: RefinementUserPromptInput["axisScores"],
): string {
  const lines: string[] = [
    `- 구체성(specificity): ${axisScores.specificity}/5`,
    `- 일관성(coherence): ${axisScores.coherence}/5`,
    `- 심화도(depth): ${axisScores.depth}/5`,
    `- 문법(grammar): ${axisScores.grammar}/5`,
  ];
  if (axisScores.scientificValidity != null) {
    lines.push(`- 학술정합(scientificValidity): ${axisScores.scientificValidity}/5`);
  }
  return lines.join("\n");
}

// 최하위 축 찾기 (동점 시 specificity > depth > coherence > grammar > scientificValidity 순서)
function findLowestAxis(
  axisScores: RefinementUserPromptInput["axisScores"],
): { name: string; korean: string; score: number } {
  const axes: Array<{ name: string; korean: string; score: number }> = [
    { name: "specificity", korean: "구체성", score: axisScores.specificity },
    { name: "depth", korean: "심화도", score: axisScores.depth },
    { name: "coherence", korean: "일관성", score: axisScores.coherence },
    { name: "grammar", korean: "문법", score: axisScores.grammar },
  ];
  if (axisScores.scientificValidity != null) {
    axes.push({ name: "scientificValidity", korean: "학술정합", score: axisScores.scientificValidity });
  }
  return axes.reduce((min, a) => (a.score < min.score ? a : min));
}

function axisFocusInstruction(axis: { name: string; korean: string; score: number }): string {
  const focusMap: Record<string, string> = {
    specificity: "추상어·수식어를 제거하고 **실제 활동 구체 장면**(사용한 도구·방법·수치·상황)을 1~2건 삽입하세요.",
    depth: "표면 설명을 줄이고 **개념 연결·가설 검증·반례 탐색** 같은 심화 과정을 1문장 이상 서술하세요.",
    coherence: "앞뒤 문장의 **인과·전개 흐름**을 정리하고, 동일 주제가 2회 이상 반복되면 하나로 통합하세요.",
    grammar: "불명확한 주어·조사·시제를 교정하고 긴 문장은 분리하세요.",
    scientificValidity: "과장·오개념을 제거하고 **학술 용어·출처 근거** 를 정확히 쓰세요.",
  };
  const instruction = focusMap[axis.name] ?? "해당 축의 기준을 충족하도록 재작성하세요.";
  return `- 최하위 축: **${axis.korean}(${axis.name}) ${axis.score}/5** — ${instruction}`;
}

function buildRefinementUserPrompt(input: RefinementUserPromptInput): string {
  const { originalUserPrompt, previousDraft, issues, feedback, axisScores, variant } = input;
  const resolvedVariant = variant ?? "v1_baseline";

  const issueList = issues.length > 0 ? issues.join(", ") : "없음";

  const baselineSection = `## 개선 지시
- 위 약점을 구체적으로 해결하여 재작성하세요.
- 기존 강점(키워드·주제·길이)은 유지하세요.
- 원본 대비 품질이 반드시 향상되어야 합니다.`;

  const improvementSection =
    resolvedVariant === "v2_axis_targeted"
      ? `## 개선 지시 (축 집중)
${axisFocusInstruction(findLowestAxis(axisScores))}
- 나머지 축은 현 수준 유지 — 집중 축에서 확실한 점수 상승을 노리세요.
- 기존 강점(키워드·주제·길이)은 유지.
- 원본 대비 품질이 반드시 향상되어야 합니다.`
      : baselineSection;

  return `${originalUserPrompt}

---

## 이전 가안 (재생성 필요)
${previousDraft}

## 지적된 약점
- 5축 점수:
${formatAxisScores(axisScores)}
- 문제 코드: ${issueList}
- 피드백: ${feedback || "없음"}

${improvementSection}`;
}
