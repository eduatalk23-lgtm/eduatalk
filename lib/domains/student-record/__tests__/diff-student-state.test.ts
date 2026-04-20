// ============================================
// computeStudentStateDiff — α4 Perception 전구체 단위 테스트 (2026-04-20)
//
// 시나리오:
//   1. 동일 state → zero diff (빈 배열, 0 delta, staleBlueprint=false)
//   2. competency grade 변화 (null→B, A-→A+)
//   3. aux 변화 (volunteer hours, awards, attendance integrity)
//   4. hakjongScore delta 계산 + null 처리
//   5. newRecordIds 수집 (narrativeArc + hyperedges + awards)
//   6. staleBlueprint 판정:
//      · blueprint 갱신 + 상태 변화 → false
//      · blueprint 미갱신 + 상태 변화 → true
//      · blueprint 미갱신 + 상태 불변 → false
//      · blueprint 자체 없음 → false
// ============================================

import { describe, it, expect } from "vitest";
import { computeStudentStateDiff } from "../state/diff-student-state";
import type {
  StudentState,
  CompetencyAxisState,
  HakjongScore,
  StudentStateMetadata,
  BlueprintAnchor,
  HyperedgeSnapshot,
  NarrativeArcSegment,
  AwardState,
  VolunteerState,
  AttendanceState,
} from "../types/student-state";
import type {
  CompetencyGrade,
  CompetencyItemCode,
  RecordType,
} from "../types/enums";

// ─── 헬퍼 ────────────────────────────────────────────────

function makeAxis(
  code: CompetencyItemCode,
  area: CompetencyAxisState["area"],
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
    hakjongScoreComputable: {
      academic: false,
      career: false,
      community: false,
      total: false,
    },
    blueprintPresent: false,
    staleness: { hasStaleLayer: false, staleReasons: [] },
  };
}

function makeHakjongScore(total: number | null): HakjongScore {
  return {
    academic: total,
    career: total,
    community: total,
    total,
    computedAt: "2026-04-20T00:00:00Z",
    version: "v1_rule",
    confidence: { academic: 1, career: 1, community: 1, total: 1 },
  };
}

function makeState(overrides: {
  grade?: 1 | 2 | 3;
  semester?: 1 | 2;
  axes?: CompetencyAxisState[];
  volunteer?: VolunteerState | null;
  awards?: AwardState | null;
  attendance?: AttendanceState | null;
  hakjongScore?: HakjongScore | null;
  hyperedges?: HyperedgeSnapshot[];
  narrativeArc?: NarrativeArcSegment[];
  blueprint?: BlueprintAnchor | null;
} = {}): StudentState {
  const grade = overrides.grade ?? 2;
  const semester = overrides.semester ?? 2;
  return {
    studentId: "s-1",
    tenantId: "t-1",
    asOf: {
      schoolYear: 2026,
      grade,
      semester,
      label: `2026 ${grade}-${semester}`,
      builtAt: "2026-04-20T00:00:00Z",
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
    hyperedges: overrides.hyperedges ?? [],
    narrativeArc: overrides.narrativeArc ?? [],
    trajectory: [],
    aux: {
      volunteer: overrides.volunteer ?? null,
      awards: overrides.awards ?? null,
      attendance: overrides.attendance ?? null,
      reading: null,
    },
    hakjongScore: overrides.hakjongScore ?? null,
    hakjongScoreV2Pre: null,
    blueprintGap: null,
    multiScenarioGap: null,
    blueprint: overrides.blueprint ?? null,
    metadata: makeMetadata(),
  };
}

function makeArcSeg(recordId: string, recordType: RecordType = "setek"): NarrativeArcSegment {
  return {
    recordId,
    recordType,
    phasesPresent: [],
    flowCompleteness: 0,
  };
}

// ============================================
// 1. 동일 state → zero diff
// ============================================

describe("computeStudentStateDiff — 동일 state", () => {
  it("변화 없음 → 모든 필드 zero/empty", () => {
    const state = makeState({
      axes: [makeAxis("academic_achievement", "academic", "B+")],
      volunteer: { totalHours: 10, recurringThemes: [], caringEvidence: [], lastActivityAt: null },
      hakjongScore: makeHakjongScore(70),
    });
    const diff = computeStudentStateDiff(state, state);
    expect(diff.hakjongScoreDelta).toBe(0);
    expect(diff.competencyChanges).toEqual([]);
    expect(diff.newRecordIds).toEqual([]);
    expect(diff.staleBlueprint).toBe(false);
    expect(diff.auxChanges.volunteerHoursDelta).toBe(0);
    expect(diff.auxChanges.awardsAdded).toBe(0);
    expect(diff.auxChanges.integrityChanged).toBe(false);
  });
});

// ============================================
// 2. competency grade 변화
// ============================================

describe("computeStudentStateDiff — competency 변화", () => {
  it("축별 grade 변화 감지 + null→grade 포함", () => {
    const from = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "B+"),
        makeAxis("academic_attitude", "academic", null),
        makeAxis("career_exploration", "career", "B"),
      ],
    });
    const to = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "A-"),      // B+ → A-
        makeAxis("academic_attitude", "academic", "B"),          // null → B
        makeAxis("career_exploration", "career", "B"),           // 동일
      ],
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.competencyChanges).toHaveLength(2);
    // 알파벳 정렬
    expect(diff.competencyChanges[0]).toEqual({
      code: "academic_achievement",
      before: "B+",
      after: "A-",
    });
    expect(diff.competencyChanges[1]).toEqual({
      code: "academic_attitude",
      before: null,
      after: "B",
    });
  });

  it("to 에만 있는 축 (from 에서 측정 안 됨) → before=null", () => {
    const from = makeState({ axes: [] });
    const to = makeState({
      axes: [makeAxis("community_leadership", "community", "B")],
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.competencyChanges).toHaveLength(1);
    expect(diff.competencyChanges[0]).toEqual({
      code: "community_leadership",
      before: null,
      after: "B",
    });
  });
});

// ============================================
// 3. aux 변화 (volunteer / awards / attendance)
// ============================================

describe("computeStudentStateDiff — aux 변화", () => {
  it("volunteerHoursDelta 양수 + awards 추가 + integrity 변화", () => {
    const from = makeState({
      volunteer: { totalHours: 10, recurringThemes: [], caringEvidence: [], lastActivityAt: null },
      awards: { items: [], leadershipEvidence: [], careerRelevance: [] },
      attendance: {
        absenceDays: 0, lateDays: 0, earlyLeaveDays: 0, unauthorizedEvents: 0,
        integrityScore: 100, flags: [],
      },
    });
    const to = makeState({
      volunteer: { totalHours: 25, recurringThemes: [], caringEvidence: [], lastActivityAt: null },
      awards: {
        items: [
          { recordId: "a-1", name: "상", level: "교내", relatedCompetencies: [] },
          { recordId: "a-2", name: "상2", level: "전국", relatedCompetencies: [] },
        ],
        leadershipEvidence: [],
        careerRelevance: [],
      },
      attendance: {
        absenceDays: 1, lateDays: 0, earlyLeaveDays: 0, unauthorizedEvents: 1,
        integrityScore: 98, flags: [],
      },
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.auxChanges.volunteerHoursDelta).toBe(15);
    expect(diff.auxChanges.awardsAdded).toBe(2);
    expect(diff.auxChanges.integrityChanged).toBe(true);
  });

  it("aux 없음(null) → 없음(null): 모든 필드 0 + integrityChanged=false", () => {
    const from = makeState();
    const to = makeState();
    const diff = computeStudentStateDiff(from, to);
    expect(diff.auxChanges.volunteerHoursDelta).toBe(0);
    expect(diff.auxChanges.awardsAdded).toBe(0);
    expect(diff.auxChanges.integrityChanged).toBe(false);
  });
});

// ============================================
// 4. hakjongScore delta
// ============================================

describe("computeStudentStateDiff — hakjongScoreDelta", () => {
  it("양쪽 total 있음 → delta 소수 1자리 반올림", () => {
    const from = makeState({ hakjongScore: makeHakjongScore(70.3) });
    const to = makeState({ hakjongScore: makeHakjongScore(75.57) });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.hakjongScoreDelta).toBeCloseTo(5.3, 1);
  });

  it("from.total null → delta=null", () => {
    const from = makeState({ hakjongScore: makeHakjongScore(null) });
    const to = makeState({ hakjongScore: makeHakjongScore(80) });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.hakjongScoreDelta).toBeNull();
  });
});

// ============================================
// 5. newRecordIds 수집
// ============================================

describe("computeStudentStateDiff — newRecordIds", () => {
  it("narrativeArc + hyperedges + awards 에서 to 에만 있는 record_id 추출", () => {
    const from = makeState({
      narrativeArc: [makeArcSeg("rec-1"), makeArcSeg("rec-2")],
      hyperedges: [
        {
          id: "he-1", themeSlug: "t", memberRecordIds: ["rec-1"],
          sharedCompetencies: [], confidence: 0.8, hyperedgeType: "theme_convergence",
        },
      ],
      awards: {
        items: [{ recordId: "a-1", name: "상", level: "교내", relatedCompetencies: [] }],
        leadershipEvidence: [], careerRelevance: [],
      },
    });
    const to = makeState({
      narrativeArc: [
        makeArcSeg("rec-1"),
        makeArcSeg("rec-2"),
        makeArcSeg("rec-3"),
      ],
      hyperedges: [
        {
          id: "he-1", themeSlug: "t", memberRecordIds: ["rec-1", "rec-3"],
          sharedCompetencies: [], confidence: 0.8, hyperedgeType: "theme_convergence",
        },
      ],
      awards: {
        items: [
          { recordId: "a-1", name: "상", level: "교내", relatedCompetencies: [] },
          { recordId: "a-2", name: "상2", level: "전국", relatedCompetencies: [] },
        ],
        leadershipEvidence: [], careerRelevance: [],
      },
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.newRecordIds).toEqual(["a-2", "rec-3"]); // 정렬
  });

  it("from 에만 있는 record 는 무시 (diff 는 '추가' 만 감지)", () => {
    const from = makeState({
      narrativeArc: [makeArcSeg("rec-1"), makeArcSeg("rec-2")],
    });
    const to = makeState({
      narrativeArc: [makeArcSeg("rec-1")],
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.newRecordIds).toEqual([]);
  });
});

// ============================================
// 6. staleBlueprint 판정
// ============================================

function makeBlueprint(updatedAt: string): BlueprintAnchor {
  return {
    mainExplorationId: "me-1",
    version: 1,
    origin: "auto_bootstrap_v1",
    tierPlan: null,
    targetMajor: null,
    targetUniversityLevel: null,
    updatedAt,
    competencyGrowthTargets: [],
  };
}

describe("computeStudentStateDiff — staleBlueprint", () => {
  it("blueprint 미갱신 + newRecordIds 추가 → stale=true", () => {
    const bpAt = "2026-04-01T00:00:00Z";
    const from = makeState({
      narrativeArc: [makeArcSeg("rec-1")],
      blueprint: makeBlueprint(bpAt),
    });
    const to = makeState({
      narrativeArc: [makeArcSeg("rec-1"), makeArcSeg("rec-2")],
      blueprint: makeBlueprint(bpAt),
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.staleBlueprint).toBe(true);
  });

  it("blueprint 갱신(updatedAt 변화) + newRecord → stale=false", () => {
    const from = makeState({
      narrativeArc: [makeArcSeg("rec-1")],
      blueprint: makeBlueprint("2026-04-01T00:00:00Z"),
    });
    const to = makeState({
      narrativeArc: [makeArcSeg("rec-1"), makeArcSeg("rec-2")],
      blueprint: makeBlueprint("2026-04-15T00:00:00Z"),
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.staleBlueprint).toBe(false);
  });

  it("blueprint 미갱신 + 상태 불변 → stale=false (업데이트 불필요)", () => {
    const bpAt = "2026-04-01T00:00:00Z";
    const from = makeState({ blueprint: makeBlueprint(bpAt) });
    const to = makeState({ blueprint: makeBlueprint(bpAt) });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.staleBlueprint).toBe(false);
  });

  it("blueprint 자체 없음 → stale=false", () => {
    const from = makeState({
      narrativeArc: [makeArcSeg("rec-1")],
    });
    const to = makeState({
      narrativeArc: [makeArcSeg("rec-1"), makeArcSeg("rec-2")],
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.staleBlueprint).toBe(false);
  });

  it("blueprint 미갱신 + hakjongScoreDelta 만 큼 → stale=true", () => {
    const bpAt = "2026-04-01T00:00:00Z";
    const from = makeState({
      blueprint: makeBlueprint(bpAt),
      hakjongScore: makeHakjongScore(70),
    });
    const to = makeState({
      blueprint: makeBlueprint(bpAt),
      hakjongScore: makeHakjongScore(75),
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.staleBlueprint).toBe(true);
  });

  it("blueprint 미갱신 + |hakjongScoreDelta|<1 + 기타 변화 없음 → stale=false", () => {
    const bpAt = "2026-04-01T00:00:00Z";
    const from = makeState({
      blueprint: makeBlueprint(bpAt),
      hakjongScore: makeHakjongScore(70.0),
    });
    const to = makeState({
      blueprint: makeBlueprint(bpAt),
      hakjongScore: makeHakjongScore(70.5), // delta=0.5 < 1
    });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.staleBlueprint).toBe(false);
  });
});

// ============================================
// 7. from/to asOf 전달
// ============================================

describe("computeStudentStateDiff — asOf 전달", () => {
  it("from/to 의 asOf 를 그대로 복사", () => {
    const from = makeState({ grade: 1, semester: 2 });
    const to = makeState({ grade: 2, semester: 1 });
    const diff = computeStudentStateDiff(from, to);
    expect(diff.from.grade).toBe(1);
    expect(diff.from.semester).toBe(2);
    expect(diff.to.grade).toBe(2);
    expect(diff.to.semester).toBe(1);
  });
});
