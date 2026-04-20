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

// Test-only alias to appease linter when passing undefined intentionally.
type UIMessagePartsType = Parameters<typeof extractArtifactCandidates>[0];
