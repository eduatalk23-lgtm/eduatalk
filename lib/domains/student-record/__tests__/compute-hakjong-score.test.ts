// ============================================
// α2 v1: computeHakjongScore 단위 테스트
//
// 시나리오:
//   1. 빈 state → 모든 영역 null + total null
//   2. academic 2 축만 → academic 계산, career/community null, total null
//   3. 3 영역 모두 ≥ 2 축 + aux 없음 → total 산출 (community Layer1 × 0.7 만)
//   4. 3 영역 모두 ≥ 2 축 + aux 3 종 전부 → community 에 aux 30% 가중 반영
// ============================================

import { describe, it, expect } from "vitest";
import { computeHakjongScore } from "../reward/compute-hakjong-score";
import type {
  StudentState,
  CompetencyAxisState,
  VolunteerState,
  AwardState,
  AttendanceState,
  StudentStateMetadata,
} from "../types/student-state";
import type { CompetencyGrade } from "../types/enums";

function makeAxis(
  code: CompetencyAxisState["code"],
  area: CompetencyAxisState["area"],
  grade: CompetencyGrade | null,
): CompetencyAxisState {
  return {
    code,
    area,
    grade,
    source: "ai",
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
  volunteer?: VolunteerState | null;
  awards?: AwardState | null;
  attendance?: AttendanceState | null;
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
    aux: {
      volunteer: overrides.volunteer ?? null,
      awards: overrides.awards ?? null,
      attendance: overrides.attendance ?? null,
      reading: null,
    },
    hakjongScore: null,
    blueprint: null,
    metadata: makeMetadata(),
  };
}

// ============================================
// 1. 빈 state
// ============================================

describe("computeHakjongScore — 빈 state", () => {
  it("모든 영역 null + total null + confidence 0", () => {
    const state = makeState();
    const score = computeHakjongScore(state);
    expect(score.academic).toBeNull();
    expect(score.career).toBeNull();
    expect(score.community).toBeNull();
    expect(score.total).toBeNull();
    expect(score.confidence.total).toBe(0);
    expect(score.version).toBe("v1_rule");
  });
});

// ============================================
// 2. academic 2 축만
// ============================================

describe("computeHakjongScore — academic 2축만", () => {
  it("academic 산출, career/community null, total null", () => {
    const state = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "A-"),  // 85
        makeAxis("academic_attitude", "academic", "B+"),     // 75
        makeAxis("academic_inquiry", "academic", null),
        makeAxis("career_course_effort", "career", null),
        makeAxis("career_course_achievement", "career", null),
        makeAxis("career_exploration", "career", null),
        makeAxis("community_collaboration", "community", null),
        makeAxis("community_caring", "community", null),
        makeAxis("community_integrity", "community", null),
        makeAxis("community_leadership", "community", null),
      ],
    });
    const score = computeHakjongScore(state);
    expect(score.academic).toBe(80); // (85+75)/2
    expect(score.career).toBeNull();
    expect(score.community).toBeNull();
    expect(score.total).toBeNull();
    expect(score.confidence.academic).toBeCloseTo(2 / 3, 2);
    expect(score.confidence.career).toBe(0);
  });
});

// ============================================
// 3. 3 영역 모두 ≥ 2 축 + aux 없음
// ============================================

describe("computeHakjongScore — 3영역 기본 + aux 없음", () => {
  it("total 산출. community 는 Layer1 × 0.7 + 0 aux", () => {
    const state = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "A-"),  // 85
        makeAxis("academic_attitude", "academic", "B+"),     // 75
        makeAxis("academic_inquiry", "academic", "B"),       // 65
        makeAxis("career_course_effort", "career", "A-"),    // 85
        makeAxis("career_course_achievement", "career", "B+"), // 75
        makeAxis("career_exploration", "career", null),
        makeAxis("community_collaboration", "community", "B"), // 65
        makeAxis("community_caring", "community", "B+"),     // 75
        makeAxis("community_integrity", "community", null),
        makeAxis("community_leadership", "community", null),
      ],
    });
    const score = computeHakjongScore(state);
    expect(score.academic).toBe(75); // (85+75+65)/3
    expect(score.career).toBe(80);   // (85+75)/2
    // community Layer1 평균 = (65+75)/2 = 70. aux=0 → 70 × 0.7 = 49
    expect(score.community).toBe(49);
    // total = 75×0.3 + 80×0.4 + 49×0.3 = 22.5 + 32 + 14.7 = 69.2
    expect(score.total).toBe(69.2);
    expect(score.confidence.total).toBeGreaterThan(0);
  });
});

// ============================================
// 4. 3 영역 + aux 3 종
// ============================================

describe("computeHakjongScore — 3영역 + aux 3종 전부", () => {
  it("community 에 aux 30% 가중 반영", () => {
    const state = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "A-"),
        makeAxis("academic_attitude", "academic", "A-"),
        makeAxis("academic_inquiry", "academic", "A-"),
        makeAxis("career_course_effort", "career", "A-"),
        makeAxis("career_course_achievement", "career", "A-"),
        makeAxis("career_exploration", "career", "A-"),
        makeAxis("community_collaboration", "community", "B"),
        makeAxis("community_caring", "community", "B"),
        makeAxis("community_integrity", "community", null),
        makeAxis("community_leadership", "community", null),
      ],
      volunteer: {
        totalHours: 20,
        recurringThemes: [],
        caringEvidence: [],
        lastActivityAt: "2025-06-01",
      },
      awards: {
        items: [
          { recordId: "a-1", name: "경시대회 은상", level: "전국", relatedCompetencies: [] },
        ],
        leadershipEvidence: [],
        careerRelevance: [],
      },
      attendance: {
        absenceDays: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        unauthorizedEvents: 0,
        integrityScore: 100,
        flags: [],
      },
    });
    const score = computeHakjongScore(state);
    expect(score.academic).toBe(85); // A- 3축
    expect(score.career).toBe(85);
    // community Layer1 = (65+65)/2 = 65. aux = (100+100+100)/3 = 100.
    // community score = 65×0.7 + 100×0.3 = 45.5 + 30 = 75.5
    expect(score.community).toBe(75.5);
    // total = 85×0.3 + 85×0.4 + 75.5×0.3 = 25.5 + 34 + 22.65 = 82.15 → round 82.2
    expect(score.total).toBe(82.2);
  });

  it("aux 부분 제공: volunteer 만 있고 awards/attendance 없으면 aux 기여 = 100/3", () => {
    const state = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "B"),
        makeAxis("academic_attitude", "academic", "B"),
        makeAxis("career_course_effort", "career", "B"),
        makeAxis("career_course_achievement", "career", "B"),
        makeAxis("community_collaboration", "community", "B"),
        makeAxis("community_caring", "community", "B"),
      ],
      volunteer: {
        totalHours: 10,
        recurringThemes: [],
        caringEvidence: [],
        lastActivityAt: null,
      },
    });
    const score = computeHakjongScore(state);
    // community Layer1 = 65. aux = (100+0+0)/3 = 33.33
    // community = 65 × 0.7 + 33.33 × 0.3 = 45.5 + 10 = 55.5
    expect(score.community).toBe(55.5);
  });
});
