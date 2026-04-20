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
import {
  computeHakjongScore,
  computeHakjongScoreV2Pre,
} from "../reward/compute-hakjong-score";
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
    hakjongScoreV2Pre: null,
    blueprintGap: null,
    multiScenarioGap: null,
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

// ============================================
// α2 v2-pre (2026-04-20): aux 연속 기여 Calibrated
//
// v1 대비 community aux 가 binary(0/100) → 연속(log10 volunteer + level 가중 awards).
// academic / career / 가중치 / confidence 는 v1 과 동일.
// ============================================

describe("computeHakjongScoreV2Pre — 빈 state", () => {
  it("v1 과 동일하게 모든 영역 null + version='v2_rule_calibrated'", () => {
    const state = makeState();
    const score = computeHakjongScoreV2Pre(state);
    expect(score.academic).toBeNull();
    expect(score.career).toBeNull();
    expect(score.community).toBeNull();
    expect(score.total).toBeNull();
    expect(score.version).toBe("v2_rule_calibrated");
  });
});

describe("computeHakjongScoreV2Pre — volunteer 연속 기여", () => {
  it("totalHours=0 → volunteer 기여 0, community Layer1 만 반영", () => {
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
        totalHours: 0,
        recurringThemes: [],
        caringEvidence: [],
        lastActivityAt: null,
      },
    });
    const score = computeHakjongScoreV2Pre(state);
    // aux = (0 + 0 + 0) / 3 = 0. community Layer1 65 × 0.7 = 45.5
    expect(score.community).toBe(45.5);
  });

  it("totalHours=10 → 약 52 기여 (log10(11) × 50)", () => {
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
    const score = computeHakjongScoreV2Pre(state);
    // volunteer 기여 = log10(11) × 50 ≈ 52.04
    // aux = (52.04 + 0 + 0) / 3 ≈ 17.35
    // community = 65 × 0.7 + 17.35 × 0.3 = 45.5 + 5.2 = 50.7
    expect(score.community).toBeCloseTo(50.7, 1);
  });

  it("totalHours 큰 값은 100 cap — 200h 와 1000h 동일 기여", () => {
    const make = (hours: number) =>
      computeHakjongScoreV2Pre(
        makeState({
          axes: [
            makeAxis("academic_achievement", "academic", "B"),
            makeAxis("academic_attitude", "academic", "B"),
            makeAxis("career_course_effort", "career", "B"),
            makeAxis("career_course_achievement", "career", "B"),
            makeAxis("community_collaboration", "community", "B"),
            makeAxis("community_caring", "community", "B"),
          ],
          volunteer: {
            totalHours: hours,
            recurringThemes: [],
            caringEvidence: [],
            lastActivityAt: null,
          },
        }),
      );
    const a = make(200);
    const b = make(1000);
    expect(a.community).toBe(b.community);
  });
});

describe("computeHakjongScoreV2Pre — awards level 가중", () => {
  it("교내 1건 → 16, 전국 1건 → 26 기여", () => {
    const mkState = (level: string) =>
      makeState({
        axes: [
          makeAxis("academic_achievement", "academic", "B"),
          makeAxis("academic_attitude", "academic", "B"),
          makeAxis("career_course_effort", "career", "B"),
          makeAxis("career_course_achievement", "career", "B"),
          makeAxis("community_collaboration", "community", "B"),
          makeAxis("community_caring", "community", "B"),
        ],
        awards: {
          items: [{ recordId: "a-1", name: "상", level, relatedCompetencies: [] }],
          leadershipEvidence: [],
          careerRelevance: [],
        },
      });
    const indoor = computeHakjongScoreV2Pre(mkState("교내"));
    const national = computeHakjongScoreV2Pre(mkState("전국"));
    // 교내: weighted_count = 0.8 × 1, score = 16. aux = 16/3 ≈ 5.33
    // community = 65 × 0.7 + 5.33 × 0.3 ≈ 47.1
    expect(indoor.community).toBeCloseTo(47.1, 1);
    // 전국: weighted_count = 1.3, score = 26. aux = 26/3 ≈ 8.67
    // community = 65 × 0.7 + 8.67 × 0.3 ≈ 48.1
    expect(national.community).toBeCloseTo(48.1, 1);
    // 전국 > 교내 기여 확인
    expect(national.community!).toBeGreaterThan(indoor.community!);
  });

  it("교내 5건 → 80 (cap 전), 6건 → 96, 10건 → 100 cap", () => {
    const mkItems = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        recordId: `a-${i}`,
        name: "수상",
        level: "교내",
        relatedCompetencies: [],
      }));
    const mkState = (n: number) =>
      makeState({
        axes: [
          makeAxis("academic_achievement", "academic", "B"),
          makeAxis("academic_attitude", "academic", "B"),
          makeAxis("career_course_effort", "career", "B"),
          makeAxis("career_course_achievement", "career", "B"),
          makeAxis("community_collaboration", "community", "B"),
          makeAxis("community_caring", "community", "B"),
        ],
        awards: {
          items: mkItems(n),
          leadershipEvidence: [],
          careerRelevance: [],
        },
      });

    const five = computeHakjongScoreV2Pre(mkState(5));
    const ten = computeHakjongScoreV2Pre(mkState(10));
    const twenty = computeHakjongScoreV2Pre(mkState(20));
    // 교내 5건: 0.8 × 5 = 4, × 20 = 80
    // 교내 10건: 8, × 20 = 160 → cap 100
    // 20건: cap 100
    expect(ten.community).toBe(twenty.community);
    expect(five.community!).toBeLessThan(ten.community!);
  });

  it("빈 level 문자열 → 중립(1.0) 가중", () => {
    const state = makeState({
      axes: [
        makeAxis("academic_achievement", "academic", "B"),
        makeAxis("academic_attitude", "academic", "B"),
        makeAxis("career_course_effort", "career", "B"),
        makeAxis("career_course_achievement", "career", "B"),
        makeAxis("community_collaboration", "community", "B"),
        makeAxis("community_caring", "community", "B"),
      ],
      awards: {
        items: [
          { recordId: "a-1", name: "상", level: "", relatedCompetencies: [] },
        ],
        leadershipEvidence: [],
        careerRelevance: [],
      },
    });
    const score = computeHakjongScoreV2Pre(state);
    // weighted_count = 1.0, score = 20. aux = 20/3 ≈ 6.67
    // community = 45.5 + 6.67 × 0.3 ≈ 47.5
    expect(score.community).toBeCloseTo(47.5, 1);
  });
});

describe("computeHakjongScoreV2Pre — v1 대비 차이 시나리오", () => {
  it("수상 10건 — v1=100 binary / v2-pre=100 cap 이지만 volunteer 0h 인 경우 차이 없음", () => {
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
      ],
      awards: {
        items: Array.from({ length: 10 }, (_, i) => ({
          recordId: `a-${i}`,
          name: "교내 수상",
          level: "교내",
          relatedCompetencies: [],
        })),
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
    const v1 = computeHakjongScore(state);
    const v2 = computeHakjongScoreV2Pre(state);
    // v1 awards binary = 100 (≥ 1건), v2-pre awards = 100 (10건 × 0.8 × 20 = 160 cap 100)
    // attendance 100, volunteer 없음(v1=0 / v2=0)
    // 두 버전 모두 aux = (0 + 100 + 100) / 3 = 66.67 → community Layer1 65 × 0.7 + 66.67 × 0.3 = 45.5 + 20 = 65.5
    expect(v1.community).toBe(v2.community);
  });

  it("수상 1건 교내 — v1=100 binary vs v2-pre=16 → v2-pre 가 더 보수적", () => {
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
      ],
      awards: {
        items: [
          { recordId: "a-1", name: "학급상", level: "교내", relatedCompetencies: [] },
        ],
        leadershipEvidence: [],
        careerRelevance: [],
      },
    });
    const v1 = computeHakjongScore(state);
    const v2 = computeHakjongScoreV2Pre(state);
    // v1 awards 100 (binary), v2 awards 16 → v2 community < v1 community
    expect(v2.community!).toBeLessThan(v1.community!);
  });
});
