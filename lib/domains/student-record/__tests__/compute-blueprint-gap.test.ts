// ============================================
// α3-1 v1: computeBlueprintGap 단위 테스트
//
// 5 시나리오:
//   1. 빈 target        → axisGaps 빈 배열, priority=low, summary 보류 문구
//   2. insufficient     → current < target 축, 기본 부족 패턴
//   3. excess           → current > target + 1등급, 과잉 패턴
//   4. mismatch         → source='ai_projected' 만 존재, 설계만 있고 실측 없음
//   5. latent           → current=null, target 있음, 잔여 학기 충분
// ============================================

import { describe, it, expect } from "vitest";
import { computeBlueprintGap } from "../gap/compute-blueprint-gap";
import type {
  StudentState,
  CompetencyAxisState,
  StudentStateMetadata,
  HakjongScore,
} from "../types/student-state";
import type { CompetencyGrade } from "../types/enums";
import type { CompetencyGradeTarget } from "../types/blueprint-gap";

// ─── 헬퍼 ────────────────────────────────────────────────

function makeAxis(
  code: CompetencyAxisState["code"],
  area: CompetencyAxisState["area"],
  grade: CompetencyGrade | null,
  source: CompetencyAxisState["source"] = "ai",
): CompetencyAxisState {
  return {
    code,
    area,
    grade,
    source,
    narrative: null,
    supportingRecordIds: [],
  };
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

function makeState(overrides: {
  axes?: CompetencyAxisState[];
  hakjongScore?: HakjongScore | null;
  hakjongScoreV2Pre?: HakjongScore | null;
} = {}): StudentState {
  return {
    studentId: "s-1",
    tenantId: "t-1",
    asOf: {
      schoolYear: 2026,
      grade: 2,
      semester: 2,
      label: "t",
      builtAt: "2026-01-01T00:00:00Z",
    },
    profileCard: null,
    competencies:
      overrides.axes && overrides.axes.length > 0
        ? {
            axes: overrides.axes,
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
    hakjongScore: overrides.hakjongScore ?? null,
    hakjongScoreV2Pre: overrides.hakjongScoreV2Pre ?? null,
    blueprintGap: null,
    multiScenarioGap: null,
    blueprint: null,
    metadata: makeMetadata(),
  };
}

function target(
  code: CompetencyGradeTarget["code"],
  targetGrade: CompetencyGrade,
  yearTarget: 1 | 2 | 3 = 3,
): CompetencyGradeTarget {
  return { code, targetGrade, yearTarget };
}

// ============================================
// 1. 빈 target
// ============================================

describe("computeBlueprintGap — 빈 target", () => {
  it("axisGaps 빈 배열, priority=low, summary 보류 문구", () => {
    const state = makeState();
    const gap = computeBlueprintGap({
      state,
      targets: [],
      currentGrade: 2,
      currentSemester: 2,
    });

    expect(gap.axisGaps).toHaveLength(0);
    expect(gap.priority).toBe("low");
    expect(gap.summary).toContain("미수립");
    expect(gap.areaGaps.academic.targetScore).toBeNull();
    expect(gap.areaGaps.academic.gapSize).toBeNull();
    expect(gap.version).toBe("v1_rule");
    expect(gap.remainingSemesters).toBe(2); // (3-2)*2 + 0 = 2
  });
});

// ============================================
// 2. insufficient
// ============================================

describe("computeBlueprintGap — insufficient", () => {
  it("current=B+(4) 목표=A+(6) → gapSize=2, pattern='insufficient'", () => {
    const state = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "B+"), // 4
      ],
      hakjongScore: {
        academic: 75,
        career: null,
        community: null,
        total: null,
        computedAt: "2026-01-01T00:00:00Z",
        version: "v1_rule",
        confidence: { academic: 0.33, career: 0, community: 0, total: 0 },
      },
    });
    const gap = computeBlueprintGap({
      state,
      targets: [target("academic_achievement", "A+", 3)],
      currentGrade: 2,
      currentSemester: 1,
    });

    expect(gap.axisGaps).toHaveLength(1);
    const axis = gap.axisGaps[0];
    expect(axis.pattern).toBe("insufficient");
    expect(axis.gapSize).toBe(2); // 6 - 4
    expect(axis.currentGrade).toBe("B+");
    expect(axis.targetGrade).toBe("A+");

    // areaGaps.academic: target=95, current=75 → gap=20
    expect(gap.areaGaps.academic.targetScore).toBe(95);
    expect(gap.areaGaps.academic.currentScore).toBe(75);
    expect(gap.areaGaps.academic.gapSize).toBe(20);

    // priority=high: areaGap 20 ≥ 15 AND remaining=3≤2? (3-2)*2+1=3, > 2 → 아니므로 axisGap 기반
    // axisGap=2, HIGH_AXIS_GAP=3 → 미달 → medium
    // maxAreaGap=20 ≥ MED_AREA_GAP=10 → medium
    expect(gap.priority).toBe("medium");

    expect(gap.summary).toContain("학업역량 갭 20점");
  });
});

// ============================================
// 3. excess
// ============================================

describe("computeBlueprintGap — excess", () => {
  it("current=A+(6) 목표=B(3) → gapSize=-3, pattern='excess'", () => {
    const state = makeState({
      axes: [
        makeAxis("career_exploration", "career", "A+"), // 6
      ],
    });
    const gap = computeBlueprintGap({
      state,
      targets: [target("career_exploration", "B", 3)],
      currentGrade: 2,
      currentSemester: 2,
    });

    expect(gap.axisGaps).toHaveLength(1);
    expect(gap.axisGaps[0].pattern).toBe("excess");
    expect(gap.axisGaps[0].gapSize).toBe(-3); // 3 - 6
  });
});

// ============================================
// 4. mismatch
// ============================================

describe("computeBlueprintGap — mismatch", () => {
  it("source=ai_projected 만 → pattern='mismatch'", () => {
    const state = makeState({
      axes: [
        makeAxis("academic_inquiry", "academic", "A-", "ai_projected"), // 5
      ],
    });
    const gap = computeBlueprintGap({
      state,
      targets: [target("academic_inquiry", "A+", 3)],
      currentGrade: 2,
      currentSemester: 2,
    });

    expect(gap.axisGaps).toHaveLength(1);
    expect(gap.axisGaps[0].pattern).toBe("mismatch");
    expect(gap.axisGaps[0].rationale).toContain("실측 없음");
  });
});

// ============================================
// 5. latent
// ============================================

describe("computeBlueprintGap — latent", () => {
  it("current=null + 잔여학기 ≥ 2 → pattern='latent'", () => {
    const state = makeState({
      axes: [
        makeAxis("community_leadership", "community", null),
      ],
    });
    const gap = computeBlueprintGap({
      state,
      targets: [target("community_leadership", "A-", 3)],
      currentGrade: 1,
      currentSemester: 2,
    });

    expect(gap.remainingSemesters).toBe(4); // (3-1)*2 + 0
    expect(gap.axisGaps).toHaveLength(1);
    expect(gap.axisGaps[0].pattern).toBe("latent");
    expect(gap.axisGaps[0].rationale).toContain("활성화 가능");
  });

  it("current=null + 잔여학기 < LATENT_THRESHOLD → insufficient (urgent)", () => {
    const state = makeState({
      axes: [
        makeAxis("community_leadership", "community", null),
      ],
    });
    const gap = computeBlueprintGap({
      state,
      targets: [target("community_leadership", "A-", 3)],
      currentGrade: 3,
      currentSemester: 2, // remaining = 0
    });

    expect(gap.remainingSemesters).toBe(0);
    expect(gap.axisGaps[0].pattern).toBe("insufficient");
    expect(gap.axisGaps[0].rationale).toContain("시간 부족");
    // gap 수치 + remaining 0 → HIGH_AXIS_GAP=3 미달이지만 5, priority=high
    expect(gap.priority).toBe("high");
  });
});

// ============================================
// α2-StepC (2026-04-20): useV2Pre 옵션
// ============================================

describe("computeBlueprintGap — useV2Pre 옵션", () => {
  const baseAxes = [
    makeAxis("academic_achievement", "academic", "B+"),
    makeAxis("community_caring", "community", "B"),
    makeAxis("community_leadership", "community", "B"),
  ];
  const targets = [target("community_caring", "A-", 3)];

  const v1Score = (community: number | null): HakjongScore => ({
    academic: 80, career: 80, community, total: community !== null ? 80 : null,
    computedAt: "2026-04-20T00:00:00Z",
    version: "v1_rule",
    confidence: { academic: 1, career: 1, community: 1, total: 1 },
  });
  const v2Score = (community: number | null): HakjongScore => ({
    academic: 80, career: 80, community, total: community !== null ? 80 : null,
    computedAt: "2026-04-20T00:00:00Z",
    version: "v2_rule_calibrated",
    confidence: { academic: 1, career: 1, community: 1, total: 1 },
  });

  it("useV2Pre=false (기본) → v1 community 점수 사용", () => {
    const state = makeState({
      axes: baseAxes,
      hakjongScore: v1Score(80),
      hakjongScoreV2Pre: v2Score(50),
    });
    const gap = computeBlueprintGap({
      state, targets, currentGrade: 2, currentSemester: 2,
    });
    // community currentScore=80, target=85 → gap=5
    expect(gap.areaGaps.community.currentScore).toBe(80);
    expect(gap.areaGaps.community.gapSize).toBe(5);
  });

  it("useV2Pre=true + v2Pre 존재 → v2-pre community 점수 사용 (더 보수적)", () => {
    const state = makeState({
      axes: baseAxes,
      hakjongScore: v1Score(80),
      hakjongScoreV2Pre: v2Score(50),
    });
    const gap = computeBlueprintGap({
      state, targets, currentGrade: 2, currentSemester: 2,
      useV2Pre: true,
    });
    // community currentScore=50 (v2-pre), target=85 → gap=35
    expect(gap.areaGaps.community.currentScore).toBe(50);
    expect(gap.areaGaps.community.gapSize).toBe(35);
  });

  it("useV2Pre=true + v2Pre null → v1 fallback", () => {
    const state = makeState({
      axes: baseAxes,
      hakjongScore: v1Score(80),
      hakjongScoreV2Pre: null,
    });
    const gap = computeBlueprintGap({
      state, targets, currentGrade: 2, currentSemester: 2,
      useV2Pre: true,
    });
    expect(gap.areaGaps.community.currentScore).toBe(80);
    expect(gap.areaGaps.community.gapSize).toBe(5);
  });

  it("useV2Pre=true + v2Pre.community null → v1 fallback (영역별 null 내구성)", () => {
    const state = makeState({
      axes: baseAxes,
      hakjongScore: v1Score(80),
      hakjongScoreV2Pre: v2Score(null),
    });
    const gap = computeBlueprintGap({
      state, targets, currentGrade: 2, currentSemester: 2,
      useV2Pre: true,
    });
    expect(gap.areaGaps.community.currentScore).toBe(80);
  });

  it("useV2Pre 는 axisGaps 에 영향 없음 — currentGrade 기반 pattern 동일", () => {
    const state = makeState({
      axes: baseAxes,
      hakjongScore: v1Score(80),
      hakjongScoreV2Pre: v2Score(50),
    });
    const v1Result = computeBlueprintGap({
      state, targets, currentGrade: 2, currentSemester: 2,
    });
    const v2Result = computeBlueprintGap({
      state, targets, currentGrade: 2, currentSemester: 2, useV2Pre: true,
    });
    // axisGaps 는 competency grade 기반 — 동일
    expect(v1Result.axisGaps).toEqual(v2Result.axisGaps);
  });
});
