import { describe, it, expect } from "vitest";
import {
  generateExecutiveSummary,
  formatExecutiveSummaryText,
  type CompetencySnapshot,
  type ExecutiveSummaryInput,
} from "../eval/executive-summary";
import type { AggregatedVerification } from "../eval/highlight-verifier";
import type { TimeSeriesAnalysis, CompetencyTrend } from "../eval/timeseries-analyzer";
import type { UniversityMatchAnalysis, ProfileMatchResult } from "../eval/university-profile-matcher";

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

function makeSnapshots(overrides?: Partial<Record<string, number>>): CompetencySnapshot[] {
  const defaults: Record<string, { name: string; score: number }> = {
    academic_achievement: { name: "학업성취도", score: 85 },
    academic_inquiry:    { name: "탐구력", score: 92 },
    academic_attitude:   { name: "학업태도", score: 78 },
    community_collaboration: { name: "협업과 소통능력", score: 70 },
    community_caring:    { name: "나눔과 배려", score: 52 },
    community_leadership: { name: "리더십", score: 45 },
  };
  if (overrides) {
    for (const [id, score] of Object.entries(overrides)) {
      if (defaults[id]) defaults[id].score = score;
    }
  }
  return Object.entries(defaults).map(([competencyId, { name, score }]) => ({
    competencyId,
    competencyName: name,
    score,
  }));
}

function makeAggregatedVerification(passRate: number): AggregatedVerification {
  return {
    passRate,
    exactMatchRate: passRate,
    fuzzyMatchRate: passRate,
    avgSimilarity: passRate / 100,
    avgCoverage: 30,
    total: 10,
    passed: Math.round((passRate / 100) * 10),
    failed: 10 - Math.round((passRate / 100) * 10),
  };
}

function makeCompetencyTrend(
  id: string,
  name: string,
  scores: [number, number, number],
): CompetencyTrend {
  return {
    competencyId: id,
    competencyName: name,
    points: [
      { gradeYear: 1, competencyId: id, competencyName: name, score: scores[0] },
      { gradeYear: 2, competencyId: id, competencyName: name, score: scores[1] },
      { gradeYear: 3, competencyId: id, competencyName: name, score: scores[2] },
    ],
    growthRate: scores[2] - scores[0],
    avgDelta: (scores[2] - scores[0]) / 2,
    trend: scores[2] > scores[0] ? "rising" : scores[2] < scores[0] ? "falling" : "stable",
    isAnomaly: false,
  };
}

function makeTimeSeriesAnalysis(overallGrowthRate = 12): TimeSeriesAnalysis {
  const t1 = makeCompetencyTrend("academic_inquiry", "탐구력", [74, 83, 92]);
  const t2 = makeCompetencyTrend("community_leadership", "리더십", [30, 38, 45]);
  return {
    studentId: "test-student",
    trends: [t1, t2],
    overallGrowthRate,
    strongestCompetency: "academic_inquiry",
    weakestCompetency: "community_leadership",
    mostImprovedCompetency: "academic_inquiry",
    anomalies: [],
    summary: `전반적 성장세 / 강점: 탐구력 / 보완 필요: 리더십`,
  };
}

function makeUniversityMatch(): UniversityMatchAnalysis {
  const top: ProfileMatchResult = {
    track: "medical",
    label: "의학/치의학/한의학",
    matchScore: 94,
    grade: "S",
    strengths: ["학업성취도", "탐구력"],
    gaps: ["리더십"],
    recommendation: "의학계열 최적 프로필.",
  };
  const second: ProfileMatchResult = {
    track: "engineering",
    label: "공학/이공계",
    matchScore: 85,
    grade: "A",
    strengths: ["탐구력"],
    gaps: ["리더십"],
    recommendation: "이공계 적합.",
  };
  const third: ProfileMatchResult = {
    track: "education",
    label: "사범/교육",
    matchScore: 72,
    grade: "B",
    strengths: ["학업성취도"],
    gaps: ["리더십"],
    recommendation: "교육계열 기본 적합.",
  };
  return {
    studentId: "test-student",
    competencyScores: { academic_achievement: 85, academic_inquiry: 92 },
    matches: [top, second, third],
    topMatch: top,
    summary: "최적 계열: 의학/치의학/한의학 (S등급, 94점).",
  };
}

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe("generateExecutiveSummary", () => {
  // T1. 완전한 입력 (A2+A3+B1 모두 있음)
  it("T1: 완전한 입력으로 모든 필드가 채워진다", () => {
    const input: ExecutiveSummaryInput = {
      studentId: "stu-001",
      studentName: "홍길동",
      competencySnapshots: makeSnapshots(),
      highlightVerification: makeAggregatedVerification(85),
      timeSeriesAnalysis: makeTimeSeriesAnalysis(),
      universityMatch: makeUniversityMatch(),
    };
    const summary = generateExecutiveSummary(input);

    expect(summary.studentId).toBe("stu-001");
    expect(summary.studentName).toBe("홍길동");
    expect(summary.overallScore).toBeGreaterThan(0);
    expect(summary.overallGrade).toBeDefined();
    expect(summary.highlightQuality).toBe(85);
    expect(summary.growthTrend).toBeDefined();
    expect(summary.topStrengths.length).toBe(3);
    expect(summary.topWeaknesses.length).toBe(3);
    expect(summary.mostImprovedCompetency).toBeDefined();
    expect(summary.anomalyCount).toBe(0);
    expect(summary.topUniversityMatches).toHaveLength(3);
    expect(summary.narrative).toBeTruthy();
    expect(summary.sections.keyMetrics).toBeTruthy();
    expect(summary.sections.competencyProfile).toBeTruthy();
    expect(summary.sections.growthTrend).toBeTruthy();
    expect(summary.sections.universityFit).toBeTruthy();
    expect(summary.sections.opinion).toBeTruthy();
  });

  // T2. 부분 입력 — A2/A3/B1 모두 없음
  it("T2: 선택적 필드 없이도 기본 필드는 채워진다", () => {
    const input: ExecutiveSummaryInput = {
      studentId: "stu-002",
      competencySnapshots: makeSnapshots(),
    };
    const summary = generateExecutiveSummary(input);

    expect(summary.studentId).toBe("stu-002");
    expect(summary.studentName).toBe("학생"); // 기본값
    expect(summary.overallScore).toBeGreaterThan(0);
    expect(summary.highlightQuality).toBeUndefined();
    expect(summary.growthTrend).toBeUndefined();
    expect(summary.mostImprovedCompetency).toBeUndefined();
    expect(summary.anomalyCount).toBeUndefined();
    expect(summary.topUniversityMatches).toBeUndefined();
    expect(summary.narrative).toBeTruthy();
  });

  // T3. A2만 있는 경우
  it("T3: A2만 있는 경우 highlightQuality가 채워진다", () => {
    const input: ExecutiveSummaryInput = {
      studentId: "stu-003",
      competencySnapshots: makeSnapshots(),
      highlightVerification: makeAggregatedVerification(72),
    };
    const summary = generateExecutiveSummary(input);
    expect(summary.highlightQuality).toBe(72);
    expect(summary.growthTrend).toBeUndefined();
    expect(summary.topUniversityMatches).toBeUndefined();
  });

  // T4. A3만 있는 경우
  it("T4: A3만 있는 경우 시계열 필드가 채워진다", () => {
    const input: ExecutiveSummaryInput = {
      studentId: "stu-004",
      competencySnapshots: makeSnapshots(),
      timeSeriesAnalysis: makeTimeSeriesAnalysis(),
    };
    const summary = generateExecutiveSummary(input);
    expect(summary.highlightQuality).toBeUndefined();
    expect(summary.growthTrend).toBeDefined();
    expect(summary.mostImprovedCompetency).toBeDefined();
    expect(summary.anomalyCount).toBe(0);
    expect(summary.topUniversityMatches).toBeUndefined();
  });

  // T5. B1만 있는 경우
  it("T5: B1만 있는 경우 대학 적합도 필드가 채워진다", () => {
    const input: ExecutiveSummaryInput = {
      studentId: "stu-005",
      competencySnapshots: makeSnapshots(),
      universityMatch: makeUniversityMatch(),
    };
    const summary = generateExecutiveSummary(input);
    expect(summary.highlightQuality).toBeUndefined();
    expect(summary.growthTrend).toBeUndefined();
    expect(summary.topUniversityMatches).toHaveLength(3);
    expect(summary.topUniversityMatches![0].label).toBe("의학/치의학/한의학");
  });

  // T6. 등급 경계값 — 89.9 → A
  it("T6: 89.9점은 A등급이다", () => {
    const snapshots = [{ competencyId: "x", competencyName: "역량X", score: 89.9 }];
    const summary = generateExecutiveSummary({
      studentId: "stu-006",
      competencySnapshots: snapshots,
    });
    expect(summary.overallScore).toBeCloseTo(89.9, 0);
    expect(summary.overallGrade).toBe("A");
  });

  // T7. 등급 경계값 — 90.0 → S
  it("T7: 90.0점은 S등급이다", () => {
    const snapshots = [{ competencyId: "x", competencyName: "역량X", score: 90 }];
    const summary = generateExecutiveSummary({
      studentId: "stu-007",
      competencySnapshots: snapshots,
    });
    expect(summary.overallGrade).toBe("S");
  });

  // T8. 등급 경계값 — 80.0 → A
  it("T8: 80.0점은 A등급이다", () => {
    const snapshots = [{ competencyId: "x", competencyName: "역량X", score: 80 }];
    const summary = generateExecutiveSummary({
      studentId: "stu-008",
      competencySnapshots: snapshots,
    });
    expect(summary.overallGrade).toBe("A");
  });

  // T9. 등급 경계값 — 79.9 → B
  it("T9: 79.9점은 B등급이다", () => {
    const snapshots = [{ competencyId: "x", competencyName: "역량X", score: 79.9 }];
    const summary = generateExecutiveSummary({
      studentId: "stu-009",
      competencySnapshots: snapshots,
    });
    expect(summary.overallGrade).toBe("B");
  });

  // T10. 등급 경계값 — 59.9 → D
  it("T10: 59.9점은 D등급이다", () => {
    const snapshots = [{ competencyId: "x", competencyName: "역량X", score: 59.9 }];
    const summary = generateExecutiveSummary({
      studentId: "stu-010",
      competencySnapshots: snapshots,
    });
    expect(summary.overallGrade).toBe("D");
  });

  // T11. 전체 평균 계산 정확성
  it("T11: 역량 점수 평균이 올바르게 계산된다", () => {
    const snapshots: CompetencySnapshot[] = [
      { competencyId: "a", competencyName: "A", score: 80 },
      { competencyId: "b", competencyName: "B", score: 90 },
      { competencyId: "c", competencyName: "C", score: 70 },
    ];
    const summary = generateExecutiveSummary({ studentId: "stu-011", competencySnapshots: snapshots });
    // (80+90+70)/3 = 80.0
    expect(summary.overallScore).toBeCloseTo(80, 1);
  });

  // T12. 강점 TOP3는 점수 내림차순이다
  it("T12: topStrengths는 점수 내림차순으로 정렬된다", () => {
    const summary = generateExecutiveSummary({
      studentId: "stu-012",
      competencySnapshots: makeSnapshots(),
    });
    const scores = summary.topStrengths.map((s) => s.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  // T13. 약점 TOP3는 점수 오름차순이다
  it("T13: topWeaknesses는 점수 오름차순으로 정렬된다", () => {
    const summary = generateExecutiveSummary({
      studentId: "stu-013",
      competencySnapshots: makeSnapshots(),
    });
    const scores = summary.topWeaknesses.map((s) => s.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  // T14. narrative에 강점 역량 이름이 포함된다
  it("T14: narrative에 강점 TOP2 역량 이름이 포함된다", () => {
    const input: ExecutiveSummaryInput = {
      studentId: "stu-014",
      studentName: "김철수",
      competencySnapshots: makeSnapshots(),
    };
    const summary = generateExecutiveSummary(input);
    // 강점 TOP2는 탐구력(92), 학업성취도(85)
    expect(summary.narrative).toContain("탐구력");
  });

  // T15. narrative에 대학 트랙 이름이 포함된다 (B1 있을 때)
  it("T15: B1 결과가 있으면 narrative에 대학 계열명이 포함된다", () => {
    const input: ExecutiveSummaryInput = {
      studentId: "stu-015",
      competencySnapshots: makeSnapshots(),
      universityMatch: makeUniversityMatch(),
    };
    const summary = generateExecutiveSummary(input);
    expect(summary.narrative).toContain("의학");
  });

  // T16. A3 이상 감지 건수 반영
  it("T16: A3 이상 감지가 있으면 anomalyCount가 반영된다", () => {
    const anomalousTrend = makeCompetencyTrend("academic_achievement", "학업성취도", [90, 70, 50]);
    anomalousTrend.isAnomaly = true;
    anomalousTrend.anomalyReason = "급격한 하락";
    anomalousTrend.trend = "falling";

    const tsAnalysis: TimeSeriesAnalysis = {
      studentId: "stu-016",
      trends: [anomalousTrend],
      overallGrowthRate: -40,
      strongestCompetency: "academic_achievement",
      weakestCompetency: "academic_achievement",
      mostImprovedCompetency: "",
      anomalies: [anomalousTrend],
      summary: "하락세",
    };

    const summary = generateExecutiveSummary({
      studentId: "stu-016",
      competencySnapshots: makeSnapshots(),
      timeSeriesAnalysis: tsAnalysis,
    });
    expect(summary.anomalyCount).toBe(1);
  });

  // T17. sections 필드가 모두 존재한다
  it("T17: sections에 5개 섹션이 모두 존재한다", () => {
    const summary = generateExecutiveSummary({
      studentId: "stu-017",
      competencySnapshots: makeSnapshots(),
    });
    expect(summary.sections.keyMetrics).toBeTruthy();
    expect(summary.sections.competencyProfile).toBeTruthy();
    expect(summary.sections.growthTrend).toBeTruthy();
    expect(summary.sections.universityFit).toBeTruthy();
    expect(summary.sections.opinion).toBeTruthy();
  });

  // T18. generatedAt은 유효한 ISO 8601이다
  it("T18: generatedAt은 유효한 ISO 8601 타임스탬프다", () => {
    const summary = generateExecutiveSummary({
      studentId: "stu-018",
      competencySnapshots: makeSnapshots(),
    });
    expect(new Date(summary.generatedAt).toISOString()).toBe(summary.generatedAt);
  });

  // T19. 역량 스냅샷 1개만 있어도 동작한다
  it("T19: 역량 스냅샷 1개만 있어도 graceful degradation된다", () => {
    const snapshots: CompetencySnapshot[] = [
      { competencyId: "academic_achievement", competencyName: "학업성취도", score: 75 },
    ];
    const summary = generateExecutiveSummary({ studentId: "stu-019", competencySnapshots: snapshots });
    expect(summary.overallScore).toBe(75);
    expect(summary.topStrengths.length).toBe(1);
    expect(summary.topWeaknesses.length).toBe(1);
    expect(summary.narrative).toBeTruthy();
  });

  // T20. 대학 적합도가 3개 미만이면 실제 개수만 포함
  it("T20: B1 매칭 결과가 3개 미만이면 실제 개수만 반환한다", () => {
    const singleMatch: ProfileMatchResult = {
      track: "medical",
      label: "의학/치의학/한의학",
      matchScore: 94,
      grade: "S",
      strengths: ["학업성취도"],
      gaps: ["리더십"],
      recommendation: "의학계열 최적.",
    };
    const universityMatch: UniversityMatchAnalysis = {
      studentId: "stu-020",
      competencyScores: {},
      matches: [singleMatch],
      topMatch: singleMatch,
      summary: "최적: 의학계열",
    };
    const summary = generateExecutiveSummary({
      studentId: "stu-020",
      competencySnapshots: makeSnapshots(),
      universityMatch,
    });
    expect(summary.topUniversityMatches).toHaveLength(1);
  });

  // T21. 시계열에서 volatile 추이가 반영된다
  it("T21: 시계열에 volatile 추이가 있으면 growthTrend에 반영된다", () => {
    const volatile = makeCompetencyTrend("academic_inquiry", "탐구력", [70, 90, 75]);
    volatile.trend = "volatile";
    const tsAnalysis: TimeSeriesAnalysis = {
      studentId: "stu-021",
      trends: [volatile],
      overallGrowthRate: 5,
      strongestCompetency: "academic_inquiry",
      weakestCompetency: "academic_inquiry",
      mostImprovedCompetency: "academic_inquiry",
      anomalies: [],
      summary: "변동세",
    };
    const summary = generateExecutiveSummary({
      studentId: "stu-021",
      competencySnapshots: makeSnapshots(),
      timeSeriesAnalysis: tsAnalysis,
    });
    expect(summary.growthTrend).toBe("volatile");
  });

  // T22. 시계열 most improved가 없으면 mostImprovedCompetency가 undefined
  it("T22: mostImprovedCompetency가 빈 문자열이면 undefined를 반환한다", () => {
    const tsAnalysis: TimeSeriesAnalysis = {
      studentId: "stu-022",
      trends: [],
      overallGrowthRate: 0,
      strongestCompetency: "",
      weakestCompetency: "",
      mostImprovedCompetency: "",
      anomalies: [],
      summary: "데이터 없음",
    };
    const summary = generateExecutiveSummary({
      studentId: "stu-022",
      competencySnapshots: makeSnapshots(),
      timeSeriesAnalysis: tsAnalysis,
    });
    expect(summary.mostImprovedCompetency).toBeUndefined();
  });

  // T23. highlightQuality 0%도 올바르게 처리된다
  it("T23: highlightQuality 0%도 정상 반영된다", () => {
    const summary = generateExecutiveSummary({
      studentId: "stu-023",
      competencySnapshots: makeSnapshots(),
      highlightVerification: makeAggregatedVerification(0),
    });
    expect(summary.highlightQuality).toBe(0);
  });
});

describe("formatExecutiveSummaryText", () => {
  // T24. 출력 텍스트에 학생 이름이 포함된다
  it("T24: 출력 텍스트에 학생 이름이 포함된다", () => {
    const summary = generateExecutiveSummary({
      studentId: "stu-024",
      studentName: "박지민",
      competencySnapshots: makeSnapshots(),
    });
    const text = formatExecutiveSummaryText(summary);
    expect(text).toContain("박지민");
  });

  // T25. 출력 텍스트에 5개 섹션 헤더가 모두 포함된다
  it("T25: 출력 텍스트에 5개 섹션 헤더가 모두 포함된다", () => {
    const summary = generateExecutiveSummary({
      studentId: "stu-025",
      competencySnapshots: makeSnapshots(),
    });
    const text = formatExecutiveSummaryText(summary);
    expect(text).toContain("1. 핵심 지표");
    expect(text).toContain("2. 역량 프로필");
    expect(text).toContain("3. 성장 추이");
    expect(text).toContain("4. 대학 적합도");
    expect(text).toContain("5. 종합 의견");
  });
});
