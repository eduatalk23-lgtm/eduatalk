import { describe, it, expect } from "vitest";
import { resolveSchoolTier } from "../resolve-tier";

describe("resolveSchoolTier", () => {
  it("1순위: 명시 입력 우선", () => {
    const result = resolveSchoolTier({
      explicitTier: "sky_plus",
      currentGpa: 5.0, // 내신으로는 regional이지만 명시가 우선
    });
    expect(result.tier).toBe("sky_plus");
    expect(result.source).toBe("explicit");
  });

  it("잘못된 명시값은 무시 → 2순위로 폴백", () => {
    const result = resolveSchoolTier({
      explicitTier: "invalid_value",
      currentGpa: 2.0,
    });
    expect(result.tier).toBe("sky_plus"); // 내신 2.0 → sky_plus
    expect(result.source).toBe("gpa_inferred");
  });

  it("빈 문자열 명시값 → 2순위로 폴백", () => {
    const result = resolveSchoolTier({
      explicitTier: "",
      currentGpa: 3.0,
    });
    expect(result.tier).toBe("in_seoul");
    expect(result.source).toBe("gpa_inferred");
  });

  it("2순위: 내신 기반 추론", () => {
    const result = resolveSchoolTier({
      explicitTier: null,
      currentGpa: 4.5,
    });
    expect(result.tier).toBe("regional");
    expect(result.source).toBe("gpa_inferred");
  });

  it("3순위: 기본값 (내신도 없을 때)", () => {
    const result = resolveSchoolTier({
      explicitTier: null,
      currentGpa: null,
    });
    expect(result.tier).toBe("general");
    expect(result.source).toBe("default");
  });

  it("내신 0 이하는 데이터 없음 취급", () => {
    const result = resolveSchoolTier({
      explicitTier: null,
      currentGpa: 0,
    });
    expect(result.tier).toBe("general");
    expect(result.source).toBe("default");
  });
});
