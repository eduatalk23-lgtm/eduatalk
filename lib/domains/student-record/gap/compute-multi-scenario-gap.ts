// ============================================
// α3-3 v1: 다중 시나리오 GAP 계산
//
// baseline (현 anchor targets) + stable(-1 grade) + aggressive(+1 grade)
// 3 시나리오를 각각 computeBlueprintGap 호출 후 비교.
//
// 규칙:
//   - stable = baseline 의 각 targetGrade 한 단계 낮춤. 하한 'C'.
//   - aggressive = 한 단계 높임. 상한 'A+'.
//   - 시나리오 파생은 baseline 이 비어있으면 skip (null).
//   - dominantScenario = 3 중 maxAreaGap 기준 가장 큰 시나리오.
//     (gap 큰 시나리오가 Agent/UI 제안 기본값으로 쓰이기 좋음 — "이 시나리오면 X 점 차")
//
// 융합형(fusion): 진로+공동체 균형 target 을 exemplar 학습 기반으로 생성.
//   규칙으로는 표현 어려워 β 이월.
// ============================================

import type {
  BlueprintGap,
  CompetencyGradeTarget,
  MultiScenarioBlueprintGap,
  ScenarioType,
} from "../types/blueprint-gap";
import type { StudentState } from "../types/student-state";
import type { CompetencyGrade } from "../types/enums";
import { computeBlueprintGap } from "./compute-blueprint-gap";

// ─── 상수: 등급 shift 테이블 ─────────────────────────────

const GRADE_ORDER: readonly CompetencyGrade[] = ["C", "B-", "B", "B+", "A-", "A+"];

function shiftGrade(grade: CompetencyGrade, delta: -1 | 1): CompetencyGrade {
  const idx = GRADE_ORDER.indexOf(grade);
  // 경계: C 아래 없음, A+ 위 없음 — clamp.
  const next = Math.max(0, Math.min(GRADE_ORDER.length - 1, idx + delta));
  return GRADE_ORDER[next];
}

// ─── 시나리오 파생 ───────────────────────────────────────

/**
 * baseline targets 로부터 특정 시나리오 targets 파생.
 * - baseline: 원본 그대로 (shift 없음)
 * - stable:   각 targetGrade -1 (하한 C)
 * - aggressive: 각 targetGrade +1 (상한 A+)
 *
 * baseline 빈 배열 → 모든 시나리오 빈 배열.
 */
export function deriveScenarioTargets(
  baseline: readonly CompetencyGradeTarget[],
  scenario: ScenarioType,
): CompetencyGradeTarget[] {
  if (baseline.length === 0) return [];
  if (scenario === "baseline") return [...baseline];
  const delta: -1 | 1 = scenario === "stable" ? -1 : 1;
  return baseline.map((t) => ({
    ...t,
    targetGrade: shiftGrade(t.targetGrade, delta),
  }));
}

// ─── 공개 API ────────────────────────────────────────────

/**
 * 3 시나리오 multi-scenario GAP. baseline 은 항상 계산.
 * stable/aggressive 는 baseline 빈 경우 null.
 * dominantScenario 는 maxAreaGap 기준.
 */
export function computeMultiScenarioGap(input: {
  state: StudentState;
  baselineTargets: readonly CompetencyGradeTarget[];
  currentGrade: 1 | 2 | 3;
  currentSemester: 1 | 2;
}): MultiScenarioBlueprintGap {
  const { state, baselineTargets, currentGrade, currentSemester } = input;

  const baseline = computeBlueprintGap({
    state,
    targets: baselineTargets,
    currentGrade,
    currentSemester,
  });

  const stable =
    baselineTargets.length > 0
      ? computeBlueprintGap({
          state,
          targets: deriveScenarioTargets(baselineTargets, "stable"),
          currentGrade,
          currentSemester,
        })
      : null;

  const aggressive =
    baselineTargets.length > 0
      ? computeBlueprintGap({
          state,
          targets: deriveScenarioTargets(baselineTargets, "aggressive"),
          currentGrade,
          currentSemester,
        })
      : null;

  const dominantScenario = baselineTargets.length === 0 ? null : pickDominant({ baseline, stable, aggressive });

  return {
    computedAt: new Date().toISOString(),
    version: "v1_rule_multi",
    baseline,
    stable,
    aggressive,
    dominantScenario,
  };
}

function pickDominant(gaps: {
  baseline: BlueprintGap;
  stable: BlueprintGap | null;
  aggressive: BlueprintGap | null;
}): ScenarioType {
  const candidates: Array<{ key: ScenarioType; score: number }> = [
    { key: "baseline", score: scenarioScore(gaps.baseline) },
  ];
  if (gaps.stable) candidates.push({ key: "stable", score: scenarioScore(gaps.stable) });
  if (gaps.aggressive) candidates.push({ key: "aggressive", score: scenarioScore(gaps.aggressive) });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].key;
}

/**
 * dominant 식별용 scalar score.
 * state.hakjongScore 존재 → areaGap 최대치 (100 점 scale, 정확).
 * state.hakjongScore 없음 → axisGap 양수 gap 합계 fallback (등급 차 scale, 근사).
 * 두 케이스 모두 값 0 이면 balanced → 선순위 후보(baseline) 가 유지됨.
 */
function scenarioScore(gap: BlueprintGap): number {
  const areaMax = Math.max(
    gap.areaGaps.academic.gapSize ?? -Infinity,
    gap.areaGaps.career.gapSize ?? -Infinity,
    gap.areaGaps.community.gapSize ?? -Infinity,
  );
  if (Number.isFinite(areaMax) && areaMax > 0) return areaMax;

  // axisGap fallback — 양수 gap 합계 (부족 축의 강도 총량)
  const axisSum = gap.axisGaps
    .filter((a) => a.gapSize > 0)
    .reduce((s, a) => s + a.gapSize, 0);
  return axisSum;
}
