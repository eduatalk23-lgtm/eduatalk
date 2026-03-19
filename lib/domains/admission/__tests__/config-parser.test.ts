import { describe, it, expect } from "vitest";
import { parseMandatoryPattern, parseOptionalPattern, parseWeightedPattern } from "../calculator/config-parser";

describe("parseMandatoryPattern", () => {
  it("국수영탐(2)", () => {
    const result = parseMandatoryPattern("국수영탐(2)");
    expect(result.subjects).toHaveLength(4);
    expect(result.subjects[0]).toEqual({ type: "korean" });
    expect(result.subjects[1]).toEqual({ type: "math" });
    expect(result.subjects[2]).toEqual({ type: "english" });
    expect(result.subjects[3]).toEqual({ type: "inquiry", count: 2 });
  });

  it("국수영탐(1)", () => {
    const result = parseMandatoryPattern("국수영탐(1)");
    expect(result.subjects).toHaveLength(4);
    expect(result.subjects[3]).toEqual({ type: "inquiry", count: 1 });
  });

  it("국수영", () => {
    const result = parseMandatoryPattern("국수영");
    expect(result.subjects).toHaveLength(3);
    expect(result.subjects.map(s => s.type)).toEqual(["korean", "math", "english"]);
  });

  it("영탐(1)", () => {
    const result = parseMandatoryPattern("영탐(1)");
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects[0]).toEqual({ type: "english" });
    expect(result.subjects[1]).toEqual({ type: "inquiry", count: 1 });
  });

  it("영", () => {
    const result = parseMandatoryPattern("영");
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0]).toEqual({ type: "english" });
  });

  it("탐(2)", () => {
    const result = parseMandatoryPattern("탐(2)");
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0]).toEqual({ type: "inquiry", count: 2 });
  });

  it("정규식 폴백 — 레지스트리에 없는 패턴", () => {
    const result = parseMandatoryPattern("국탐(1)");
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects[0]).toEqual({ type: "korean" });
    expect(result.subjects[1]).toEqual({ type: "inquiry", count: 1 });
  });

  it("공백 트림", () => {
    const result = parseMandatoryPattern("  국수영탐(2)  ");
    expect(result.subjects).toHaveLength(4);
  });
});

describe("parseOptionalPattern", () => {
  it("null → null", () => {
    expect(parseOptionalPattern(null)).toBeNull();
    expect(parseOptionalPattern("")).toBeNull();
  });

  it("국수영中택2", () => {
    const result = parseOptionalPattern("국수영中택2");
    expect(result).not.toBeNull();
    expect(result!.pool).toHaveLength(3);
    expect(result!.pickCount).toBe(2);
  });

  it("국수영탐(1)中택3", () => {
    const result = parseOptionalPattern("국수영탐(1)中택3");
    expect(result).not.toBeNull();
    expect(result!.pool).toHaveLength(4);
    expect(result!.pickCount).toBe(3);
  });

  it("국수中택1", () => {
    const result = parseOptionalPattern("국수中택1");
    expect(result).not.toBeNull();
    expect(result!.pool).toHaveLength(2);
    expect(result!.pickCount).toBe(1);
  });

  it("정규식 폴백", () => {
    const result = parseOptionalPattern("국수한中택2");
    expect(result).not.toBeNull();
    expect(result!.pool).toHaveLength(3);
    expect(result!.pool[2]).toEqual({ type: "history" });
    expect(result!.pickCount).toBe(2);
  });
});

describe("parseWeightedPattern", () => {
  it("null → null", () => {
    expect(parseWeightedPattern(null)).toBeNull();
    expect(parseWeightedPattern("")).toBeNull();
  });

  it("국수영탐(2)中가중택4", () => {
    const result = parseWeightedPattern("국수영탐(2)中가중택4");
    expect(result).not.toBeNull();
    expect(result!.pool).toHaveLength(4);
    expect(result!.pickCount).toBe(4);
  });

  it("국수中가중택2", () => {
    const result = parseWeightedPattern("국수中가중택2");
    expect(result).not.toBeNull();
    expect(result!.pool).toHaveLength(2);
    expect(result!.pickCount).toBe(2);
  });

  it("정규식 폴백", () => {
    const result = parseWeightedPattern("수영中가중택2");
    expect(result).not.toBeNull();
    expect(result!.pool).toHaveLength(2);
    expect(result!.pickCount).toBe(2);
  });
});
