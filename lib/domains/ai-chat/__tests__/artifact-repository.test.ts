import { describe, expect, it } from "vitest";
import { computePropsHash } from "../artifact-repository";

describe("computePropsHash", () => {
  it("같은 내용이면 같은 hash", () => {
    const a = { grade: 2, subject: "수학", score: 92 };
    const b = { grade: 2, subject: "수학", score: 92 };
    expect(computePropsHash(a)).toBe(computePropsHash(b));
  });

  it("객체 키 순서 차이에 독립", () => {
    const a = { grade: 2, subject: "수학", score: 92 };
    const b = { subject: "수학", score: 92, grade: 2 };
    expect(computePropsHash(a)).toBe(computePropsHash(b));
  });

  it("중첩 객체 키 순서도 정규화", () => {
    const a = { outer: { x: 1, y: 2 } };
    const b = { outer: { y: 2, x: 1 } };
    expect(computePropsHash(a)).toBe(computePropsHash(b));
  });

  it("값이 다르면 다른 hash", () => {
    expect(computePropsHash({ n: 1 })).not.toBe(computePropsHash({ n: 2 }));
  });

  it("null·undefined·string 도 안정적", () => {
    expect(computePropsHash(null)).toBe(computePropsHash(null));
    expect(computePropsHash("a")).not.toBe(computePropsHash("b"));
  });

  it("배열 순서는 유지 (의미 있는 순서)", () => {
    expect(computePropsHash([1, 2, 3])).not.toBe(computePropsHash([3, 2, 1]));
  });

  it("빈 객체·배열 구분", () => {
    expect(computePropsHash({})).not.toBe(computePropsHash([]));
  });

  it("hash 는 sha-256 길이 (64 hex)", () => {
    expect(computePropsHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
