// 권고3 / Step 2.4 — slot-mmr 단위 테스트.

import { describe, it, expect } from "vitest";
import { selectByMmr, defaultLambdaForGrade, type MmrCandidate } from "../slot-mmr";

function c(id: string, relevance: number, features: string[]): MmrCandidate<{ id: string }> {
  return { guide: { id }, relevance, features };
}

describe("selectByMmr", () => {
  it("k=0 → 빈 결과", () => {
    const r = selectByMmr([c("a", 1, [])], { lambda: 0.5, k: 0 });
    expect(r.selected).toEqual([]);
  });

  it("후보 0건 → 빈 결과", () => {
    const r = selectByMmr<{ id: string }>([], { lambda: 0.5, k: 3 });
    expect(r.selected).toEqual([]);
    expect(r.notSelected).toEqual([]);
  });

  it("lambda=1 (관련성만) — 단순 sort by relevance desc", () => {
    const cands = [
      c("a", 0.5, ["x"]),
      c("b", 0.9, ["x"]), // 가장 높음
      c("c", 0.7, ["x"]),
    ];
    const r = selectByMmr(cands, { lambda: 1, k: 2 });
    expect(r.selected.map((s) => s.guide.id)).toEqual(["b", "c"]);
  });

  it("lambda=0 (다양성만) — 첫 1건은 max relevance, 이후 features 안 겹치는 것 우선", () => {
    const cands = [
      c("a", 1, ["math"]), // 첫 선택 — max relevance
      c("b", 0.9, ["math"]), // a 와 features 겹침 (jaccard=1)
      c("c", 0.5, ["bio"]), // a 와 안 겹침 (jaccard=0)
    ];
    const r = selectByMmr(cands, { lambda: 0, k: 2 });
    expect(r.selected.map((s) => s.guide.id)).toEqual(["a", "c"]);
  });

  it("lambda=0.5 — relevance 와 다양성 balance. features 다른 후보 우선 (relevance 동률 시)", () => {
    const cands = [
      c("a", 1, ["math", "logic"]),
      c("b", 0.95, ["math", "logic"]), // a 와 features jaccard=1
      c("c", 0.9, ["bio"]),             // a 와 features jaccard=0
    ];
    const r = selectByMmr(cands, { lambda: 0.5, k: 2 });
    // a 다음은 c — b 가 더 relevant (0.95 > 0.9) 지만 features 100% 겹쳐 페널티
    expect(r.selected.map((s) => s.guide.id)).toEqual(["a", "c"]);
  });

  it("k > 후보수 — 모두 선택", () => {
    const cands = [c("a", 1, ["x"]), c("b", 0.5, ["y"])];
    const r = selectByMmr(cands, { lambda: 0.5, k: 5 });
    expect(r.selected).toHaveLength(2);
  });

  it("notSelected 누락 없음", () => {
    const cands = [
      c("a", 1, ["x"]),
      c("b", 0.9, ["x"]),
      c("c", 0.5, ["y"]),
    ];
    const r = selectByMmr(cands, { lambda: 0.5, k: 1 });
    expect(r.selected).toHaveLength(1);
    expect(r.notSelected).toHaveLength(2);
  });

  it("defaultLambdaForGrade — 1학년 다양성 우선, 3학년 관련성 우선", () => {
    expect(defaultLambdaForGrade(1)).toBe(0.5);
    expect(defaultLambdaForGrade(2)).toBe(0.7);
    expect(defaultLambdaForGrade(3)).toBe(0.8);
  });
});
