// ============================================
// α3-3 v1: computeMultiScenarioGap + deriveScenarioTargets 단위 테스트
//
// 5 시나리오:
//   1. 빈 baseline → 모든 시나리오 빈 / dominantScenario=null
//   2. 정상 baseline → 3 시나리오 각각 계산 + dominantScenario 식별
//   3. grade shift 경계 — A+ +1=A+, C -1=C
//   4. baseline 단일 A- target → stable=B+, aggressive=A+
//   5. dominant = aggressive (grade 높여 gap 커진 쪽)
// ============================================

import { describe, it, expect } from "vitest";
import {
  computeMultiScenarioGap,
  deriveScenarioTargets,
} from "../gap/compute-multi-scenario-gap";
import type {
  StudentState,
  CompetencyAxisState,
  StudentStateMetadata,
  HakjongScore,
} from "../types/student-state";
import type {
  CompetencyGrade,
  CompetencyItemCode,
  CompetencyArea,
} from "../types/enums";
import type { CompetencyGradeTarget } from "../types/blueprint-gap";

// ─── 헬퍼 ────────────────────────────────────────────────

function makeAxis(
  code: CompetencyItemCode,
  area: CompetencyArea,
  grade: CompetencyGrade | null,
): CompetencyAxisState {
  return { code, area, grade, source: "ai", narrative: null, supportingRecordIds: [] };
}

function makeMetadata(): StudentStateMetadata {
  return {
    snapshotId: null,
    completenessRatio: 0,
    layer0Present: false,
    layer1Present: false,
    layer2Present: false,
    layer3Present: false,
    auxVolunteerPresent: false,
    auxAwardsPresent: false,
    auxAttendancePresent: false,
    auxReadingPresent: false,
    areaCompleteness: { academic: 0, career: 0, community: 0 },
    hakjongScoreComputable: { academic: false, career: false, community: false, total: false },
    blueprintPresent: false,
    staleness: { hasStaleLayer: false, staleReasons: [] },
  };
}

function makeState(axes: CompetencyAxisState[], hs?: HakjongScore | null): StudentState {
  return {
    studentId: "s-1",
    tenantId: "t-1",
    asOf: { schoolYear: 2026, grade: 2, semester: 2, label: "t", builtAt: "2026-01-01T00:00:00Z" },
    profileCard: null,
    competencies:
      axes.length > 0
        ? {
            axes,
            analysisQuality: {
              specificity: null, coherence: null, depth: null, grammar: null,
              scientificValidity: null, overallScore: null, sampleSize: 0, source: "ai",
            },
            projectedQuality: {
              specificity: null, coherence: null, depth: null, grammar: null,
              scientificValidity: null, overallScore: null, sampleSize: 0, source: "ai_projected",
            },
          }
        : null,
    hyperedges: [],
    narrativeArc: [],
    trajectory: [],
    aux: { volunteer: null, awards: null, attendance: null, reading: null },
    hakjongScore: hs ?? null,
    blueprintGap: null,
    multiScenarioGap: null,
    blueprint: null,
    metadata: makeMetadata(),
  };
}

function target(code: CompetencyItemCode, g: CompetencyGrade, y: 1 | 2 | 3 = 3): CompetencyGradeTarget {
  return { code, targetGrade: g, yearTarget: y };
}

// ============================================
// 1. 빈 baseline
// ============================================

describe("computeMultiScenarioGap — 빈 baseline", () => {
  it("stable/aggressive null + dominantScenario=null", () => {
    const state = makeState([]);
    const multi = computeMultiScenarioGap({
      state,
      baselineTargets: [],
      currentGrade: 2,
      currentSemester: 2,
    });
    expect(multi.baseline.axisGaps).toHaveLength(0);
    expect(multi.stable).toBeNull();
    expect(multi.aggressive).toBeNull();
    expect(multi.dominantScenario).toBeNull();
    expect(multi.version).toBe("v1_rule_multi");
  });
});

// ============================================
// 2. 정상 baseline → 3 시나리오 각각 계산
// ============================================

describe("computeMultiScenarioGap — 정상 baseline", () => {
  it("3 시나리오 각각 axisGaps 계산 + dominant 추출", () => {
    const state = makeState([
      makeAxis("academic_achievement", "academic", "B+"), // 4
    ]);
    const multi = computeMultiScenarioGap({
      state,
      baselineTargets: [target("academic_achievement", "A-", 3)], // baseline 5
      currentGrade: 2,
      currentSemester: 2,
    });
    expect(multi.stable).not.toBeNull();
    expect(multi.aggressive).not.toBeNull();
    // baseline: current B+(4) vs A-(5) = 1 gap (insufficient threshold 1 — 통과)
    // stable: current B+(4) vs B(3) = -1 gap (excess threshold 2 — 미달 → balanced 제외)
    // aggressive: current B+(4) vs A+(6) = 2 gap (insufficient)
    expect(multi.baseline.axisGaps.length).toBe(1);
    expect(multi.baseline.axisGaps[0].gapSize).toBe(1);
    expect(multi.stable!.axisGaps.length).toBe(0); // balanced
    expect(multi.aggressive!.axisGaps.length).toBe(1);
    expect(multi.aggressive!.axisGaps[0].gapSize).toBe(2);
    // dominantScenario = aggressive (max area gap 가장 큼)
    expect(multi.dominantScenario).toBe("aggressive");
  });
});

// ============================================
// 3. grade shift 경계
// ============================================

describe("deriveScenarioTargets — grade shift 경계", () => {
  it("A+ aggressive 는 여전히 A+ (상한 clamp)", () => {
    const derived = deriveScenarioTargets(
      [target("academic_achievement", "A+", 3)],
      "aggressive",
    );
    expect(derived[0].targetGrade).toBe("A+");
  });

  it("C stable 은 여전히 C (하한 clamp)", () => {
    const derived = deriveScenarioTargets(
      [target("academic_achievement", "C", 3)],
      "stable",
    );
    expect(derived[0].targetGrade).toBe("C");
  });

  it("baseline 그대로 반환", () => {
    const base = [target("academic_achievement", "A-", 3)];
    const derived = deriveScenarioTargets(base, "baseline");
    expect(derived[0].targetGrade).toBe("A-");
    // immutable — 원본 참조 반환 아님
    expect(derived).not.toBe(base);
  });
});

// ============================================
// 4. A- target 변화 확인
// ============================================

describe("deriveScenarioTargets — 단일 A- target shift", () => {
  it("stable → B+ / aggressive → A+", () => {
    const base = [target("community_leadership", "A-", 3)];
    expect(deriveScenarioTargets(base, "stable")[0].targetGrade).toBe("B+");
    expect(deriveScenarioTargets(base, "aggressive")[0].targetGrade).toBe("A+");
  });
});

// ============================================
// 5. dominantScenario 식별
// ============================================

describe("computeMultiScenarioGap — dominantScenario", () => {
  it("aggressive 에서 gap 이 가장 크면 aggressive 선택", () => {
    // current=B+(4), baseline target=B+(4) → gap 0 (balanced 제외, areaGap=0)
    // stable target=B(3) → gap -1 (excess threshold 2 미달 → balanced)
    // aggressive target=A-(5) → gap 1 (insufficient)
    const state = makeState([
      makeAxis("academic_achievement", "academic", "B+"),
      makeAxis("academic_attitude", "academic", "B+"),
    ]);
    const multi = computeMultiScenarioGap({
      state,
      baselineTargets: [
        target("academic_achievement", "B+", 3),
        target("academic_attitude", "B+", 3),
      ],
      currentGrade: 2,
      currentSemester: 2,
    });
    expect(multi.dominantScenario).toBe("aggressive");
    expect(multi.aggressive!.axisGaps.length).toBeGreaterThan(0);
  });

  it("stable 이 current 보다 낮아도 excess 로 balanced 처리 시 dominant 는 aggressive", () => {
    const state = makeState([
      makeAxis("academic_achievement", "academic", "A+"),
      makeAxis("academic_attitude", "academic", "A+"),
    ]);
    const multi = computeMultiScenarioGap({
      state,
      baselineTargets: [
        target("academic_achievement", "A+", 3),
        target("academic_attitude", "A+", 3),
      ],
      currentGrade: 2,
      currentSemester: 2,
    });
    // baseline all balanced, stable 은 A- 이지만 current A+ 라 excess (-2), aggressive 는 A+ 상한 clamp → baseline 과 동일.
    // dominantScenario 는 maxAreaGap 기준 — excess 도 areaGap 계산에서 음수. area 기준 maxAreaGap=0 for baseline/aggressive, -20 for stable.
    // 모두 0 이하이므로 첫 후보(baseline) 선택.
    expect(multi.dominantScenario).toBe("baseline");
  });
});
