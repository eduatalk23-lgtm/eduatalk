import { describe, expect, it } from "vitest";
import { extractCitations } from "../citation-extractor";

describe("extractCitations — getScores", () => {
  it("정상 output 은 내신 근거로 변환", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: { grade: 2, semester: 1 },
          count: 5,
          rows: [],
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tool: "getScores",
      type: "scores",
      subjectKey: "김세린",
      detail: "5과목",
      originPath: "/scores/school/2/1",
    });
    expect(result[0].label).toContain("김세린");
    expect(result[0].label).toContain("2학년");
    expect(result[0].label).toContain("1학기");
  });

  it("필터 없으면 라벨은 이름만, originPath 는 /scores", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: {},
          count: 10,
          rows: [],
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result[0].label).toBe("김세린 내신");
    expect(result[0].originPath).toBe("/scores");
  });

  it("ok=false 면 제외", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: { ok: false, reason: "학생 없음" },
      },
    ];
    expect(extractCitations(parts)).toEqual([]);
  });

  it("count=0 은 제외 (의미 있는 근거 아님)", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: { ok: true, studentName: "김세린", filter: {}, count: 0, rows: [] },
      },
    ];
    expect(extractCitations(parts)).toEqual([]);
  });

  it("studentName 없으면 제외 (subjectKey 확정 불가)", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: null,
          filter: { grade: 1 },
          count: 3,
          rows: [],
        },
      },
    ];
    expect(extractCitations(parts)).toEqual([]);
  });
});

describe("extractCitations — analyzeRecord", () => {
  it("완료 상태 + summary 있으면 생기부 근거로 변환", () => {
    const parts = [
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: {
          ok: true,
          studentId: "stu-1",
          studentName: "김세린",
          status: "completed",
          progress: { completedGrades: [1, 2], runningGrades: [], synthesisStatus: "completed" },
          summary: {
            schoolYear: 2026,
            overallGrade: "A-",
            recordDirection: null,
            strengths: [],
            weaknesses: [],
            recommendedMajors: [],
          },
          detailPath: "/admin/students/stu-1",
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tool: "analyzeRecord",
      type: "analysis",
      subjectKey: "stu-1",
      label: "김세린 생기부 분석",
    });
    expect(result[0].detail).toContain("A-");
    expect(result[0].detail).toContain("2026학년도");
  });

  it("running 상태에도 근거로 남음 (상태 라벨 사용)", () => {
    const parts = [
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: {
          ok: true,
          studentId: "stu-2",
          studentName: "박준서",
          status: "running",
          progress: { completedGrades: [1], runningGrades: [2], synthesisStatus: "running" },
          summary: null,
          detailPath: "/admin/students/stu-2",
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result).toHaveLength(1);
    expect(result[0].detail).toBe("분석 진행 중");
  });

  it("studentId 없으면 제외", () => {
    const parts = [
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: {
          ok: true,
          studentId: null,
          studentName: "익명",
          status: "no_analysis",
          progress: { completedGrades: [], runningGrades: [], synthesisStatus: "none" },
          summary: null,
          detailPath: "/admin",
        },
      },
    ];
    expect(extractCitations(parts)).toEqual([]);
  });
});

describe("extractCitations — designStudentPlan", () => {
  const planOutput = {
    ok: true,
    runId: "run-1",
    studentId: "stu-1",
    studentName: "김세린",
    durationMs: 10000,
    stepCount: 5,
    summary: {
      headline: "경영 계열 적합 — 2학년 2학기 조정 권장",
      adequacyScore: 75,
      keyFindings: [],
      conflicts: ["일본어II vs 통계"],
      recommendedCourses: ["통계"],
      recommendedActions: [],
      artifactIds: [],
    },
  };

  it("정상 output 은 수강 계획 근거", () => {
    const parts = [
      {
        type: "tool-designStudentPlan",
        state: "output-available",
        output: planOutput,
      },
    ];
    const result = extractCitations(parts);
    expect(result[0]).toMatchObject({
      tool: "designStudentPlan",
      type: "plan",
      subjectKey: "stu-1",
      label: "김세린 수강 계획",
      originPath: "/admin/students/stu-1",
    });
    expect(result[0].detail).toContain("적합도 75");
    expect(result[0].detail).toContain("충돌 1");
  });

  it("detail 후보가 없으면 headline 폴백", () => {
    const parts = [
      {
        type: "tool-designStudentPlan",
        state: "output-available",
        output: {
          ...planOutput,
          summary: {
            ...planOutput.summary,
            adequacyScore: undefined,
            conflicts: [],
          },
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result[0].detail).toBe(planOutput.summary.headline);
  });

  it("ok=false / studentId 누락 / summary null 은 모두 제외", () => {
    for (const bad of [
      { ok: false, reason: "권한 없음" },
      { ...planOutput, studentId: null },
      { ...planOutput, summary: null },
    ]) {
      expect(
        extractCitations([
          { type: "tool-designStudentPlan", state: "output-available", output: bad },
        ]),
      ).toEqual([]);
    }
  });
});

describe("extractCitations — getBlueprint (Sprint G3)", () => {
  const blueprintOutput = {
    ok: true,
    mainExplorationId: "11111111-1111-1111-1111-111111111111",
    studentId: "stu-1",
    studentName: "김세린",
    schoolYear: 2026,
    grade: 2,
    semester: 1,
    scope: "overall",
    trackLabel: null,
    direction: "design",
    themeLabel: "국제통상 기초",
    themeKeywords: [],
    careerField: null,
    version: 2,
    origin: "consultant_direct",
    tiers: {
      foundational: {
        theme: null,
        keyQuestions: [],
        suggestedActivities: [],
        linkedIds: {
          storyline: [],
          roadmapItem: [],
          narrativeArc: [],
          hyperedge: [],
          setekGuide: [],
          changcheGuide: [],
          haengteukGuide: [],
          topicTrajectory: [],
        },
      },
      development: {
        theme: null,
        keyQuestions: [],
        suggestedActivities: [],
        linkedIds: {
          storyline: [],
          roadmapItem: [],
          narrativeArc: [],
          hyperedge: [],
          setekGuide: [],
          changcheGuide: [],
          haengteukGuide: [],
          topicTrajectory: [],
        },
      },
      advanced: {
        theme: null,
        keyQuestions: [],
        suggestedActivities: [],
        linkedIds: {
          storyline: [],
          roadmapItem: [],
          narrativeArc: [],
          hyperedge: [],
          setekGuide: [],
          changcheGuide: [],
          haengteukGuide: [],
          topicTrajectory: [],
        },
      },
    },
  };

  it("정상 output → blueprint 근거", () => {
    const parts = [
      {
        type: "tool-getBlueprint",
        state: "output-available",
        output: blueprintOutput,
      },
    ];
    const result = extractCitations(parts);
    expect(result[0]).toMatchObject({
      tool: "getBlueprint",
      type: "blueprint",
      subjectKey: "stu-1::overall::::design",
      label: "김세린 Blueprint",
      originPath: "/admin/students/stu-1",
    });
    expect(result[0].detail).toContain("전체");
    expect(result[0].detail).toContain("설계");
    expect(result[0].detail).toContain("v2");
  });

  it("mainExplorationId 누락 → 제외", () => {
    const parts = [
      {
        type: "tool-getBlueprint",
        state: "output-available",
        output: { ...blueprintOutput, mainExplorationId: "" },
      },
    ];
    expect(extractCitations(parts)).toEqual([]);
  });

  it("track 슬라이스는 라벨에 포함", () => {
    const parts = [
      {
        type: "tool-getBlueprint",
        state: "output-available",
        output: {
          ...blueprintOutput,
          scope: "track",
          trackLabel: "경영",
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result[0].detail).toContain("경영 트랙");
  });
});

describe("extractCitations — 공통", () => {
  it("pending state 는 무시", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "input-streaming",
        output: {
          ok: true,
          studentName: "김세린",
          filter: {},
          count: 5,
          rows: [],
        },
      },
    ];
    expect(extractCitations(parts)).toEqual([]);
  });

  it("같은 (type, subjectKey) 는 마지막만 유지", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: { grade: 1 },
          count: 3,
          rows: [],
        },
      },
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: { grade: 2 },
          count: 4,
          rows: [],
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("2학년");
  });

  it("dynamic-tool 형식 (toolName 별도) 도 지원", () => {
    const parts = [
      {
        type: "dynamic-tool",
        toolName: "getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: {},
          count: 5,
          rows: [],
        },
      },
    ];
    expect(extractCitations(parts)).toHaveLength(1);
  });

  it("지원하지 않는 tool 은 무시", () => {
    const parts = [
      {
        type: "tool-navigateTo",
        state: "output-available",
        output: { ok: true, target: "/scores" },
      },
    ];
    expect(extractCitations(parts)).toEqual([]);
  });

  it("서로 다른 tool 은 각각 별도 근거", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: {},
          count: 5,
          rows: [],
        },
      },
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: {
          ok: true,
          studentId: "stu-1",
          studentName: "김세린",
          status: "completed",
          progress: { completedGrades: [1, 2], runningGrades: [], synthesisStatus: "completed" },
          summary: {
            schoolYear: 2026,
            overallGrade: "A",
            recordDirection: null,
            strengths: [],
            weaknesses: [],
            recommendedMajors: [],
          },
          detailPath: "/admin/students/stu-1",
        },
      },
    ];
    const result = extractCitations(parts);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.tool).sort()).toEqual(["analyzeRecord", "getScores"]);
  });

  it("빈 parts 는 []", () => {
    expect(extractCitations([])).toEqual([]);
    expect(
      extractCitations(undefined as unknown as Parameters<typeof extractCitations>[0]),
    ).toEqual([]);
  });
});
