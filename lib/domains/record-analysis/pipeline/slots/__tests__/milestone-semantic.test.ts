import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  buildMilestoneEmbeddingInput,
  computeMilestoneFillRawSemantic,
  MILESTONE_COSINE_THRESHOLD,
} from "../milestone-semantic";
import type { UnfulfilledMilestone } from "../types";

describe("cosineSimilarity", () => {
  it("동일 벡터 → 1.0", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });
  it("정반대 벡터 → -1.0", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });
  it("직교 → 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
  it("길이 불일치 → 0", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
  it("zero vector → 0", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe("buildMilestoneEmbeddingInput", () => {
  it("activityText + narrativeGoal 결합", () => {
    const m: UnfulfilledMilestone = {
      id: "m1",
      activityText: "의학 윤리 독서",
      narrativeGoal: "기초 진로 탐색",
      competencyFocus: [],
    };
    const text = buildMilestoneEmbeddingInput(m);
    expect(text).toContain("의학 윤리 독서");
    expect(text).toContain("기초 진로 탐색");
  });
  it("narrativeGoal 빈 경우 activityText 만", () => {
    const m: UnfulfilledMilestone = {
      id: "m1",
      activityText: "생명과학 세포",
      narrativeGoal: "",
      competencyFocus: [],
    };
    expect(buildMilestoneEmbeddingInput(m)).toBe("생명과학 세포");
  });
});

describe("computeMilestoneFillRawSemantic", () => {
  const ms: UnfulfilledMilestone[] = [
    { id: "a", activityText: "A", narrativeGoal: "", competencyFocus: [] },
    { id: "b", activityText: "B", narrativeGoal: "", competencyFocus: [] },
  ];

  it("guideEmbedding undefined → raw=0", () => {
    const r = computeMilestoneFillRawSemantic({
      slotMilestones: ms,
      milestoneEmbeddings: new Map(),
      guideEmbedding: undefined,
    });
    expect(r.raw).toBe(0);
    expect(r.matchedIds).toEqual([]);
  });

  it("milestone 임베딩 없으면 skip", () => {
    const r = computeMilestoneFillRawSemantic({
      slotMilestones: ms,
      milestoneEmbeddings: new Map(),
      guideEmbedding: [1, 0, 0],
    });
    expect(r.raw).toBe(0);
  });

  it("threshold 통과 시 매칭 — 1/2 → raw=0.5", () => {
    const me = new Map<string, number[]>();
    me.set("a", [1, 0, 0]); // 동일 → cosine=1
    me.set("b", [0, 1, 0]); // 직교 → cosine=0
    const r = computeMilestoneFillRawSemantic({
      slotMilestones: ms,
      milestoneEmbeddings: me,
      guideEmbedding: [1, 0, 0],
      threshold: 0.5,
    });
    expect(r.raw).toBe(0.5);
    expect(r.matchedIds).toEqual(["a"]);
  });

  it("default threshold = MILESTONE_COSINE_THRESHOLD", () => {
    expect(MILESTONE_COSINE_THRESHOLD).toBeGreaterThan(0);
    expect(MILESTONE_COSINE_THRESHOLD).toBeLessThan(1);
  });
});
