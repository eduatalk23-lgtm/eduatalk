import { describe, it, expect } from "vitest";
import {
  computeAdequateLevel,
  gpaToLevel,
  gpaToInferredTier,
  tierToExpectedLevel,
} from "../engine";

// ─── gpaToLevel 경계값 ──

describe("gpaToLevel", () => {
  it.each([
    [1.0, 5],
    [1.5, 5],   // 경계: <=1.5 → 5
    [1.51, 4],
    [2.5, 4],   // 경계: <=2.5 → 4
    [2.51, 3],
    [4.0, 3],   // 경계: <=4.0 → 3
    [4.01, 2],
    [6.0, 2],   // 경계: <=6.0 → 2
    [6.01, 1],
    [9.0, 1],
  ] as const)("gpa %s → level %s", (gpa, expected) => {
    expect(gpaToLevel(gpa)).toBe(expected);
  });
});

// ─── gpaToInferredTier 경계값 ──

describe("gpaToInferredTier", () => {
  it.each([
    [1.0, "sky_plus"],
    [2.0, "sky_plus"],  // 경계: <=2.0
    [2.01, "in_seoul"],
    [3.5, "in_seoul"],  // 경계: <=3.5
    [3.51, "regional"],
    [5.0, "regional"],  // 경계: <=5.0
    [5.01, "general"],
    [9.0, "general"],
  ] as const)("gpa %s → tier %s", (gpa, expected) => {
    expect(gpaToInferredTier(gpa)).toBe(expected);
  });
});

// ─── tierToExpectedLevel ──

describe("tierToExpectedLevel", () => {
  it.each([
    ["sky_plus", 5],
    ["in_seoul", 4],
    ["regional", 3],
    ["general", 2],
  ] as const)("tier %s → level %s", (tier, expected) => {
    expect(tierToExpectedLevel(tier)).toBe(expected);
  });
});

// ─── computeAdequateLevel 핵심 로직 ──

describe("computeAdequateLevel", () => {
  it("내신 없는 신입생: 축 1 단독 (기대 레벨 = 적정 레벨)", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: "in_seoul",
      currentGpa: null,
      grade: 1,
    });
    expect(result.adequateLevel).toBe(4); // in_seoul → L4
    expect(result.expectedLevel).toBe(4);
    expect(result.adequateFromGpa).toBe(4); // 내신 없으면 기대와 동일
    expect(result.hasGpaData).toBe(false);
  });

  it("학교권 null → 기본값 general", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: null,
      currentGpa: null,
      grade: 1,
    });
    expect(result.resolvedTier).toBe("general");
    expect(result.adequateLevel).toBe(2);
  });

  it("이중 축 교차: 기대와 내신 중 낮은 쪽", () => {
    // sky_plus(L5) + 내신 3.0등급(L3) → min(5,3) = L3
    const result = computeAdequateLevel({
      targetSchoolTier: "sky_plus",
      currentGpa: 3.0,
      grade: 2,
    });
    expect(result.expectedLevel).toBe(5);
    expect(result.adequateFromGpa).toBe(3);
    expect(result.adequateLevel).toBe(3); // min(5, 3)
  });

  it("내신이 기대보다 좋으면 기대 레벨 유지", () => {
    // regional(L3) + 내신 1.2등급(L5) → min(3,5) = L3 (기대 유지)
    const result = computeAdequateLevel({
      targetSchoolTier: "regional",
      currentGpa: 1.2,
      grade: 2,
    });
    expect(result.adequateLevel).toBe(3);
  });

  it("고3 보정: 1단계 상향", () => {
    // in_seoul(L4) + 내신 3.0등급(L3) → min(4,3)=L3 → 고3 보정 → L4
    const result = computeAdequateLevel({
      targetSchoolTier: "in_seoul",
      currentGpa: 3.0,
      grade: 3,
    });
    expect(result.adequateLevel).toBe(4);
  });

  it("고3 보정은 L5를 초과하지 않음", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: "sky_plus",
      currentGpa: 1.0,
      grade: 3,
    });
    expect(result.adequateLevel).toBe(5); // 이미 L5 → 보정 안 함
  });

  // ─── gap 계산 ──

  it("gap = 기대 - 현재 (currentLevel 있을 때)", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: "sky_plus", // L5
      currentGpa: 2.0,
      grade: 2,
      currentLevel: 3,
    });
    expect(result.gap).toBe(2); // 5 - 3 = 2
  });

  it("gap = 기대 - 적정 (currentLevel 없을 때)", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: "sky_plus", // L5
      currentGpa: 2.0, // L4
      grade: 2,
      currentLevel: null,
    });
    expect(result.gap).toBe(1); // 5 - 4 = 1
  });

  it("gap 음수: 현재가 기대 초과", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: "general", // L2
      currentGpa: 1.0,
      grade: 2,
      currentLevel: 5,
    });
    expect(result.gap).toBe(-3); // 2 - 5 = -3
  });

  // ─── 출력 필드 검증 ──

  it("모든 출력 필드가 존재", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: "in_seoul",
      currentGpa: 2.5,
      grade: 2,
      currentLevel: 4,
    });
    expect(result).toMatchObject({
      adequateLevel: expect.any(Number),
      expectedLevel: 4,
      adequateFromGpa: 4,
      currentLevel: 4,
      gap: 0,
      resolvedTier: "in_seoul",
      tierLabel: expect.any(String),
      levelLabel: expect.any(String),
      levelDirective: expect.any(String),
      hasGpaData: true,
    });
  });

  it("levelDirective에 난이도 라벨 포함", () => {
    const result = computeAdequateLevel({
      targetSchoolTier: "sky_plus",
      currentGpa: 1.0,
      grade: 2,
    });
    expect(result.levelDirective).toContain("최심화");
    expect(result.levelDirective).toContain("SKY+");
  });
});
