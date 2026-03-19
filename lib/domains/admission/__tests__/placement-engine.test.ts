import { describe, it, expect } from "vitest";
import {
  parseAdmissionScores,
  calculateAdmissionAverage,
  calculateConfidence,
  determineLevel,
  determineVerdicts,
  summarizeVerdicts,
  filterVerdicts,
} from "../placement/engine";
import type { ScoreCalculationResult } from "../calculator/types";
import type { AdmissionResults } from "../types";
import type { AdmissionRow } from "../placement/engine";

// ── 테스트 픽스처 ────────────────────────────

const threeYearResults: AdmissionResults = {
  "2025": { basis: "추합", grade: "3.5", score: "800.5" },
  "2024": { basis: "추합", grade: "3.2", score: "810.2" },
  "2023": { basis: "추합", grade: "3.8", score: "795.0" },
};

const twoYearResults: AdmissionResults = {
  "2025": { basis: "추합", grade: "3.5", score: "800.0" },
  "2024": { basis: "추합", grade: "3.2", score: "810.0" },
};

const oneYearResults: AdmissionResults = {
  "2025": { basis: "추합", grade: "3.5", score: "800.0" },
};

const noScoreResults: AdmissionResults = {
  "2025": { basis: "추합", grade: "3.5", score: "-" },
  "2024": { basis: "추합", grade: "3.2" },
};

const makeCalcResult = (
  universityName: string,
  totalScore: number,
  isEligible = true,
): ScoreCalculationResult => ({
  universityName,
  isEligible,
  disqualificationReasons: isEligible ? [] : ["결격사유"],
  mandatoryScore: totalScore * 0.7,
  optionalScore: totalScore * 0.2,
  weightedScore: totalScore * 0.1,
  bonusScore: 0,
  totalScore,
  breakdown: { math: null, inquiry: [], mandatory: [], optional: [] },
});

// ── parseAdmissionScores ──────────────────────

describe("parseAdmissionScores", () => {
  it("3개년 입결 score를 파싱한다", () => {
    const result = parseAdmissionScores(threeYearResults);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      year: "2025",
      basis: "추합",
      grade: "3.5",
      score: 800.5,
    });
  });

  it("parseFloat 실패 시 null로 처리", () => {
    const result = parseAdmissionScores(noScoreResults);
    expect(result[0].score).toBeNull(); // "-"
    expect(result[1].score).toBeNull(); // undefined
  });

  it("null/undefined 입력 시 빈 배열", () => {
    expect(parseAdmissionScores(null)).toEqual([]);
    expect(parseAdmissionScores(undefined)).toEqual([]);
  });

  it("최신 연도 먼저 정렬", () => {
    const result = parseAdmissionScores(threeYearResults);
    expect(result[0].year).toBe("2025");
    expect(result[2].year).toBe("2023");
  });
});

// ── calculateAdmissionAverage ─────────────────

describe("calculateAdmissionAverage", () => {
  it("3개년 평균 계산", () => {
    const comparisons = parseAdmissionScores(threeYearResults);
    const avg = calculateAdmissionAverage(comparisons);
    // (800.5 + 810.2 + 795.0) / 3 ≈ 801.9
    expect(avg).toBeCloseTo(801.9, 0);
  });

  it("유효 점수 없으면 null", () => {
    const comparisons = parseAdmissionScores(noScoreResults);
    expect(calculateAdmissionAverage(comparisons)).toBeNull();
  });
});

// ── calculateConfidence ───────────────────────

describe("calculateConfidence", () => {
  it("3개년 → 기본 80점 + 편차 보너스", () => {
    const comparisons = parseAdmissionScores(threeYearResults);
    const conf = calculateConfidence(comparisons);
    expect(conf).toBeGreaterThanOrEqual(80);
    expect(conf).toBeLessThanOrEqual(100);
  });

  it("2개년 → 기본 60점", () => {
    const comparisons = parseAdmissionScores(twoYearResults);
    const conf = calculateConfidence(comparisons);
    expect(conf).toBeGreaterThanOrEqual(60);
  });

  it("1개년 → 기본 40점", () => {
    const comparisons = parseAdmissionScores(oneYearResults);
    expect(calculateConfidence(comparisons)).toBe(40);
  });

  it("데이터 없음 → 0", () => {
    expect(calculateConfidence([])).toBe(0);
  });
});

// ── determineLevel ────────────────────────────

describe("determineLevel", () => {
  it("학생점수 ≥ 입결평균 → safe", () => {
    expect(determineLevel(800, 800)).toBe("safe");
    expect(determineLevel(850, 800)).toBe("safe");
  });

  it("≥ 0.985 → possible", () => {
    // 800 * 0.985 = 788
    expect(determineLevel(789, 800)).toBe("possible");
  });

  it("≥ 0.97 → bold", () => {
    // 800 * 0.97 = 776
    expect(determineLevel(777, 800)).toBe("bold");
  });

  it("≥ 0.95 → unstable", () => {
    // 800 * 0.95 = 760
    expect(determineLevel(761, 800)).toBe("unstable");
  });

  it("< 0.95 → danger", () => {
    expect(determineLevel(759, 800)).toBe("danger");
  });

  it("입결 없으면 danger", () => {
    expect(determineLevel(800, null)).toBe("danger");
  });
});

// ── determineVerdicts ─────────────────────────

describe("determineVerdicts", () => {
  const admissionRows: AdmissionRow[] = [
    {
      university_name: "서울대학교",
      department_name: "컴퓨터공학부",
      region: "서울",
      department_type: "자연",
      admission_results: threeYearResults,
    },
    {
      university_name: "서울대학교",
      department_name: "전기공학부",
      region: "서울",
      department_type: "자연",
      admission_results: twoYearResults,
    },
  ];

  it("환산 결과 + 입결 → 판정 생성", () => {
    const calcResults = [makeCalcResult("서울대학교", 850)];
    const verdicts = determineVerdicts(calcResults, admissionRows);

    // 서울대 2개 학과 → 2개 판정
    expect(verdicts).toHaveLength(2);
    expect(verdicts[0].universityName).toBe("서울대학교");
    expect(verdicts[0].level).toBe("safe"); // 850 > ~802 avg
    expect(verdicts[0].confidence).toBeGreaterThan(0);
  });

  it("결격 시 danger 판정", () => {
    const calcResults = [makeCalcResult("서울대학교", 0, false)];
    const verdicts = determineVerdicts(calcResults, admissionRows);

    expect(verdicts.every((v) => v.level === "danger")).toBe(true);
    expect(verdicts[0].notes).toContain("결격사유");
  });

  it("입결 데이터 없는 대학 → danger + 데이터 없음 노트", () => {
    const calcResults = [makeCalcResult("연세대학교", 800)];
    const verdicts = determineVerdicts(calcResults, admissionRows);

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].level).toBe("danger");
    expect(verdicts[0].notes).toContain("입결 데이터 없음");
  });

  it("totalScore 내림차순 정렬", () => {
    const calcResults = [
      makeCalcResult("서울대학교", 750),
      makeCalcResult("고려대학교", 900),
    ];
    const koreaAdm: AdmissionRow[] = [
      ...admissionRows,
      {
        university_name: "고려대학교",
        department_name: "경영학과",
        region: "서울",
        department_type: "인문",
        admission_results: oneYearResults,
      },
    ];
    const verdicts = determineVerdicts(calcResults, koreaAdm);
    expect(verdicts[0].studentScore).toBeGreaterThanOrEqual(verdicts[1].studentScore);
  });
});

// ── summarizeVerdicts ─────────────────────────

describe("summarizeVerdicts", () => {
  it("레벨별 카운트", () => {
    const calcResults = [
      makeCalcResult("A대", 850),
      makeCalcResult("B대", 750),
    ];
    const rows: AdmissionRow[] = [
      { university_name: "A대", department_name: "학과A", region: null, department_type: null, admission_results: threeYearResults },
      { university_name: "B대", department_name: "학과B", region: null, department_type: null, admission_results: threeYearResults },
    ];
    const verdicts = determineVerdicts(calcResults, rows);
    const summary = summarizeVerdicts(verdicts);

    expect(summary.total).toBe(2);
    expect(summary.byLevel.safe).toBe(1); // 850 vs ~802
    expect(summary.disqualified).toBe(0);
  });
});

// ── filterVerdicts ────────────────────────────

describe("filterVerdicts", () => {
  const calcResults = [makeCalcResult("서울대학교", 850)];
  const admRows: AdmissionRow[] = [
    {
      university_name: "서울대학교",
      department_name: "컴퓨터공학부",
      region: "서울",
      department_type: "자연",
      admission_results: threeYearResults,
    },
  ];
  const verdicts = determineVerdicts(calcResults, admRows);

  it("레벨 필터", () => {
    expect(filterVerdicts(verdicts, { levels: ["safe"] })).toHaveLength(1);
    expect(filterVerdicts(verdicts, { levels: ["danger"] })).toHaveLength(0);
  });

  it("지역 필터", () => {
    expect(filterVerdicts(verdicts, { region: "서울" })).toHaveLength(1);
    expect(filterVerdicts(verdicts, { region: "경기" })).toHaveLength(0);
  });

  it("검색 필터", () => {
    expect(filterVerdicts(verdicts, { search: "컴퓨터" })).toHaveLength(1);
    expect(filterVerdicts(verdicts, { search: "없는학과" })).toHaveLength(0);
  });

  it("빈 필터 → 전체 반환", () => {
    expect(filterVerdicts(verdicts, {})).toHaveLength(verdicts.length);
  });
});
