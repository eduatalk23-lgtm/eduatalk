import { describe, expect, it } from "vitest";
import { extractArtifactCandidates } from "../artifact-tool-mapper";

describe("extractArtifactCandidates", () => {
  it("getScores 성공 output 추출", () => {
    const parts = [
      { type: "text", text: "성적 조회 결과입니다" },
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
    const result = extractArtifactCandidates(parts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "scores",
      title: "김세린 내신 성적",
      subtitle: "2학년 · 1학기 · 5과목",
      subjectKey: "김세린",
      originPath: "/scores/school/2/1",
    });
  });

  it("ok=false 면 제외", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: { ok: false, reason: "학생 없음" },
      },
    ];
    expect(extractArtifactCandidates(parts)).toEqual([]);
  });

  it("count=0 면 제외", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: { ok: true, filter: {}, count: 0, rows: [] },
      },
    ];
    expect(extractArtifactCandidates(parts)).toEqual([]);
  });

  it("pending/streaming state 는 무시", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "input-streaming",
        output: {
          ok: true,
          studentName: "김세린",
          filter: { grade: 1 },
          count: 3,
          rows: [],
        },
      },
    ];
    expect(extractArtifactCandidates(parts)).toEqual([]);
  });

  it("dynamic-tool 형식도 지원", () => {
    const parts = [
      {
        type: "dynamic-tool",
        toolName: "getScores",
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
    expect(extractArtifactCandidates(parts)).toHaveLength(1);
  });

  it("지원하지 않는 tool 은 무시", () => {
    const parts = [
      {
        type: "tool-navigateTo",
        state: "output-available",
        output: { ok: true, target: "/scores" },
      },
    ];
    expect(extractArtifactCandidates(parts)).toEqual([]);
  });

  it("같은 type×subjectKey 는 마지막만", () => {
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
    const result = extractArtifactCandidates(parts);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toContain("2학년");
  });

  it("서로 다른 학생은 별개 candidate", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: {},
          count: 3,
          rows: [],
        },
      },
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "박준서",
          filter: {},
          count: 2,
          rows: [],
        },
      },
    ];
    expect(extractArtifactCandidates(parts)).toHaveLength(2);
  });

  it("빈 parts 는 안전", () => {
    expect(extractArtifactCandidates([])).toEqual([]);
    expect(
      extractArtifactCandidates(undefined as unknown as UIMessagePartsType),
    ).toEqual([]);
  });
});

// ============================================
// C-3 S3 2단계: analyzeRecord → analysis artifact 매핑
// ============================================

describe("extractArtifactCandidates — analyzeRecord", () => {
  it("completed status + summary 가 있으면 analysis artifact", () => {
    const parts = [
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: {
          ok: true,
          studentId: "stu-1",
          studentName: "김세린",
          status: "completed",
          progress: {
            completedGrades: [1, 2],
            runningGrades: [],
            synthesisStatus: "completed",
          },
          summary: {
            schoolYear: 2026,
            overallGrade: "A-",
            recordDirection: "사회과학",
            strengths: ["탐구력", "리더십"],
            weaknesses: ["수리 활동 부족"],
            recommendedMajors: ["국제통상", "정치외교"],
          },
          detailPath: "/admin/students/stu-1",
        },
      },
    ];
    const result = extractArtifactCandidates(parts);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "analysis",
      title: "김세린 생기부 분석",
      subjectKey: "stu-1",
      originPath: "/admin/students/stu-1",
    });
    expect(result[0].subtitle).toContain("분석 완료");
    expect(result[0].subtitle).toContain("2026학년도");
    expect(result[0].subtitle).toContain("A-");
  });

  it("summary 없는 진행 중 상태도 artifact 노출", () => {
    const parts = [
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: {
          ok: true,
          studentId: "stu-2",
          studentName: "박준서",
          status: "running",
          progress: {
            completedGrades: [1],
            runningGrades: [2],
            synthesisStatus: "running",
          },
          summary: null,
          detailPath: "/admin/students/stu-2",
        },
      },
    ];
    const result = extractArtifactCandidates(parts);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toContain("분석 진행 중");
    expect(result[0].subtitle).toContain("완료 1학년");
  });

  it("ok=false 면 제외", () => {
    const parts = [
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: { ok: false, reason: "학생을 찾을 수 없음" },
      },
    ];
    expect(extractArtifactCandidates(parts)).toEqual([]);
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
    expect(extractArtifactCandidates(parts)).toEqual([]);
  });

  it("같은 학생 분석을 두 번 호출하면 마지막만 (subjectKey=studentId 로 dedup)", () => {
    const parts = [
      {
        type: "tool-analyzeRecord",
        state: "output-available",
        output: {
          ok: true,
          studentId: "stu-1",
          studentName: "김세린",
          status: "running",
          progress: { completedGrades: [], runningGrades: [1], synthesisStatus: "none" },
          summary: null,
          detailPath: "/admin/students/stu-1",
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
            overallGrade: "B+",
            recordDirection: null,
            strengths: [],
            weaknesses: [],
            recommendedMajors: [],
          },
          detailPath: "/admin/students/stu-1",
        },
      },
    ];
    const result = extractArtifactCandidates(parts);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toContain("분석 완료");
  });

  it("scores + analysis 같이 있으면 둘 다 별도 candidate", () => {
    const parts = [
      {
        type: "tool-getScores",
        state: "output-available",
        output: {
          ok: true,
          studentName: "김세린",
          filter: { grade: 2 },
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
    const result = extractArtifactCandidates(parts);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.type).sort()).toEqual(["analysis", "scores"]);
  });
});

// Test-only alias to appease linter when passing undefined intentionally.
type UIMessagePartsType = Parameters<typeof extractArtifactCandidates>[0];
