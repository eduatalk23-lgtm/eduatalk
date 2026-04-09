import { describe, it, expect } from "vitest";
import {
  buildFourAxisDiagnosis,
  type FourAxisDiagnosis,
  type FourAxisDiagnosisInput,
} from "../prediction/profile-diagnosis";
import type { UniversityMatchAnalysis } from "@/lib/domains/record-analysis/eval/university-profile-matcher";
import type { CourseAdequacyResult } from "@/lib/domains/student-record/types";
import type { FlowCompletionResult } from "@/lib/domains/student-record/evaluation-criteria/flow-completion";

// ── 픽스처: UniversityMatchAnalysis ──────────────────────────────────────────

function makeTopMatch(
  track: string,
  label: string,
  score: number,
  grade: "S" | "A" | "B" | "C" | "D",
  strengths: string[] = ["탐구력", "학업성취도", "진로 탐색 활동과 경험"],
  gaps: string[] = ["협업과 소통능력", "리더십"],
) {
  return {
    track: track as UniversityMatchAnalysis["topMatch"]["track"],
    label,
    matchScore: score,
    grade,
    strengths,
    gaps,
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
    studentId: "student-001",
    competencyScores: {
      academic_achievement: 85,
      academic_inquiry: 90,
      career_course_achievement: 80,
    },
    matches: [topMatch],
    topMatch,
    summary: `최적 계열: ${label} (${grade}등급, ${score}점)`,
  };
}

// ── 픽스처: CourseAdequacyResult ─────────────────────────────────────────────

function makeCourseAdequacy(
  score: number,
  taken: string[] = ["수학Ⅱ", "미적분", "물리학Ⅰ"],
  notTaken: string[] = ["물리학Ⅱ", "화학Ⅱ"],
): CourseAdequacyResult {
  return {
    score,
    majorCategory: "공학계열",
    totalRecommended: 10,
    totalAvailable: 8,
    taken,
    notTaken,
    notOffered: ["확률과통계"],
    generalRate: 80,
    careerRate: 70,
    fusionRate: null,
  };
}

// ── 픽스처: FlowCompletionResult ─────────────────────────────────────────────

function makeFlowRecord(
  completionPercent: number,
  isCareerSubject: boolean,
): FlowCompletionResult {
  return {
    completionPercent,
    tier: completionPercent >= 80
      ? { minPercent: 80, label: "학종_서류100_가능", description: "서류 100% 전형 도전 가능" }
      : completionPercent >= 60
        ? { minPercent: 60, label: "학종_가능_점검필요", description: "학종 가능하나 점검 필요" }
        : { minPercent: 0, label: "교과전형_추천", description: "교과전형 추천" },
    stages: [],
    isCareerSubject,
    universityTier: "mid",
  };
}

function makeFlowCompletion(avgPercent: number, byRecord: FlowCompletionResult[]) {
  const tier = avgPercent >= 80
    ? { minPercent: 80, label: "학종_서류100_가능", description: "서류 100% 전형 도전 가능" }
    : avgPercent >= 60
      ? { minPercent: 60, label: "학종_가능_점검필요", description: "학종 가능하나 점검 필요" }
      : { minPercent: 0, label: "교과전형_추천", description: "교과전형 추천" };
  return { avgPercent, tier, byRecord };
}

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe("buildFourAxisDiagnosis", () => {
  // ── 기본 구조 확인 ────────────────────────────────────────────

  it("4축 결과를 모두 반환한다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),
      courseAdequacy: makeCourseAdequacy(75),
      flowCompletion: makeFlowCompletion(70, [
        makeFlowRecord(75, true),
        makeFlowRecord(65, false),
      ]),
      admissionGrade: 2.5,
      studentGrade: 2.0,
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.profileMatch).toBeDefined();
    expect(result.courseAdequacy).toBeDefined();
    expect(result.flowCompletion).toBeDefined();
    expect(result.admissionReference).toBeDefined();
    expect(result.summary).toBeTruthy();
    expect(result.weakestAxis).toBeDefined();
  });

  // ── 1축: 계열 적합도 ──────────────────────────────────────────

  it("1축: topTrack에 matchUniversityProfiles의 topMatch 정보가 담긴다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(92, "S", "medical", "의학/치의학/한의학"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(65, [makeFlowRecord(65, true)]),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.profileMatch.topTrack.track).toBe("medical");
    expect(result.profileMatch.topTrack.label).toBe("의학/치의학/한의학");
    expect(result.profileMatch.score).toBe(92);
    expect(result.profileMatch.grade).toBe("S");
  });

  it("1축: strengths와 gaps가 topMatch에서 그대로 전달된다", () => {
    const strengths = ["탐구력", "학업성취도", "학업태도"];
    const gaps = ["나눔과 배려", "리더십"];
    const topMatch = makeTopMatch("law", "법학/정치외교", 78, "B", strengths, gaps);
    const universityMatch: UniversityMatchAnalysis = {
      studentId: "s1",
      competencyScores: {},
      matches: [topMatch],
      topMatch,
      summary: "",
    };

    const input: FourAxisDiagnosisInput = {
      universityMatch,
      courseAdequacy: null,
      flowCompletion: makeFlowCompletion(60, []),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.profileMatch.strengths).toEqual(strengths);
    expect(result.profileMatch.gaps).toEqual(gaps);
  });

  // ── 2축: 교과 이수 적합도 ────────────────────────────────────

  it("2축: courseAdequacy null이면 null을 반환한다 (전공 미설정)", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(75, "B"),
      courseAdequacy: null,
      flowCompletion: makeFlowCompletion(65, [makeFlowRecord(65, true)]),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.courseAdequacy).toBeNull();
  });

  it("2축: courseAdequacy 결과가 올바르게 매핑된다", () => {
    const ca = makeCourseAdequacy(72, ["수학Ⅱ", "미적분"], ["물리학Ⅱ"]);
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),
      courseAdequacy: ca,
      flowCompletion: makeFlowCompletion(70, []),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.courseAdequacy).not.toBeNull();
    expect(result.courseAdequacy!.score).toBe(72);
    expect(result.courseAdequacy!.taken).toEqual(["수학Ⅱ", "미적분"]);
    expect(result.courseAdequacy!.notTaken).toEqual(["물리학Ⅱ"]);
    expect(result.courseAdequacy!.generalRate).toBe(80);
    expect(result.courseAdequacy!.careerRate).toBe(70);
  });

  // ── 3축: 세특 완성도 ─────────────────────────────────────────

  it("3축: 진로교과/비진로교과 분리 — careerAvg, nonCareerAvg가 올바르게 계산된다", () => {
    const byRecord: FlowCompletionResult[] = [
      makeFlowRecord(80, true),   // 진로교과
      makeFlowRecord(90, true),   // 진로교과
      makeFlowRecord(60, false),  // 비진로교과
      makeFlowRecord(40, false),  // 비진로교과
    ];
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(67.5, byRecord),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.flowCompletion.careerAvg).toBe(85);       // (80+90)/2
    expect(result.flowCompletion.nonCareerAvg).toBe(50);    // (60+40)/2
  });

  it("3축: 진로교과 없으면 careerAvg는 null", () => {
    const byRecord: FlowCompletionResult[] = [
      makeFlowRecord(70, false),
      makeFlowRecord(65, false),
    ];
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),
      courseAdequacy: makeCourseAdequacy(75),
      flowCompletion: makeFlowCompletion(67.5, byRecord),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.flowCompletion.careerAvg).toBeNull();
    expect(result.flowCompletion.nonCareerAvg).toBeCloseTo(67.5);
  });

  it("3축: 비진로교과 없으면 nonCareerAvg는 null", () => {
    const byRecord: FlowCompletionResult[] = [
      makeFlowRecord(85, true),
      makeFlowRecord(75, true),
    ];
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(80, byRecord),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.flowCompletion.nonCareerAvg).toBeNull();
    expect(result.flowCompletion.careerAvg).toBe(80);
  });

  it("3축: byRecord 빈 배열이면 careerAvg, nonCareerAvg 모두 null", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(75, "B"),
      courseAdequacy: makeCourseAdequacy(60),
      flowCompletion: makeFlowCompletion(0, []),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.flowCompletion.careerAvg).toBeNull();
    expect(result.flowCompletion.nonCareerAvg).toBeNull();
  });

  // ── 4축: admissionReference ──────────────────────────────────

  it("4축: admissionGrade, studentGrade 모두 없으면 null 반환", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(70, []),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.admissionReference).toBeNull();
  });

  it("4축: 학생 내신이 입결보다 0.5등급 이상 우수하면 level=above", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),
      courseAdequacy: makeCourseAdequacy(75),
      flowCompletion: makeFlowCompletion(70, []),
      admissionGrade: 3.0,
      studentGrade: 2.0, // diff = -1.0 → above
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.admissionReference?.level).toBe("above");
  });

  it("4축: 학생 내신이 입결과 ±0.5 이내면 level=within", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),
      courseAdequacy: makeCourseAdequacy(75),
      flowCompletion: makeFlowCompletion(70, []),
      admissionGrade: 2.5,
      studentGrade: 2.3, // diff = -0.2 → within
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.admissionReference?.level).toBe("within");
  });

  it("4축: 학생 내신이 입결보다 0.5등급 이상 불리하면 level=below", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(65, []),
      admissionGrade: 2.0,
      studentGrade: 3.5, // diff = +1.5 → below
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.admissionReference?.level).toBe("below");
  });

  it("4축: admissionGrade는 있고 studentGrade가 null이면 level=unknown", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),
      courseAdequacy: makeCourseAdequacy(70),
      flowCompletion: makeFlowCompletion(65, []),
      admissionGrade: 2.5,
      studentGrade: null,
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.admissionReference?.level).toBe("unknown");
    expect(result.admissionReference?.avgAdmissionGrade).toBe(2.5);
    expect(result.admissionReference?.studentAvgGrade).toBeNull();
  });

  // ── weakestAxis 정확성 ────────────────────────────────────────

  it("weakestAxis: flowCompletion이 가장 낮으면 flowCompletion 반환", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(90, "S"),   // 90점
      courseAdequacy: makeCourseAdequacy(85),           // 85점
      flowCompletion: makeFlowCompletion(30, [makeFlowRecord(30, false)]), // 30%
      admissionGrade: 2.5,
      studentGrade: 2.0,  // above → 90점
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.weakestAxis).toBe("flowCompletion");
  });

  it("weakestAxis: courseAdequacy가 가장 낮으면 courseAdequacy 반환", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),   // 85점
      courseAdequacy: makeCourseAdequacy(20),           // 20점
      flowCompletion: makeFlowCompletion(80, [makeFlowRecord(80, true)]), // 80%
      admissionGrade: 2.5,
      studentGrade: 2.0,  // above → 90점
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.weakestAxis).toBe("courseAdequacy");
  });

  it("weakestAxis: admissionReference below면 40으로 정규화된다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(80, "A"),   // 80점
      courseAdequacy: makeCourseAdequacy(75),           // 75점
      flowCompletion: makeFlowCompletion(70, [makeFlowRecord(70, true)]), // 70%
      admissionGrade: 1.5,
      studentGrade: 3.5, // below → 40점 — 최약
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.weakestAxis).toBe("admissionReference");
  });

  it("weakestAxis: courseAdequacy null이면 50 기본값으로 계산된다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(90, "S"),   // 90점
      courseAdequacy: null,                             // 50 기본값
      flowCompletion: makeFlowCompletion(80, [makeFlowRecord(80, true)]), // 80%
      admissionGrade: 2.0,
      studentGrade: 2.0,  // within → 70점
    };
    const result = buildFourAxisDiagnosis(input);

    // 정규화 점수: profileMatch=90, courseAdequacy=50(기본), flow=80, admission=70
    expect(result.weakestAxis).toBe("courseAdequacy");
  });

  // ── summary 문구 ──────────────────────────────────────────────

  it("summary: 4축 모두 양호하면 topTrack 레이블이 포함된다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(88, "A", "engineering", "공학/이공계"),
      courseAdequacy: makeCourseAdequacy(80),
      flowCompletion: makeFlowCompletion(75, [makeFlowRecord(75, true)]),
      admissionGrade: 2.5,
      studentGrade: 2.0, // above
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.summary).toContain("공학/이공계");
  });

  it("summary: courseAdequacy null이면 전공 설정 안내 문구가 포함된다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(75, "B"),
      courseAdequacy: null,
      flowCompletion: makeFlowCompletion(60, [makeFlowRecord(60, false)]),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.summary).toContain("목표 전공 설정");
  });

  it("summary: 2축 이상 미흡이면 보완 안내가 포함된다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(55, "D"),  // 미흡
      courseAdequacy: makeCourseAdequacy(30),          // 미흡
      flowCompletion: makeFlowCompletion(40, [makeFlowRecord(40, false)]), // 미흡
      admissionGrade: 2.0,
      studentGrade: 4.0, // below
    };
    const result = buildFourAxisDiagnosis(input);

    // 미흡 상황에서 보완 관련 텍스트가 있어야 함
    expect(result.summary.length).toBeGreaterThan(10);
    expect(result.summary).toMatch(/보완|필요|개선/);
  });

  it("summary: flow만 미흡이면 세특 완성도 개선 문구가 포함된다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A"),
      courseAdequacy: makeCourseAdequacy(78),
      flowCompletion: makeFlowCompletion(30, [makeFlowRecord(30, false)]), // 미흡
      admissionGrade: 2.5,
      studentGrade: 2.0, // above
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.summary).toContain("세특");
  });

  // ── summary에 topTrack 포함 확인 (별도 케이스) ───────────────

  it("summary: courseAdequacy null + profileMatch A등급이면 계열명이 포함된다", () => {
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(85, "A", "humanities", "인문/어문"),
      courseAdequacy: null,
      flowCompletion: makeFlowCompletion(65, [makeFlowRecord(65, false)]),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.summary).toContain("인문/어문");
  });

  // ── 타입 불변성: 입력 타입 재사용 ─────────────────────────────

  it("CourseAdequacyResult의 모든 필드가 2축에 올바르게 매핑된다", () => {
    const ca: CourseAdequacyResult = {
      score: 65,
      majorCategory: "사회계열",
      totalRecommended: 12,
      totalAvailable: 10,
      taken: ["사회문화", "생활과윤리"],
      notTaken: ["법과정치", "경제"],
      notOffered: ["세계사"],
      generalRate: 60,
      careerRate: 55,
      fusionRate: null,
    };
    const input: FourAxisDiagnosisInput = {
      universityMatch: makeUniversityMatch(72, "B"),
      courseAdequacy: ca,
      flowCompletion: makeFlowCompletion(60, []),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.courseAdequacy!.score).toBe(65);
    expect(result.courseAdequacy!.taken).toEqual(["사회문화", "생활과윤리"]);
    expect(result.courseAdequacy!.notTaken).toEqual(["법과정치", "경제"]);
    expect(result.courseAdequacy!.generalRate).toBe(60);
    expect(result.courseAdequacy!.careerRate).toBe(55);
  });

  it("UniversityMatchAnalysis의 topMatch가 1축에 올바르게 매핑된다", () => {
    const universityMatch = makeUniversityMatch(77, "B", "social", "사회복지/국제");
    const input: FourAxisDiagnosisInput = {
      universityMatch,
      courseAdequacy: null,
      flowCompletion: makeFlowCompletion(55, []),
    };
    const result = buildFourAxisDiagnosis(input);

    expect(result.profileMatch.grade).toBe("B");
    expect(result.profileMatch.score).toBe(77);
    expect(result.profileMatch.topTrack.track).toBe("social");
    expect(result.profileMatch.topTrack.label).toBe("사회복지/국제");
  });
});
