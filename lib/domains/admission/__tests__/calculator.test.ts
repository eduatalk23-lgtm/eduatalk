import { describe, it, expect } from "vitest";
import { calculateUniversityScore } from "../calculator/calculator";
import { resolveAllSubjects, expandPoolToScores } from "../calculator/subject-selector";
import { calculateOptionalScore } from "../calculator/optional-scorer";
import { calculateWeightedScore } from "../calculator/weighted-scorer";
import { checkRestrictions } from "../calculator/restriction-checker";
import type { SuneungScores, UniversityScoreConfig, ConversionTable, RestrictionRule } from "../calculator/types";

// ── 테스트 픽스처 ────────────────────────────

const mockScores: SuneungScores = {
  korean: 133,
  koreanRaw: 100,        // 원점수 (ConversionTable lookup 키)
  mathCalculus: 121,
  mathCalculusRaw: 90,   // 원점수
  mathGeometry: null,
  mathGeometryRaw: null,
  mathStatistics: null,
  mathStatisticsRaw: null,
  english: 3,            // 등급 = lookup 키
  history: 1,            // 등급 = lookup 키
  inquiry: { "정치와 법": 65, "사회·문화": 66 }, // 원점수 = lookup 키
  foreignLang: null,
};

const mockTable: ConversionTable = new Map([
  ["국어-100", 270],         // 원점수 기반
  ["수학(미적)-90", 240],     // DB 과목명 + 원점수
  ["영어-3", 135],           // 등급 기반
  ["한국사-1", 10],          // 등급 기반
  ["정치와 법-65", 130],      // 원점수 기반
  ["사회·문화-66", 135],     // 원점수 기반
]);

const baseConfig: UniversityScoreConfig = {
  universityName: "테스트대학교",
  mandatoryPattern: "국수영탐(2)",
  optionalPattern: null,
  weightedPattern: null,
  inquiryCount: 2,
  mathSelection: "gana",
  inquirySelection: "sagwa",
  historySubstitute: null,
  foreignSubstitute: null,
  bonusRules: {},
  conversionType: "표+변",
  scoringPath: "subject",
};

// ── resolveAllSubjects ──────────────────────

describe("resolveAllSubjects", () => {
  it("기본 해결 — 전 과목 환산", () => {
    const resolved = resolveAllSubjects(mockScores, baseConfig, mockTable);
    expect(resolved.korean).toBe(270);
    expect(resolved.math).toBe(240); // 미적분만 있으므로
    expect(resolved.english).toBe(135);
    expect(resolved.history).toBe(10);
    expect(resolved.inquiry1).toBe(135); // 사회문화 66 → 135
    expect(resolved.inquiry2).toBe(130); // 정치와법 65 → 130
    expect(resolved.inquiry).toBe(265); // 135 + 130
  });

  it("수학 미적분만 허용 (가)", () => {
    const config = { ...baseConfig, mathSelection: "ga" as const };
    const resolved = resolveAllSubjects(mockScores, config, mockTable);
    expect(resolved.math).toBe(240); // 미적분
  });

  it("수학 확통만 허용 (나) — 미적분 제외", () => {
    const config = { ...baseConfig, mathSelection: "na" as const };
    const resolved = resolveAllSubjects(mockScores, config, mockTable);
    expect(resolved.math).toBe(0); // 확통 없음
  });

  it("탐구 과탐만 (gwa) — 사탐 제외", () => {
    const config = { ...baseConfig, inquirySelection: "gwa" as const };
    const resolved = resolveAllSubjects(mockScores, config, mockTable);
    expect(resolved.inquiry1).toBe(0); // 사탐만 있으므로 과탐 0
  });

  it("탐구 1개만", () => {
    const config = { ...baseConfig, inquiryCount: 1 };
    const resolved = resolveAllSubjects(mockScores, config, mockTable);
    expect(resolved.inquiry).toBe(135); // top-1만
  });

  it("점수 없는 과목 → 0", () => {
    const emptyScores: SuneungScores = {
      korean: null, koreanRaw: null, mathCalculus: null, mathCalculusRaw: null,
      mathGeometry: null, mathGeometryRaw: null, mathStatistics: null, mathStatisticsRaw: null,
      english: null, history: null, inquiry: {}, foreignLang: null,
    };
    const resolved = resolveAllSubjects(emptyScores, baseConfig, mockTable);
    expect(resolved.korean).toBe(0);
    expect(resolved.math).toBe(0);
    expect(resolved.inquiry).toBe(0);
  });
});

// ── expandPoolToScores ──────────────────────

describe("expandPoolToScores", () => {
  it("국수영 풀 → 3개 점수", () => {
    const resolved = resolveAllSubjects(mockScores, baseConfig, mockTable);
    const pool = expandPoolToScores(
      [{ type: "korean" }, { type: "math" }, { type: "english" }],
      resolved,
    );
    expect(pool).toEqual([270, 240, 135]);
  });

  it("탐구(2) 포함 풀", () => {
    const resolved = resolveAllSubjects(mockScores, baseConfig, mockTable);
    const pool = expandPoolToScores(
      [{ type: "korean" }, { type: "inquiry", count: 2 }],
      resolved,
    );
    expect(pool).toEqual([270, 135, 130]); // 국어 + 탐구1 + 탐구2
  });
});

// ── calculateOptionalScore ──────────────────

describe("calculateOptionalScore", () => {
  it("국수영中택2 → top-2", () => {
    const resolved = resolveAllSubjects(mockScores, baseConfig, mockTable);
    const result = calculateOptionalScore(
      { pool: [{ type: "korean" }, { type: "math" }, { type: "english" }], pickCount: 2 },
      resolved,
    );
    expect(result.total).toBe(270 + 240); // 국어 + 수학
  });

  it("null 패턴 → 0", () => {
    const resolved = resolveAllSubjects(mockScores, baseConfig, mockTable);
    const result = calculateOptionalScore(null, resolved);
    expect(result.total).toBe(0);
  });
});

// ── calculateWeightedScore ──────────────────

describe("calculateWeightedScore", () => {
  it("국수中가중택2 + weights [60,40]", () => {
    const resolved = resolveAllSubjects(mockScores, baseConfig, mockTable);
    const result = calculateWeightedScore(
      { pool: [{ type: "korean" }, { type: "math" }], pickCount: 2 },
      resolved,
      [60, 40],
    );
    // MAX(270*0.6+240*0.4, 240*0.6+270*0.4) = MAX(258, 252) = 258
    expect(result.total).toBe(258);
  });

  it("null 패턴 → 0", () => {
    const resolved = resolveAllSubjects(mockScores, baseConfig, mockTable);
    const result = calculateWeightedScore(null, resolved);
    expect(result.total).toBe(0);
  });
});

// ── checkRestrictions ───────────────────────

describe("checkRestrictions", () => {
  it("제한 없음 → eligible", () => {
    const result = checkRestrictions(mockScores, []);
    expect(result.isEligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("수학 미응시 → 결격", () => {
    const noMath: SuneungScores = { ...mockScores, mathCalculus: null, mathGeometry: null, mathStatistics: null };
    const rules: RestrictionRule[] = [{
      universityName: "테스트대", departmentName: null,
      restrictionType: "no_show",
      ruleConfig: { required_subjects: ["수학"] },
      description: "수학 미응시",
    }];
    const result = checkRestrictions(noMath, rules);
    expect(result.isEligible).toBe(false);
    expect(result.reasons[0]).toContain("수학");
  });

  it("지정과목 미응시 → 결격", () => {
    const rules: RestrictionRule[] = [{
      universityName: "서울대", departmentName: "기계공학부",
      restrictionType: "subject_req",
      ruleConfig: { required_any: ["물리학 Ⅰ", "화학 Ⅰ"], min_count: 1 },
      description: "물리/화학 중 1과목 이상 필수",
    }];
    const result = checkRestrictions(mockScores, rules);
    expect(result.isEligible).toBe(false); // 사탐만 응시했으므로
  });

  it("지정과목 충족 → eligible", () => {
    const scienceScores: SuneungScores = {
      ...mockScores,
      inquiry: { "물리학 Ⅰ": 65, "화학 Ⅰ": 60 },
    };
    const rules: RestrictionRule[] = [{
      universityName: "서울대", departmentName: "기계공학부",
      restrictionType: "subject_req",
      ruleConfig: { required_any: ["물리학 Ⅰ", "화학 Ⅰ"], min_count: 1 },
      description: "물리/화학 중 1과목 이상 필수",
    }];
    const result = checkRestrictions(scienceScores, rules);
    expect(result.isEligible).toBe(true);
  });
});

// ── calculateUniversityScore (통합) ──────────

describe("calculateUniversityScore", () => {
  it("필수만 있는 대학 — 국수영탐(2)", () => {
    const result = calculateUniversityScore(mockScores, baseConfig, mockTable, []);
    expect(result.isEligible).toBe(true);
    expect(result.mandatoryScore).toBe(270 + 240 + 135 + 265); // 국+수+영+탐
    expect(result.bonusScore).toBe(10); // 한국사 가감점
    expect(result.totalScore).toBe(920); // 910 + 한국사 10
  });

  it("필수+선택 — 국수 필수, 영탐(1)中택1 선택", () => {
    const config: UniversityScoreConfig = {
      ...baseConfig,
      mandatoryPattern: "국수",
      optionalPattern: "영탐(1)中택1",
    };
    const result = calculateUniversityScore(mockScores, config, mockTable, []);
    expect(result.mandatoryScore).toBe(270 + 240);
    // 선택: MAX(영어135, 탐구1 135) = 135
    expect(result.optionalScore).toBe(135);
    expect(result.totalScore).toBe(655); // 645 + 한국사 10
  });

  it("결격 시 조기 반환 — 점수 0", () => {
    const noMath: SuneungScores = {
      ...mockScores, mathCalculus: null, mathCalculusRaw: null, mathGeometry: null, mathGeometryRaw: null, mathStatistics: null, mathStatisticsRaw: null,
    };
    const rules: RestrictionRule[] = [{
      universityName: "테스트대", departmentName: null,
      restrictionType: "no_show", ruleConfig: {},
      description: "수학 미응시",
    }];
    const result = calculateUniversityScore(noMath, baseConfig, mockTable, rules);
    expect(result.isEligible).toBe(false);
    expect(result.totalScore).toBe(0);
  });

  it("모든 점수 null → 0점 (에러 없음)", () => {
    const empty: SuneungScores = {
      korean: null, koreanRaw: null, mathCalculus: null, mathCalculusRaw: null,
      mathGeometry: null, mathGeometryRaw: null, mathStatistics: null, mathStatisticsRaw: null,
      english: null, history: null, inquiry: {}, foreignLang: null,
    };
    const result = calculateUniversityScore(empty, baseConfig, mockTable, []);
    expect(result.isEligible).toBe(true);
    expect(result.totalScore).toBe(0);
  });

  it("결정론적 — 같은 입력 → 같은 출력", () => {
    const r1 = calculateUniversityScore(mockScores, baseConfig, mockTable, []);
    const r2 = calculateUniversityScore(mockScores, baseConfig, mockTable, []);
    expect(r1.totalScore).toBe(r2.totalScore);
    expect(r1.mandatoryScore).toBe(r2.mandatoryScore);
  });
});
