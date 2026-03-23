import { describe, it, expect } from "vitest";
import { computeWarnings, type WarningCheckInput } from "../warnings/engine";
import type { RecordTabData } from "../types";

// ============================================
// 경고 엔진 테스트
// ============================================

function makeRecordData(overrides: Partial<RecordTabData> = {}): RecordTabData {
  return {
    seteks: [],
    personalSeteks: [],
    changche: [],
    haengteuk: null,
    readings: [],
    schoolAttendance: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<WarningCheckInput> = {}): WarningCheckInput {
  return {
    recordsByGrade: new Map(),
    storylineData: null,
    diagnosisData: null,
    strategyData: null,
    currentGrade: 2,
    ...overrides,
  };
}

// ─── 진로활동 미기록 ─────────────────────────────

describe("checkMissingCareerActivity", () => {
  it("진로활동 없으면 경고", () => {
    const input = makeInput({
      recordsByGrade: new Map([
        [1, makeRecordData({ changche: [] })],
      ]),
    });
    const warnings = computeWarnings(input);
    expect(warnings.some((w) => w.ruleId === "missing_career_activity")).toBe(true);
  });

  it("진로활동 있으면 경고 없음", () => {
    const input = makeInput({
      recordsByGrade: new Map([
        [1, makeRecordData({
          changche: [{ id: "1", activity_type: "career", content: "진로 체험 활동을 수행하였습니다." } as never],
        })],
      ]),
    });
    const warnings = computeWarnings(input);
    expect(warnings.some((w) => w.ruleId === "missing_career_activity")).toBe(false);
  });

  it("여러 학년 모두 미기록 시 전부 경고 (전 학년 수집)", () => {
    const input = makeInput({
      currentGrade: 3,
      recordsByGrade: new Map([
        [1, makeRecordData({ changche: [] })],
        [2, makeRecordData({ changche: [] })],
        [3, makeRecordData({ changche: [] })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "missing_career_activity");
    expect(warnings.length).toBe(3);
  });

  it("미래 학년은 건너뜀", () => {
    const input = makeInput({
      currentGrade: 1,
      recordsByGrade: new Map([
        [1, makeRecordData({ changche: [] })],
        [2, makeRecordData({ changche: [] })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "missing_career_activity");
    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toContain("1학년");
  });
});

// ─── 창체 미작성 ─────────────────────────────────

describe("checkChangcheEmpty", () => {
  it("자율/동아리/진로 모두 빈 경우 경고", () => {
    const input = makeInput({
      recordsByGrade: new Map([
        [1, makeRecordData({ changche: [] })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "changche_empty");
    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toContain("자율");
  });

  it("여러 학년 모두 빈 경우 각각 경고", () => {
    const input = makeInput({
      currentGrade: 2,
      recordsByGrade: new Map([
        [1, makeRecordData({ changche: [] })],
        [2, makeRecordData({ changche: [] })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "changche_empty");
    expect(warnings.length).toBe(2);
  });
});

// ─── 행특 미확정 ─────────────────────────────────

describe("checkHaengteukDraft", () => {
  it("이전 학년 행특 미작성 시 경고", () => {
    const input = makeInput({
      currentGrade: 2,
      recordsByGrade: new Map([
        [1, makeRecordData({ haengteuk: null })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "haengteuk_draft");
    expect(warnings.length).toBe(1);
  });

  it("현재 학년은 경고 안 함", () => {
    const input = makeInput({
      currentGrade: 2,
      recordsByGrade: new Map([
        [2, makeRecordData({ haengteuk: null })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "haengteuk_draft");
    expect(warnings.length).toBe(0);
  });

  it("1학년+2학년 둘 다 미작성 시 각각 경고", () => {
    const input = makeInput({
      currentGrade: 3,
      recordsByGrade: new Map([
        [1, makeRecordData({ haengteuk: null })],
        [2, makeRecordData({ haengteuk: null })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "haengteuk_draft");
    expect(warnings.length).toBe(2);
  });
});

// ─── 독서 부족 ───────────────────────────────────

describe("checkReadingInsufficient", () => {
  it("독서 0건이면 경고", () => {
    const input = makeInput({
      recordsByGrade: new Map([
        [1, makeRecordData({ readings: [] })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "reading_insufficient");
    expect(warnings.length).toBe(1);
  });

  it("2권 이상이면 경고 없음", () => {
    const input = makeInput({
      recordsByGrade: new Map([
        [1, makeRecordData({ readings: [{} as never, {} as never] })],
      ]),
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "reading_insufficient");
    expect(warnings.length).toBe(0);
  });
});

// ─── 교과이수 부적합 ────────────────────────────

describe("checkCourseInadequacy", () => {
  it("적합도 50 미만이면 경고", () => {
    const input = makeInput({
      diagnosisData: {
        courseAdequacy: { score: 30, majorCategory: "수학", totalRecommended: 7, totalAvailable: 7, taken: ["미적분"], notTaken: ["확률과통계", "기하"], notOffered: [], generalRate: 25, careerRate: 0 },
      } as never,
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "course_inadequacy");
    expect(warnings.length).toBe(1);
    expect(warnings[0].severity).toBe("high"); // 30 ≤ score < 50 → high
  });

  it("적합도 50 이상이면 경고 없음", () => {
    const input = makeInput({
      diagnosisData: {
        courseAdequacy: { score: 70, majorCategory: "수학", totalRecommended: 7, totalAvailable: 7, taken: [], notTaken: [], notOffered: [], generalRate: 70, careerRate: 70 },
      } as never,
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "course_inadequacy");
    expect(warnings.length).toBe(0);
  });
});

// ─── 전공교과 성적 하락 ──────────────────────────

describe("checkMajorSubjectDecline", () => {
  it("2학기 연속 하락 시 경고", () => {
    const input = makeInput({
      targetMajorField: "수리·통계",
      scores: [
        { subjectName: "미적분", grade: 1, semester: 1, rankGrade: 2 },
        { subjectName: "미적분", grade: 1, semester: 2, rankGrade: 3 },
        { subjectName: "미적분", grade: 2, semester: 1, rankGrade: 5 },
      ],
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "major_subject_decline");
    expect(warnings.length).toBe(1);
  });

  it("하락→회복→하락 패턴도 maxConsecutive로 감지", () => {
    const input = makeInput({
      targetMajorField: "수리·통계",
      scores: [
        { subjectName: "미적분", grade: 1, semester: 1, rankGrade: 2 },
        { subjectName: "미적분", grade: 1, semester: 2, rankGrade: 4 },
        { subjectName: "미적분", grade: 2, semester: 1, rankGrade: 5 },
        { subjectName: "미적분", grade: 2, semester: 2, rankGrade: 3 }, // 회복
        { subjectName: "미적분", grade: 3, semester: 1, rankGrade: 4 }, // 다시 하락 시작
      ],
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "major_subject_decline");
    // 1→2 학기 2연속 하락 (2→4→5) 감지됨
    expect(warnings.length).toBe(1);
  });

  it("등급 개선 시 경고 없음", () => {
    const input = makeInput({
      targetMajorField: "수리·통계",
      scores: [
        { subjectName: "미적분", grade: 1, semester: 1, rankGrade: 5 },
        { subjectName: "미적분", grade: 1, semester: 2, rankGrade: 3 },
        { subjectName: "미적분", grade: 2, semester: 1, rankGrade: 2 },
      ],
    });
    const warnings = computeWarnings(input).filter((w) => w.ruleId === "major_subject_decline");
    expect(warnings.length).toBe(0);
  });
});

// ─── 빈 입력 ──────────────────────────────────

describe("빈 입력", () => {
  it("1학년 + 빈 데이터 → 경고 없음 (스토리라인 2학년부터)", () => {
    const input = makeInput({ currentGrade: 1 });
    const warnings = computeWarnings(input);
    expect(warnings.length).toBe(0);
  });

  it("2학년 + 빈 데이터 → 스토리라인 경고만 발생", () => {
    const input = makeInput({ currentGrade: 2 });
    const warnings = computeWarnings(input);
    expect(warnings.every((w) => w.ruleId === "storyline_gap")).toBe(true);
  });
});
