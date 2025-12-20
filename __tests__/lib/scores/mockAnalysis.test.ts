import { describe, it, expect } from "vitest";

/**
 * mockAnalysis 단위 테스트
 * 
 * calculateMockStats 함수의 로직을 직접 테스트합니다.
 */

// calculateMockStats 함수의 로직을 재현
type MockRow = {
  subject_group_name: string;
  percentile: number | null;
  standard_score: number | null;
  grade_score: number | null;
};

function calculateMockStats(
  rows: MockRow[],
  subjectGroupMap: Map<string, string> = new Map()
): {
  avgPercentile: number | null;
  totalStdScore: number | null;
  best3GradeSum: number | null;
} {
  const findSubjectGroup = (targetNames: string[]): string[] => {
    const foundNames: string[] = [];
    for (const [name] of subjectGroupMap.entries()) {
      if (targetNames.includes(name)) {
        foundNames.push(name);
      }
    }
    return foundNames.length > 0 ? foundNames : targetNames;
  };

  const koreanMathNames = findSubjectGroup(["국어", "수학"]);
  const koreanName = koreanMathNames.find((n) => n === "국어") || koreanMathNames[0];
  const mathName = koreanMathNames.find((n) => n === "수학") || koreanMathNames[1];

  const getOne = (name: string) =>
    rows.find((r) => r.subject_group_name === name && r.percentile != null);

  const korean = koreanName ? getOne(koreanName) : null;
  const math = mathName ? getOne(mathName) : null;

  const inquiryNames = findSubjectGroup(["사회", "과학"]);
  const inquiryRows = rows
    .filter(
      (r) =>
        inquiryNames.includes(r.subject_group_name) && r.percentile != null
    )
    .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
    .slice(0, 2);

  const inquiryAvgPct =
    inquiryRows.length > 0
      ? inquiryRows.reduce((s, r) => s + (r.percentile ?? 0), 0) / inquiryRows.length
      : null;

  const avgPercentile =
    korean?.percentile != null &&
    math?.percentile != null &&
    inquiryAvgPct != null
      ? (korean.percentile + math.percentile + inquiryAvgPct) / 3
      : null;

  const totalStdScore =
    (korean?.standard_score ?? 0) +
    (math?.standard_score ?? 0) +
    inquiryRows.reduce((s, r) => s + (r.standard_score ?? 0), 0);

  const gradeSubjectNames = findSubjectGroup(["국어", "수학", "영어", "사회", "과학"]);
  const gradeCandidates = rows.filter(
    (r) =>
      gradeSubjectNames.includes(r.subject_group_name) &&
      r.grade_score != null
  );

  const best3GradeSum =
    gradeCandidates.length > 0
      ? gradeCandidates
          .sort((a, b) => (a.grade_score ?? 9) - (b.grade_score ?? 9))
          .slice(0, 3)
          .reduce((s, r) => s + (r.grade_score ?? 0), 0)
      : null;

  return {
    avgPercentile,
    totalStdScore: totalStdScore > 0 ? totalStdScore : null,
    best3GradeSum,
  };
}

describe("calculateMockStats", () => {
  it("평균 백분위가 정상적으로 계산되어야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: 2 },
      { subject_group_name: "수학", percentile: 85, standard_score: 125, grade_score: 3 },
      { subject_group_name: "사회", percentile: 80, standard_score: 120, grade_score: 4 },
      { subject_group_name: "과학", percentile: 75, standard_score: 115, grade_score: 5 },
    ];

    const result = calculateMockStats(mockRows);

    // 국어: 90, 수학: 85, 탐구 상위 2개 평균: (80+75)/2 = 77.5
    // 평균: (90 + 85 + 77.5) / 3 = 252.5 / 3 ≈ 84.17
    expect(result.avgPercentile).toBeCloseTo(84.17, 2);
  });

  it("평균 백분위 계산 시 필수 과목이 없으면 null을 반환해야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: 2 },
      // 수학 없음
      { subject_group_name: "사회", percentile: 80, standard_score: 120, grade_score: 4 },
    ];

    const result = calculateMockStats(mockRows);

    expect(result.avgPercentile).toBeNull();
  });

  it("표준점수 합이 정상적으로 계산되어야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: 2 },
      { subject_group_name: "수학", percentile: 85, standard_score: 125, grade_score: 3 },
      { subject_group_name: "사회", percentile: 80, standard_score: 120, grade_score: 4 },
      { subject_group_name: "과학", percentile: 75, standard_score: 115, grade_score: 5 },
    ];

    const result = calculateMockStats(mockRows);

    // 국어: 130, 수학: 125, 탐구 상위 2개: 120 + 115 = 235
    // 합계: 130 + 125 + 235 = 490
    expect(result.totalStdScore).toBe(490);
  });

  it("표준점수 합이 0이면 null을 반환해야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 0, grade_score: 2 },
      { subject_group_name: "수학", percentile: 85, standard_score: 0, grade_score: 3 },
    ];

    const result = calculateMockStats(mockRows);

    expect(result.totalStdScore).toBeNull();
  });

  it("상위 3개 등급 합이 정상적으로 계산되어야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: 2 },
      { subject_group_name: "수학", percentile: 85, standard_score: 125, grade_score: 3 },
      { subject_group_name: "영어", percentile: 80, standard_score: 120, grade_score: 4 },
      { subject_group_name: "사회", percentile: 75, standard_score: 115, grade_score: 5 },
      { subject_group_name: "과학", percentile: 70, standard_score: 110, grade_score: 6 },
    ];

    const result = calculateMockStats(mockRows);

    // 상위 3개 등급: 2, 3, 4
    // 합계: 2 + 3 + 4 = 9
    expect(result.best3GradeSum).toBe(9);
  });

  it("상위 3개 등급 합 계산 시 등급이 3개 미만이면 모든 등급의 합을 반환해야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: 2 },
      { subject_group_name: "수학", percentile: 85, standard_score: 125, grade_score: 3 },
    ];

    const result = calculateMockStats(mockRows);

    // 등급이 2개뿐이면 2 + 3 = 5
    expect(result.best3GradeSum).toBe(5);
  });

  it("상위 3개 등급 합 계산 시 등급이 없으면 null을 반환해야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: null },
      { subject_group_name: "수학", percentile: 85, standard_score: 125, grade_score: null },
    ];

    const result = calculateMockStats(mockRows);

    expect(result.best3GradeSum).toBeNull();
  });

  it("탐구 과목이 1개만 있어도 정상적으로 계산되어야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: 2 },
      { subject_group_name: "수학", percentile: 85, standard_score: 125, grade_score: 3 },
      { subject_group_name: "사회", percentile: 80, standard_score: 120, grade_score: 4 },
      // 과학 없음
    ];

    const result = calculateMockStats(mockRows);

    // 탐구 상위 2개 중 1개만 있으므로 해당 값만 사용
    // 국어: 90, 수학: 85, 탐구: 80
    // 평균: (90 + 85 + 80) / 3 = 85
    expect(result.avgPercentile).toBeCloseTo(85, 2);
  });

  it("탐구 과목이 3개 이상이면 상위 2개만 사용해야 함", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: 90, standard_score: 130, grade_score: 2 },
      { subject_group_name: "수학", percentile: 85, standard_score: 125, grade_score: 3 },
      { subject_group_name: "사회", percentile: 80, standard_score: 120, grade_score: 4 },
      { subject_group_name: "과학", percentile: 75, standard_score: 115, grade_score: 5 },
      { subject_group_name: "한국사", percentile: 70, standard_score: 110, grade_score: 6 },
    ];

    const result = calculateMockStats(mockRows);

    // 탐구 상위 2개: 80, 75 (한국사는 제외)
    // 평균: (90 + 85 + (80+75)/2) / 3 = (90 + 85 + 77.5) / 3 ≈ 84.17
    expect(result.avgPercentile).toBeCloseTo(84.17, 2);
  });

  it("엣지 케이스: 모든 값이 null인 경우", () => {
    const mockRows: MockRow[] = [
      { subject_group_name: "국어", percentile: null, standard_score: null, grade_score: null },
      { subject_group_name: "수학", percentile: null, standard_score: null, grade_score: null },
    ];

    const result = calculateMockStats(mockRows);

    expect(result.avgPercentile).toBeNull();
    expect(result.totalStdScore).toBeNull();
    expect(result.best3GradeSum).toBeNull();
  });

  it("엣지 케이스: 빈 배열인 경우", () => {
    const mockRows: MockRow[] = [];

    const result = calculateMockStats(mockRows);

    expect(result.avgPercentile).toBeNull();
    expect(result.totalStdScore).toBeNull();
    expect(result.best3GradeSum).toBeNull();
  });
});

