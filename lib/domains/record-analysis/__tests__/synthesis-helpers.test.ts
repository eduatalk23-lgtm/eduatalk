// ============================================
// pipeline/synthesis/helpers.ts — 순수 함수 유닛 테스트
//
// 대상 (DB 호출 없는 순수 함수):
//   - competencyGradeToScore()
//   - buildTimeseriesPromptSection()
//   - buildUniversityMatchPromptSection()
//
// 스킵:
//   - fetchAllYearCompetencyScores() — DB 호출 있음
//   - aggregateQualityPatterns() — pipeline-snapshot.test.ts에서 이미 커버
// ============================================

import { describe, it, expect } from "vitest";
import type { TimeSeriesAnalysis, CompetencyTrend } from "../eval/timeseries-analyzer";
import type { UniversityMatchAnalysis, ProfileMatchResult } from "../eval/university-profile-matcher";
import {
  competencyGradeToScore,
  buildTimeseriesPromptSection,
  buildUniversityMatchPromptSection,
} from "../pipeline/synthesis/helpers";

// ─── 픽스처 팩토리 ──────────────────────────────────────────────────────────

function makeTrend(overrides: Partial<CompetencyTrend> = {}): CompetencyTrend {
  return {
    competencyId: "academic_inquiry",
    competencyName: "학업탐구력",
    points: [],
    growthRate: 10,
    avgDelta: 5,
    trend: "rising",
    isAnomaly: false,
    ...overrides,
  };
}

function makeTimeSeriesAnalysis(overrides: Partial<TimeSeriesAnalysis> = {}): TimeSeriesAnalysis {
  return {
    studentId: "student-1",
    trends: [],
    overallGrowthRate: 0,
    strongestCompetency: "academic_inquiry",
    weakestCompetency: "communication",
    mostImprovedCompetency: "academic_inquiry",
    anomalies: [],
    summary: "전반적으로 안정적인 역량 성장을 보입니다.",
    ...overrides,
  };
}

function makeProfileMatchResult(overrides: Partial<ProfileMatchResult> = {}): ProfileMatchResult {
  return {
    track: "science_engineering" as never,
    label: "이공계열",
    matchScore: 82,
    grade: "A",
    strengths: ["학업탐구력", "수리적사고"],
    gaps: ["의사소통"],
    recommendation: "이공계 진학에 적합한 역량 프로필입니다.",
    ...overrides,
  };
}

function makeUniversityMatchAnalysis(overrides: Partial<UniversityMatchAnalysis> = {}): UniversityMatchAnalysis {
  return {
    studentId: "student-1",
    competencyScores: { academic_inquiry: 85, mathematical_thinking: 80 },
    matches: [makeProfileMatchResult()],
    topMatch: makeProfileMatchResult(),
    summary: "이공계열 적합도가 높습니다.",
    ...overrides,
  };
}

// ============================================
// competencyGradeToScore
// ============================================

describe("competencyGradeToScore()", () => {
  it("A+ → 95", () => {
    expect(competencyGradeToScore("A+")).toBe(95);
  });

  it("A- → 85", () => {
    expect(competencyGradeToScore("A-")).toBe(85);
  });

  it("B+ → 75", () => {
    expect(competencyGradeToScore("B+")).toBe(75);
  });

  it("B → 70", () => {
    expect(competencyGradeToScore("B")).toBe(70);
  });

  it("B- → 60", () => {
    expect(competencyGradeToScore("B-")).toBe(60);
  });

  it("C → 50", () => {
    expect(competencyGradeToScore("C")).toBe(50);
  });

  it("알 수 없는 등급 → 0", () => {
    expect(competencyGradeToScore("D")).toBe(0);
    expect(competencyGradeToScore("")).toBe(0);
    expect(competencyGradeToScore("X")).toBe(0);
    expect(competencyGradeToScore("a+")).toBe(0); // 소문자는 매칭 안 됨
  });

  it("점수 내림차순 순서가 유지된다", () => {
    const grades = ["A+", "A-", "B+", "B", "B-", "C"];
    const scores = grades.map(competencyGradeToScore);

    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i + 1]);
    }
  });

  it("가장 높은 등급은 95, 가장 낮은 정의된 등급은 50", () => {
    expect(competencyGradeToScore("A+")).toBe(95);
    expect(competencyGradeToScore("C")).toBe(50);
  });
});

// ============================================
// buildTimeseriesPromptSection
// ============================================

describe("buildTimeseriesPromptSection()", () => {
  it("헤더와 요약 라인이 포함된다", () => {
    const analysis = makeTimeSeriesAnalysis({
      summary: "3년간 꾸준한 성장을 보입니다.",
      overallGrowthRate: 15,
    });

    const section = buildTimeseriesPromptSection(analysis);

    expect(section).toContain("## 역량 시계열 분석 (학년별 추이)");
    expect(section).toContain("요약: 3년간 꾸준한 성장을 보입니다.");
  });

  it("전체 평균 성장률이 양수이면 '+' 기호가 포함된다", () => {
    const analysis = makeTimeSeriesAnalysis({ overallGrowthRate: 12 });
    const section = buildTimeseriesPromptSection(analysis);
    expect(section).toContain("+12점");
  });

  it("전체 평균 성장률이 음수이면 '+' 없이 수치가 출력된다", () => {
    const analysis = makeTimeSeriesAnalysis({ overallGrowthRate: -5 });
    const section = buildTimeseriesPromptSection(analysis);
    expect(section).toContain("-5점");
    expect(section).not.toContain("+-5");
  });

  it("전체 평균 성장률이 0이면 '+' 없이 0점으로 출력된다", () => {
    const analysis = makeTimeSeriesAnalysis({ overallGrowthRate: 0 });
    const section = buildTimeseriesPromptSection(analysis);
    // 0 > 0은 false이므로 + 기호 없음
    expect(section).toContain("0점");
    expect(section).not.toContain("+0점");
  });

  it("이상 감지 역량이 있으면 '이상 감지' 섹션이 포함된다", () => {
    const anomaly = makeTrend({
      competencyName: "수리적사고",
      trend: "falling",
      isAnomaly: true,
      anomalyReason: "급격한 하락 감지",
    });

    const analysis = makeTimeSeriesAnalysis({ anomalies: [anomaly] });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).toContain("### 이상 감지");
    expect(section).toContain("수리적사고");
    expect(section).toContain("급격한 하락 감지");
  });

  it("이상 감지 역량의 anomalyReason이 없으면 기본 메시지 '이상 감지' 사용", () => {
    const anomaly = makeTrend({
      competencyName: "의사소통",
      isAnomaly: true,
      anomalyReason: undefined,
    });

    const analysis = makeTimeSeriesAnalysis({ anomalies: [anomaly] });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).toContain("이상 감지");
    expect(section).toContain("의사소통");
  });

  it("이상이 없으면 '이상 감지' 섹션이 없다", () => {
    const analysis = makeTimeSeriesAnalysis({ anomalies: [] });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).not.toContain("### 이상 감지");
  });

  it("rising 추세 역량이 있으면 '상승 역량' 섹션이 포함된다", () => {
    const risingTrend = makeTrend({
      competencyName: "학업탐구력",
      trend: "rising",
      growthRate: 20,
    });

    const analysis = makeTimeSeriesAnalysis({ trends: [risingTrend] });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).toContain("### 상승 역량");
    expect(section).toContain("학업탐구력");
    expect(section).toContain("+20");
  });

  it("falling 추세 역량이 있으면 '하락 역량' 섹션이 포함된다", () => {
    const fallingTrend = makeTrend({
      competencyName: "의사소통역량",
      trend: "falling",
      growthRate: -15,
    });

    const analysis = makeTimeSeriesAnalysis({ trends: [fallingTrend] });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).toContain("### 하락 역량");
    expect(section).toContain("의사소통역량");
    expect(section).toContain("-15");
  });

  it("stable 추세는 상승/하락 섹션에 포함되지 않는다", () => {
    const stableTrend = makeTrend({ trend: "stable", growthRate: 1 });

    const analysis = makeTimeSeriesAnalysis({ trends: [stableTrend] });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).not.toContain("### 상승 역량");
    expect(section).not.toContain("### 하락 역량");
  });

  it("volatile 추세는 상승/하락 섹션에 포함되지 않는다", () => {
    const volatileTrend = makeTrend({ trend: "volatile", growthRate: 5 });

    const analysis = makeTimeSeriesAnalysis({ trends: [volatileTrend] });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).not.toContain("### 상승 역량");
    expect(section).not.toContain("### 하락 역량");
  });

  it("복수의 상승 역량이 쉼표로 구분된다", () => {
    const trends = [
      makeTrend({ competencyId: "a1", competencyName: "학업탐구력", trend: "rising", growthRate: 10 }),
      makeTrend({ competencyId: "a2", competencyName: "수리적사고", trend: "rising", growthRate: 8 }),
    ];

    const analysis = makeTimeSeriesAnalysis({ trends });
    const section = buildTimeseriesPromptSection(analysis);

    expect(section).toContain("학업탐구력");
    expect(section).toContain("수리적사고");
    // 두 역량이 같은 줄에 쉼표 구분
    const risingLine = section.split("\n").find((l) => l.includes("### 상승 역량"));
    expect(risingLine).toBeTruthy();
  });

  it("반환 값이 문자열이다", () => {
    const analysis = makeTimeSeriesAnalysis();
    expect(typeof buildTimeseriesPromptSection(analysis)).toBe("string");
  });
});

// ============================================
// buildUniversityMatchPromptSection
// ============================================

describe("buildUniversityMatchPromptSection()", () => {
  it("summary 라인이 포함된다", () => {
    const analysis = makeUniversityMatchAnalysis({ summary: "이공계열 적합도가 높습니다." });
    const section = buildUniversityMatchPromptSection(analysis);

    expect(section).toContain("요약: 이공계열 적합도가 높습니다.");
  });

  it("상위 3개 트랙의 라벨, 등급, 점수가 포함된다", () => {
    const matches = [
      makeProfileMatchResult({ label: "이공계열", grade: "A", matchScore: 82 }),
      makeProfileMatchResult({ label: "의약계열", grade: "B", matchScore: 70 }),
      makeProfileMatchResult({ label: "인문사회계열", grade: "C", matchScore: 60 }),
    ];

    const analysis = makeUniversityMatchAnalysis({ matches });
    const section = buildUniversityMatchPromptSection(analysis);

    expect(section).toContain("이공계열");
    expect(section).toContain("A등급");
    expect(section).toContain("82점");
    expect(section).toContain("의약계열");
    expect(section).toContain("B등급");
    expect(section).toContain("인문사회계열");
    expect(section).toContain("C등급");
  });

  it("4번째 이후 트랙은 포함되지 않는다", () => {
    const matches = [
      makeProfileMatchResult({ label: "이공계열", matchScore: 90 }),
      makeProfileMatchResult({ label: "의약계열", matchScore: 80 }),
      makeProfileMatchResult({ label: "인문사회계열", matchScore: 70 }),
      makeProfileMatchResult({ label: "예체능계열", matchScore: 60 }),
    ];

    const analysis = makeUniversityMatchAnalysis({ matches });
    const section = buildUniversityMatchPromptSection(analysis);

    expect(section).not.toContain("예체능계열");
  });

  it("강점과 갭이 포함된다", () => {
    const match = makeProfileMatchResult({
      strengths: ["학업탐구력", "수리적사고", "문제해결력"],
      gaps: ["의사소통", "협업"],
    });

    const analysis = makeUniversityMatchAnalysis({ matches: [match] });
    const section = buildUniversityMatchPromptSection(analysis);

    expect(section).toContain("학업탐구력");
    expect(section).toContain("의사소통");
  });

  it("강점/갭 구분자가 '/'이다", () => {
    const match = makeProfileMatchResult({
      strengths: ["학업탐구력", "수리적사고"],
      gaps: ["의사소통"],
    });

    const analysis = makeUniversityMatchAnalysis({ matches: [match] });
    const section = buildUniversityMatchPromptSection(analysis);

    expect(section).toContain("강점=학업탐구력/수리적사고");
    expect(section).toContain("갭=의사소통");
  });

  it("recommendation이 '추천:' 레이블과 함께 포함된다", () => {
    const match = makeProfileMatchResult({ recommendation: "이공계 진학에 적합한 역량 프로필입니다." });

    const analysis = makeUniversityMatchAnalysis({ matches: [match] });
    const section = buildUniversityMatchPromptSection(analysis);

    expect(section).toContain("추천: 이공계 진학에 적합한 역량 프로필입니다.");
  });

  it("matches가 비어 있으면 요약만 포함된다", () => {
    const analysis = makeUniversityMatchAnalysis({ matches: [], summary: "매칭 결과 없음" });
    const section = buildUniversityMatchPromptSection(analysis);

    expect(section).toContain("요약: 매칭 결과 없음");
    expect(section).not.toContain("추천:");
  });

  it("반환 값이 문자열이다", () => {
    const analysis = makeUniversityMatchAnalysis();
    expect(typeof buildUniversityMatchPromptSection(analysis)).toBe("string");
  });

  it("단일 트랙만 있으면 해당 트랙 정보만 출력된다", () => {
    const analysis = makeUniversityMatchAnalysis({
      matches: [makeProfileMatchResult({ label: "이공계열", matchScore: 85 })],
    });

    const section = buildUniversityMatchPromptSection(analysis);

    // 이공계열 포함, 다른 계열 없음
    expect(section).toContain("이공계열");
  });
});
