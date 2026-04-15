import { describe, it, expect } from "vitest";
import {
  buildFiveAxisDiagnosis,
  type FiveAxisDiagnosis,
  type FiveAxisDiagnosisInput,
} from "../prediction/profile-diagnosis";
import {
  computeMainInquiryAlignment,
  type MainInquiryAlignmentInput,
} from "../prediction/main-inquiry-alignment";
import type { UniversityMatchAnalysis } from "@/lib/domains/record-analysis/eval/university-profile-matcher";
import type { CourseAdequacyResult } from "@/lib/domains/student-record/types";
import type { FlowCompletionResult } from "@/lib/domains/student-record/evaluation-criteria/flow-completion";
import type { InquiryCategory } from "../repository/main-inquiry-weights-repository";

// ─── 공통 픽스처 ────────────────────────────────────────────────────────────

function makeTopMatch(
  track: string,
  label: string,
  score: number,
  grade: "S" | "A" | "B" | "C" | "D",
) {
  return {
    track: track as UniversityMatchAnalysis["topMatch"]["track"],
    label,
    matchScore: score,
    grade,
    strengths: ["탐구력", "학업성취도"],
    gaps: ["리더십"],
    recommendation: `${label} 계열 적합.`,
  };
}

function makeUniversityMatch(
  score: number,
  grade: "S" | "A" | "B" | "C" | "D",
  track = "engineering",
  label = "공학/이공계",
): UniversityMatchAnalysis {
  const topMatch = makeTopMatch(track, label, score, grade);
  return {
    studentId: "student-g9",
    competencyScores: { academic_achievement: 80 },
    matches: [topMatch],
    topMatch,
    summary: `최적 계열: ${label}`,
  };
}

function makeCourseAdequacy(score: number): CourseAdequacyResult {
  return {
    score,
    majorCategory: "공학계열",
    totalRecommended: 10,
    totalAvailable: 8,
    taken: ["수학Ⅱ", "미적분"],
    notTaken: ["물리학Ⅱ"],
    notOffered: [],
    generalRate: 80,
    careerRate: 70,
    fusionRate: null,
  };
}

function makeFlowRecord(
  completionPercent: number,
  isCareerSubject: boolean,
): FlowCompletionResult {
  return {
    completionPercent,
    tier: { minPercent: 60, label: "학종_가능_점검필요", description: "학종 가능" },
    stages: [],
    isCareerSubject,
    universityTier: "mid",
  };
}

function makeFlowCompletion(avgPercent: number) {
  return {
    avgPercent,
    tier: { minPercent: 60, label: "학종_가능_점검필요", description: "학종 가능" },
    byRecord: [makeFlowRecord(avgPercent, true)],
  };
}

/** 10 카테고리 모두 0 인 빈 가중치 맵 */
function emptyWeights(): Record<InquiryCategory, number> {
  return {
    natural_science: 0,
    life_medical: 0,
    engineering: 0,
    it_software: 0,
    social_science: 0,
    humanities: 0,
    law_policy: 0,
    business_economy: 0,
    education: 0,
    arts_sports: 0,
  };
}

/** 10 카테고리 모두 0 인 빈 점수 맵 */
function emptyScores(): Record<InquiryCategory, number> {
  return { ...emptyWeights() };
}

// ─── computeMainInquiryAlignment 단위 테스트 ─────────────────────────────────

describe("computeMainInquiryAlignment", () => {
  it("모든 카테고리 점수/가중치 0 이면 score=0, grade=misaligned 반환", () => {
    const input: MainInquiryAlignmentInput = {
      studentTheme: { themeKeywords: [], careerField: null },
      categoryScores: emptyScores(),
      targetTrack: "engineering",
      trackWeights: emptyWeights(),
    };
    const result = computeMainInquiryAlignment(input);

    expect(result.score).toBe(0);
    expect(result.grade).toBe("misaligned");
    expect(result.topCategories).toHaveLength(3);
  });

  it("완전 정합(categoryScores = trackWeights의 각 카테고리 1.0) 이면 score=100", () => {
    const weights: Record<InquiryCategory, number> = {
      ...emptyWeights(),
      natural_science: 0.5,
      life_medical: 0.5,
    };
    const scores: Record<InquiryCategory, number> = {
      ...emptyScores(),
      natural_science: 1.0,
      life_medical: 1.0,
    };
    const input: MainInquiryAlignmentInput = {
      studentTheme: { themeKeywords: ["유전체학"], careerField: "의학" },
      categoryScores: scores,
      targetTrack: "medical",
      trackWeights: weights,
    };
    const result = computeMainInquiryAlignment(input);

    // score = (1*0.5 + 1*0.5) / (0.5+0.5) * 100 = 100
    expect(result.score).toBe(100);
    expect(result.grade).toBe("excellent");
  });

  it("부분 정합 — 가중 평균 정규화가 올바르게 계산된다", () => {
    const weights: Record<InquiryCategory, number> = {
      ...emptyWeights(),
      engineering: 0.6,
      it_software: 0.4,
    };
    const scores: Record<InquiryCategory, number> = {
      ...emptyScores(),
      engineering: 0.8,   // 0.8 * 0.6 = 0.48
      it_software: 0.5,   // 0.5 * 0.4 = 0.20
    };
    const input: MainInquiryAlignmentInput = {
      studentTheme: { themeKeywords: ["회로 설계"], careerField: "공학" },
      categoryScores: scores,
      targetTrack: "engineering",
      trackWeights: weights,
    };
    const result = computeMainInquiryAlignment(input);

    // numerator = 0.48 + 0.20 = 0.68
    // weightSum = 1.0
    // score = 0.68 / 1.0 * 100 = 68 → good
    expect(result.score).toBe(68);
    expect(result.grade).toBe("good");
  });

  it("topCategories 는 matchScore 내림차순 상위 3개다", () => {
    const weights: Record<InquiryCategory, number> = {
      ...emptyWeights(),
      natural_science: 0.4,
      engineering: 0.3,
      it_software: 0.2,
      social_science: 0.1,
    };
    const scores: Record<InquiryCategory, number> = {
      ...emptyScores(),
      natural_science: 0.9,   // 0.36
      engineering: 0.7,       // 0.21
      it_software: 0.6,       // 0.12
      social_science: 0.5,    // 0.05
    };
    const input: MainInquiryAlignmentInput = {
      studentTheme: { themeKeywords: [], careerField: null },
      categoryScores: scores,
      targetTrack: "engineering",
      trackWeights: weights,
    };
    const result = computeMainInquiryAlignment(input);

    expect(result.topCategories[0].category).toBe("natural_science");
    expect(result.topCategories[1].category).toBe("engineering");
    expect(result.topCategories[2].category).toBe("it_software");
  });

  it("grade 경계값: score=80 → excellent", () => {
    const weights: Record<InquiryCategory, number> = { ...emptyWeights(), humanities: 1.0 };
    const scores: Record<InquiryCategory, number> = { ...emptyScores(), humanities: 0.8 };
    const result = computeMainInquiryAlignment({
      studentTheme: { themeKeywords: [], careerField: null },
      categoryScores: scores,
      targetTrack: "humanities",
      trackWeights: weights,
    });
    expect(result.score).toBe(80);
    expect(result.grade).toBe("excellent");
  });

  it("grade 경계값: score=29 → misaligned", () => {
    const weights: Record<InquiryCategory, number> = { ...emptyWeights(), humanities: 1.0 };
    const scores: Record<InquiryCategory, number> = { ...emptyScores(), humanities: 0.29 };
    const result = computeMainInquiryAlignment({
      studentTheme: { themeKeywords: [], careerField: null },
      categoryScores: scores,
      targetTrack: "humanities",
      trackWeights: weights,
    });
    expect(result.grade).toBe("misaligned");
  });
});

// ─── buildFiveAxisDiagnosis 테스트 ─────────────────────────────────────────

describe("buildFiveAxisDiagnosis", () => {
  // ── null mainInquiryAlignment 경로 (백워드 호환) ──────────────

  it("mainInquiryAlignment=null 이면 5축이 null 이고 기존 4축 구조는 유지된다", () => {
    const input: FiveAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),
      courseAdequacy: makeCourseAdequacy(75),
      flowCompletion: makeFlowCompletion(70),
      admissionGrade: 2.5,
      studentGrade: 2.0,
      mainInquiryAlignment: null,
    };
    const result: FiveAxisDiagnosis = buildFiveAxisDiagnosis(input);

    expect(result.mainInquiryAlignment).toBeNull();
    expect(result.profileMatch).toBeDefined();
    expect(result.courseAdequacy).toBeDefined();
    expect(result.flowCompletion).toBeDefined();
    expect(result.admissionReference).toBeDefined();
    expect(result.summary).toBeTruthy();
    expect(result.weakestAxis).toBeDefined();
  });

  it("mainInquiryAlignment=null 이면 weakestAxis 는 기존 4축에서 결정된다", () => {
    // flow 가 가장 낮음
    const input: FiveAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(90, "S"),
      courseAdequacy: makeCourseAdequacy(80),
      flowCompletion: makeFlowCompletion(20), // 최저
      admissionGrade: 2.5,
      studentGrade: 2.0,
      mainInquiryAlignment: null,
      // null → 5축 정규화=50 → flowCompletion(20)이 여전히 최저
    };
    const result = buildFiveAxisDiagnosis(input);

    expect(result.weakestAxis).toBe("flowCompletion");
  });

  // ── 정상 mainInquiryAlignment 경로 ───────────────────────────

  it("5축 점수가 4축 중 최저이면 weakestAxis=mainInquiryAlignment", () => {
    // 4축이 모두 양호(>=70)하고 5축만 낮은 경우
    const alignmentResult = computeMainInquiryAlignment({
      studentTheme: { themeKeywords: ["법률"], careerField: "법학" },
      categoryScores: { ...emptyScores(), humanities: 0.1 }, // 점수 낮음
      targetTrack: "engineering",
      trackWeights: { ...emptyWeights(), engineering: 0.8, it_software: 0.2 },
    });
    // score ≈ 0 → grade=misaligned

    const input: FiveAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),
      courseAdequacy: makeCourseAdequacy(80),
      flowCompletion: makeFlowCompletion(75),
      admissionGrade: 2.5,
      studentGrade: 2.0, // above → 90
      mainInquiryAlignment: alignmentResult,
    };
    const result = buildFiveAxisDiagnosis(input);

    expect(result.weakestAxis).toBe("mainInquiryAlignment");
    expect(result.mainInquiryAlignment).not.toBeNull();
    expect(result.mainInquiryAlignment!.grade).toBe("misaligned");
  });

  it("5축 grade=misaligned 이면 summary 에 탐구 방향 미흡 문구가 포함된다", () => {
    const alignmentResult = computeMainInquiryAlignment({
      studentTheme: { themeKeywords: [], careerField: null },
      categoryScores: emptyScores(), // 전부 0 → score=0 → misaligned
      targetTrack: "medical",
      trackWeights: { ...emptyWeights(), life_medical: 0.6, natural_science: 0.4 },
    });

    const input: FiveAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(65),
      mainInquiryAlignment: alignmentResult,
    };
    const result = buildFiveAxisDiagnosis(input);

    expect(result.summary).toMatch(/메인 탐구|탐구 방향|계열/);
  });

  it("5축 grade=excellent 이면 summary 에 탐구 미흡 문구가 추가되지 않는다", () => {
    const alignmentResult = computeMainInquiryAlignment({
      studentTheme: { themeKeywords: ["신경과학"], careerField: "의학" },
      categoryScores: { ...emptyScores(), life_medical: 1.0, natural_science: 0.9 },
      targetTrack: "medical",
      trackWeights: { ...emptyWeights(), life_medical: 0.6, natural_science: 0.4 },
    });
    // score = (1.0*0.6 + 0.9*0.4) / 1.0 * 100 = 96 → excellent

    const input: FiveAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(88, "A"),
      courseAdequacy: makeCourseAdequacy(80),
      flowCompletion: makeFlowCompletion(75),
      admissionGrade: 2.5,
      studentGrade: 2.0,
      mainInquiryAlignment: alignmentResult,
    };
    const result = buildFiveAxisDiagnosis(input);

    expect(result.summary).not.toContain("메인 탐구 방향이 목표 계열과 맞지 않습니다");
  });

  it("5축 결과가 FiveAxisDiagnosis 인터페이스를 만족한다", () => {
    const alignmentResult = computeMainInquiryAlignment({
      studentTheme: { themeKeywords: ["인공지능"], careerField: "공학" },
      categoryScores: { ...emptyScores(), engineering: 0.7, it_software: 0.6 },
      targetTrack: "engineering",
      trackWeights: { ...emptyWeights(), engineering: 0.5, it_software: 0.5 },
    });

    const input: FiveAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(82, "A"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(68),
      mainInquiryAlignment: alignmentResult,
    };
    const result: FiveAxisDiagnosis = buildFiveAxisDiagnosis(input);

    // 모든 필드가 존재해야 한다
    expect(typeof result.profileMatch.score).toBe("number");
    expect(typeof result.flowCompletion.avgPercent).toBe("number");
    expect(result.mainInquiryAlignment).not.toBeNull();
    expect(typeof result.mainInquiryAlignment!.score).toBe("number");
    expect(["excellent", "good", "weak", "misaligned"]).toContain(
      result.mainInquiryAlignment!.grade,
    );
    expect([
      "profileMatch",
      "courseAdequacy",
      "flowCompletion",
      "admissionReference",
      "mainInquiryAlignment",
    ]).toContain(result.weakestAxis);
  });
});
