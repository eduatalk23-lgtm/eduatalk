import { describe, it, expect } from "vitest";
import {
  detectTrend,
  detectAnomalies,
  analyzeTimeSeries,
  type TimeSeriesPoint,
  type CompetencyTrend,
} from "../eval/timeseries-analyzer";

// ============================================
// timeseries-analyzer.ts 테스트
// A3: 생기부 역량 시계열 분석 엔진
// ============================================

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function makePoints(
  competencyId: string,
  competencyName: string,
  entries: [gradeYear: 1 | 2 | 3, score: number][],
): TimeSeriesPoint[] {
  return entries.map(([gradeYear, score]) => ({
    gradeYear,
    competencyId,
    competencyName,
    score,
  }));
}

function makeTrend(scores: number[], gradeYears?: (1 | 2 | 3)[]): CompetencyTrend {
  const years: (1 | 2 | 3)[] = gradeYears ?? ([1, 2, 3].slice(0, scores.length) as (1 | 2 | 3)[]);
  const points: TimeSeriesPoint[] = scores.map((score, i) => ({
    gradeYear: years[i],
    competencyId: "test",
    competencyName: "테스트 역량",
    score,
  }));
  return {
    competencyId: "test",
    competencyName: "테스트 역량",
    points,
    growthRate: scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0,
    avgDelta: 0,
    trend: "stable",
    isAnomaly: false,
  };
}

// ─── detectTrend ───────────────────────────────────────────────────────────

describe("detectTrend — 단일 학년", () => {
  it("점수 1개면 stable", () => {
    expect(detectTrend([70])).toBe("stable");
  });
});

describe("detectTrend — rising", () => {
  it("모든 delta > 0, avg > 3 → rising", () => {
    // deltas: [+10, +10] → avg=10 > 3, allRising=true
    expect(detectTrend([60, 70, 80])).toBe("rising");
  });

  it("allRising AND avg > 3 → rising", () => {
    // deltas: [+8, +2] → avg=5 > 3, allRising=true
    expect(detectTrend([60, 68, 70])).toBe("rising");
  });

  it("delta 합이 threshold를 넘고 allRising → rising", () => {
    // deltas: [+5, +5] → avg=5 > 3, allRising=true
    expect(detectTrend([50, 55, 60])).toBe("rising");
  });
});

describe("detectTrend — falling", () => {
  it("모든 delta < 0 → falling", () => {
    expect(detectTrend([80, 70, 60])).toBe("falling");
  });

  it("평균 delta < -3 이고 allFalling → falling", () => {
    expect(detectTrend([80, 75, 70])).toBe("falling");
  });
});

describe("detectTrend — stable", () => {
  it("|평균 delta| ≤ 3 → stable (소폭 상승도 stable)", () => {
    // deltas: [+2, +1] → avg=1.5 ≤ 3 → stable
    expect(detectTrend([70, 72, 73])).toBe("stable");
  });

  it("동일 점수 → stable", () => {
    expect(detectTrend([70, 70, 70])).toBe("stable");
  });

  it("2학년까지만 있고 delta=2 ≤ 3 → stable", () => {
    // delta=2 → avg=2 ≤ 3 → stable
    expect(detectTrend([70, 72])).toBe("stable");
  });

  it("소폭 하락도 stable (avg=-2 ≥ -3)", () => {
    // deltas: [-2, -2] → avg=-2 → |avg|=2 ≤ 3 → stable
    expect(detectTrend([74, 72, 70])).toBe("stable");
  });
});

describe("detectTrend — volatile", () => {
  it("상승 후 하락 — avg > 3이지만 allRising 아님 → volatile", () => {
    // deltas: [+10, -2] → avg=4 > 3, allRising=false → volatile
    expect(detectTrend([60, 70, 68])).toBe("volatile");
  });

  it("하락 후 상승 — avg < -3이지만 allFalling 아님 → volatile", () => {
    // deltas: [-10, +2] → avg=-4 < -3, allFalling=false → volatile
    expect(detectTrend([70, 60, 62])).toBe("volatile");
  });

  it("큰 상승 후 하락 — avg > 3, 방향 혼재 → volatile", () => {
    // deltas: [+20, -10] → avg=5 > 3, allRising=false → volatile
    expect(detectTrend([50, 70, 60])).toBe("volatile");
  });
});

// ─── detectAnomalies ───────────────────────────────────────────────────────

describe("detectAnomalies — 정상", () => {
  it("정상 성장 추이 → 이상 없음", () => {
    const trend = makeTrend([60, 70, 80]);
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it("단일 학년만 있으면 이상 감지 불가 → false", () => {
    const trend = makeTrend([70], [1]);
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(false);
  });
});

describe("detectAnomalies — 급격한 하락", () => {
  it("구간 delta < -15 → 이상 감지", () => {
    // 70 → 50: delta = -20
    const trend = makeTrend([70, 50, 52]);
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain("급격한 하락");
  });

  it("delta = -15 이하가 경계값 → 이상 감지", () => {
    // 70 → 54: delta = -16
    const trend = makeTrend([70, 54]);
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain("급격한 하락");
  });

  it("delta = -14 → 급격 하락 아님", () => {
    // 70 → 56: delta = -14
    const trend = makeTrend([70, 56, 58]);
    // 정체 범위 확인: max=70, min=56, range=14 → 정체 아님
    // 역전: 3학년(58) - 1학년(70) = -12 → 역전임 (-12 < -10)
    const result = detectAnomalies(trend);
    // 급격 하락은 없지만 역전 이상 감지 가능
    expect(result.isAnomaly).toBe(true);
  });
});

describe("detectAnomalies — 정체", () => {
  it("max-min < 2 → 정체 이상 감지", () => {
    // 70, 70, 71 → range=1 → 정체
    const trend = makeTrend([70, 70, 71]);
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain("정체");
  });

  it("동일 점수 연속 → 정체", () => {
    const trend = makeTrend([65, 65, 65]);
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain("정체");
  });

  it("range = 2 이상이면 정체 아님", () => {
    // 70, 70, 72 → range=2 → 정체 아님 (< 2 조건이므로 2는 정상)
    const trend = makeTrend([70, 70, 72]);
    const result = detectAnomalies(trend);
    // range=2이고 delta=-10 이상이면 역전 확인
    // 3학년(72) - 1학년(70) = 2 → 역전 아님
    expect(result.isAnomaly).toBe(false);
  });
});

describe("detectAnomalies — 역전", () => {
  it("3학년 점수 < 1학년 점수 - 10 → 역전 이상 감지", () => {
    // 1학년=80, 3학년=68 → 역전 = -12 < -10
    const trend = makeTrend([80, 75, 68]);
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toContain("역전");
  });

  it("역전 경계값 = -10 → 이상 아님", () => {
    // 1학년=80, 3학년=70 → 역전 = -10, 조건은 < -10 → 이상 아님
    const trend = makeTrend([80, 75, 70]);
    // range = 80-70=10 → 정체 아님
    // delta: -5, -5 → avg=-5 < -3 → falling이지만 이상은 아님
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(false);
  });

  it("1학년이나 3학년 데이터 없으면 역전 감지 안 함 (2학년만)", () => {
    const trend = makeTrend([60, 70], [1, 2]);
    // range=10, delta=-0 → 정체 아님, 급격 하락 아님, 역전 불가
    const result = detectAnomalies(trend);
    expect(result.isAnomaly).toBe(false);
  });
});

// ─── analyzeTimeSeries ─────────────────────────────────────────────────────

describe("analyzeTimeSeries — 빈 데이터", () => {
  it("빈 포인트 목록 → 빈 결과 반환 (크래시 없음)", () => {
    const result = analyzeTimeSeries("student-1", []);
    expect(result.studentId).toBe("student-1");
    expect(result.trends).toHaveLength(0);
    expect(result.anomalies).toHaveLength(0);
    expect(result.summary).toContain("없습니다");
  });
});

describe("analyzeTimeSeries — 단일 역량 단일 학년", () => {
  it("1학년 데이터만 있어도 동작", () => {
    const points = makePoints("academic_achievement", "학업 성취", [[1, 75]]);
    const result = analyzeTimeSeries("student-1", points);
    expect(result.trends).toHaveLength(1);
    expect(result.trends[0].growthRate).toBe(0);
    expect(result.trends[0].trend).toBe("stable");
    expect(result.strongestCompetency).toBe("academic_achievement");
    expect(result.weakestCompetency).toBe("academic_achievement");
  });
});

describe("analyzeTimeSeries — 성장 시나리오", () => {
  it("지속 상승 — overallGrowthRate 양수, trend=rising", () => {
    const points = [
      ...makePoints("academic_achievement", "학업 성취", [[1, 60], [2, 70], [3, 80]]),
      ...makePoints("career_exploration", "진로 탐색", [[1, 55], [2, 65], [3, 75]]),
    ];
    const result = analyzeTimeSeries("student-A", points);
    expect(result.overallGrowthRate).toBeGreaterThan(0);
    result.trends.forEach((t) => {
      expect(t.trend).toBe("rising");
      expect(t.growthRate).toBeGreaterThan(0);
    });
  });
});

describe("analyzeTimeSeries — 하락 시나리오", () => {
  it("지속 하락 — overallGrowthRate 음수, trend=falling", () => {
    const points = makePoints("community_collaboration", "공동체 협력", [
      [1, 80],
      [2, 70],
      [3, 60],
    ]);
    const result = analyzeTimeSeries("student-B", points);
    expect(result.overallGrowthRate).toBeLessThan(0);
    expect(result.trends[0].trend).toBe("falling");
  });
});

describe("analyzeTimeSeries — 정체 시나리오", () => {
  it("모든 학년 동일 점수 → stable + 이상(정체) 감지", () => {
    const points = makePoints("academic_attitude", "학업 태도", [
      [1, 70],
      [2, 70],
      [3, 70],
    ]);
    const result = analyzeTimeSeries("student-C", points);
    expect(result.trends[0].trend).toBe("stable");
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].anomalyReason).toContain("정체");
  });
});

describe("analyzeTimeSeries — 변동(volatile) 시나리오", () => {
  it("상승 후 하락 → volatile", () => {
    // deltas: [+12, -4] → avg=4>3, allRising=false → volatile
    const points = makePoints("career_course_effort", "진로 과목 노력", [
      [1, 58],
      [2, 70],
      [3, 66],
    ]);
    const result = analyzeTimeSeries("student-D", points);
    expect(result.trends[0].trend).toBe("volatile");
  });
});

describe("analyzeTimeSeries — 강약 역량 추적", () => {
  it("strongest: 최종 학년 점수 가장 높은 역량", () => {
    const points = [
      ...makePoints("academic_achievement", "학업 성취", [[1, 60], [2, 65], [3, 90]]),
      ...makePoints("community_caring", "공동체 배려", [[1, 70], [2, 72], [3, 75]]),
      ...makePoints("career_exploration", "진로 탐색", [[1, 80], [2, 78], [3, 70]]),
    ];
    const result = analyzeTimeSeries("student-E", points);
    expect(result.strongestCompetency).toBe("academic_achievement"); // 3학년 90점
    expect(result.weakestCompetency).toBe("career_exploration");      // 3학년 70점
  });

  it("mostImproved: 성장률 가장 높은 역량", () => {
    const points = [
      ...makePoints("academic_achievement", "학업 성취", [[1, 50], [2, 70], [3, 85]]),
      ...makePoints("community_caring", "공동체 배려", [[1, 70], [2, 72], [3, 75]]),
    ];
    const result = analyzeTimeSeries("student-F", points);
    expect(result.mostImprovedCompetency).toBe("academic_achievement"); // 성장률 35
  });
});

describe("analyzeTimeSeries — 이상 감지 통합", () => {
  it("급격 하락 역량 → anomalies 목록에 포함", () => {
    const points = [
      ...makePoints("academic_achievement", "학업 성취", [[1, 80], [2, 55], [3, 60]]),
      ...makePoints("community_caring", "공동체 배려", [[1, 60], [2, 65], [3, 70]]),
    ];
    const result = analyzeTimeSeries("student-G", points);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].competencyId).toBe("academic_achievement");
    expect(result.anomalies[0].anomalyReason).toContain("급격한 하락");
  });

  it("역전 역량 → anomalies에 포함, 정상 역량은 제외", () => {
    const points = [
      ...makePoints("academic_achievement", "학업 성취", [[1, 85], [2, 80], [3, 72]]),
      ...makePoints("career_exploration", "진로 탐색", [[1, 60], [2, 65], [3, 70]]),
    ];
    const result = analyzeTimeSeries("student-H", points);
    const anomalyIds = result.anomalies.map((a) => a.competencyId);
    expect(anomalyIds).toContain("academic_achievement");
    expect(anomalyIds).not.toContain("career_exploration");
  });

  it("복수 이상 역량 → 전부 anomalies에 포함", () => {
    const points = [
      ...makePoints("academic_achievement", "학업 성취", [[1, 80], [2, 58], [3, 62]]),  // 급격 하락
      ...makePoints("community_caring", "공동체 배려", [[1, 90], [2, 78], [3, 76]]),    // 역전 (-14)
      ...makePoints("career_exploration", "진로 탐색", [[1, 65], [2, 68], [3, 70]]),    // 정상
    ];
    const result = analyzeTimeSeries("student-I", points);
    expect(result.anomalies.length).toBeGreaterThanOrEqual(2);
  });
});

describe("analyzeTimeSeries — summary", () => {
  it("성장세 summary에 '전반적 성장세' 포함", () => {
    const points = makePoints("academic_achievement", "학업 성취", [
      [1, 60],
      [2, 70],
      [3, 80],
    ]);
    const result = analyzeTimeSeries("student-J", points);
    expect(result.summary).toContain("성장세");
  });

  it("하락세 summary에 '전반적 하락세' 포함", () => {
    const points = makePoints("community_caring", "공동체 배려", [
      [1, 80],
      [2, 70],
      [3, 60],
    ]);
    const result = analyzeTimeSeries("student-K", points);
    expect(result.summary).toContain("하락세");
  });

  it("summary에 강점 역량명 포함", () => {
    const points = makePoints("academic_achievement", "학업 성취", [
      [1, 70],
      [2, 72],
      [3, 74],
    ]);
    const result = analyzeTimeSeries("student-L", points);
    expect(result.summary).toContain("학업 성취");
  });
});

describe("analyzeTimeSeries — 학년 순서 보장", () => {
  it("비순서 입력이어도 학년 오름차순으로 정렬", () => {
    const points: TimeSeriesPoint[] = [
      { gradeYear: 3, competencyId: "c1", competencyName: "역량1", score: 80 },
      { gradeYear: 1, competencyId: "c1", competencyName: "역량1", score: 60 },
      { gradeYear: 2, competencyId: "c1", competencyName: "역량1", score: 70 },
    ];
    const result = analyzeTimeSeries("student-M", points);
    const trend = result.trends[0];
    expect(trend.points[0].gradeYear).toBe(1);
    expect(trend.points[1].gradeYear).toBe(2);
    expect(trend.points[2].gradeYear).toBe(3);
    expect(trend.growthRate).toBe(20); // 80 - 60
  });
});

describe("analyzeTimeSeries — 2학년까지만 있는 케이스", () => {
  it("1,2학년 데이터만 있어도 정상 동작", () => {
    const points = makePoints("academic_achievement", "학업 성취", [
      [1, 65],
      [2, 75],
    ]);
    const result = analyzeTimeSeries("student-N", points);
    expect(result.trends[0].growthRate).toBe(10);
    expect(result.trends[0].trend).toBe("rising");
    expect(result.trends[0].points).toHaveLength(2);
  });
});
