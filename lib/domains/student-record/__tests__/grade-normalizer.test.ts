import { describe, it, expect } from "vitest";
import {
  determineGradeSystem,
  grade9To5,
  grade5To9,
  grade5To9Range,
  normalizeGrade,
} from "../grade-normalizer";

// ============================================
// 1. determineGradeSystem
// ============================================

describe("determineGradeSystem", () => {
  it("2022 이상 → 5등급", () => expect(determineGradeSystem(2022)).toBe(5));
  it("2025 → 5등급", () => expect(determineGradeSystem(2025)).toBe(5));
  it("2021 → 9등급", () => expect(determineGradeSystem(2021)).toBe(9));
  it("2015 → 9등급", () => expect(determineGradeSystem(2015)).toBe(9));
  it("null → 9등급 (기본값)", () => expect(determineGradeSystem(null)).toBe(9));
  it("undefined → 9등급 (기본값)", () => expect(determineGradeSystem(undefined)).toBe(9));
});

// ============================================
// 2. grade9To5
// ============================================

describe("grade9To5", () => {
  it("1등급 → A", () => expect(grade9To5(1)).toBe("A"));
  it("2등급 → A", () => expect(grade9To5(2)).toBe("A"));
  it("3등급 → B", () => expect(grade9To5(3)).toBe("B"));
  it("4등급 → B", () => expect(grade9To5(4)).toBe("B"));
  it("5등급 → C", () => expect(grade9To5(5)).toBe("C"));
  it("6등급 → C", () => expect(grade9To5(6)).toBe("C"));
  it("7등급 → D", () => expect(grade9To5(7)).toBe("D"));
  it("8등급 → D", () => expect(grade9To5(8)).toBe("D"));
  it("9등급 → E", () => expect(grade9To5(9)).toBe("E"));
  it("범위 밖 0 → ?", () => expect(grade9To5(0)).toBe("?"));
  it("범위 밖 10 → ?", () => expect(grade9To5(10)).toBe("?"));
});

// ============================================
// 3. grade5To9
// ============================================

describe("grade5To9", () => {
  it("A → 2 (대표값)", () => expect(grade5To9("A")).toBe(2));
  it("B → 3 (대표값)", () => expect(grade5To9("B")).toBe(3));
  it("C → 5 (대표값)", () => expect(grade5To9("C")).toBe(5));
  it("D → 7 (대표값)", () => expect(grade5To9("D")).toBe(7));
  it("E → 9 (대표값)", () => expect(grade5To9("E")).toBe(9));
  it("소문자 a → 2", () => expect(grade5To9("a")).toBe(2));
  it("잘못된 값 X → 0", () => expect(grade5To9("X")).toBe(0));
});

// ============================================
// 4. grade5To9Range
// ============================================

describe("grade5To9Range", () => {
  it("A → min:1, max:2", () => {
    expect(grade5To9Range("A")).toEqual({ min: 1, max: 2 });
  });
  it("C → min:5, max:6", () => {
    expect(grade5To9Range("C")).toEqual({ min: 5, max: 6 });
  });
  it("잘못된 값 → null", () => {
    expect(grade5To9Range("X")).toBeNull();
  });
});

// ============================================
// 5. normalizeGrade
// ============================================

describe("normalizeGrade", () => {
  // 9등급 → 정규화
  it("9등급 2등급 → displayLabel '2등급'", () => {
    const result = normalizeGrade(2, 2015);
    expect(result.gradeSystem).toBe(9);
    expect(result.normalizedTo9).toBe(2);
    expect(result.normalizedTo5).toBe("A");
    expect(result.displayLabel).toBe("2등급");
  });

  it("9등급 5등급 → 5등급 C에 매핑", () => {
    const result = normalizeGrade(5, 2015);
    expect(result.normalizedTo5).toBe("C");
  });

  it("9등급 문자열 입력 '3' → 정상 처리", () => {
    const result = normalizeGrade("3", 2015);
    expect(result.normalizedTo9).toBe(3);
    expect(result.normalizedTo5).toBe("B");
  });

  // 5등급 → 정규화
  it("5등급 B → displayLabel 'B(≈3등급)'", () => {
    const result = normalizeGrade("B", 2022);
    expect(result.gradeSystem).toBe(5);
    expect(result.normalizedTo5).toBe("B");
    expect(result.normalizedTo9).toBe(3);
    expect(result.displayLabel).toBe("B(≈3등급)");
  });

  it("5등급 A → 9등급 2에 매핑", () => {
    const result = normalizeGrade("A", 2022);
    expect(result.normalizedTo9).toBe(2);
  });

  // 잘못된 입력
  it("9등급 범위 밖 → 환산 불가", () => {
    const result = normalizeGrade(0, 2015);
    expect(result.normalizedTo9).toBeNull();
    expect(result.displayLabel).toContain("환산 불가");
  });

  // 학년 간 비교 시나리오
  it("1학년(5등급 B) vs 2학년(9등급 3등급) — 동일 수준", () => {
    const grade1 = normalizeGrade("B", 2022);
    const grade2 = normalizeGrade(3, 2015);
    // 둘 다 9등급 3에 매핑되어야 함
    expect(grade1.normalizedTo9).toBe(3);
    expect(grade2.normalizedTo9).toBe(3);
  });
});
