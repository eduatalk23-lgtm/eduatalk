// ============================================
// L4-D / L3 Targeted Repair — 공용 엔진 단위 테스트
// ============================================

import { describe, it, expect } from "vitest";
import {
  extractErrorViolations,
  extractArrayIndex,
  getTopLevelField,
  groupViolationsByTopField,
  MAX_REPAIR_ATTEMPTS,
} from "../llm/validators/repair-engine";
import type { Violation } from "../llm/validators/types";

function v(rule: string, severity: Violation["severity"], fieldPath?: string): Violation {
  return { rule, severity, message: `${rule} msg`, fieldPath };
}

describe("repair-engine — MAX_REPAIR_ATTEMPTS", () => {
  it("무한 루프 방지를 위해 1로 고정", () => {
    expect(MAX_REPAIR_ATTEMPTS).toBe(1);
  });
});

describe("repair-engine — extractErrorViolations", () => {
  it("error severity만 필터링", () => {
    const violations: Violation[] = [
      v("A", "error", "strengths[0]"),
      v("B", "warning", "weaknesses[1]"),
      v("C", "error"),
    ];
    const errors = extractErrorViolations(violations);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.rule)).toEqual(["A", "C"]);
  });

  it("빈 배열 처리", () => {
    expect(extractErrorViolations([])).toEqual([]);
  });
});

describe("repair-engine — getTopLevelField", () => {
  it("배열 인덱스 앞까지 추출", () => {
    expect(getTopLevelField("strengths[0]")).toBe("strengths");
    expect(getTopLevelField("suggestions[10]")).toBe("suggestions");
  });

  it("객체 속성 앞까지 추출", () => {
    expect(getTopLevelField("improvements[2].action")).toBe("improvements");
    expect(getTopLevelField("directionReasoning")).toBe("directionReasoning");
  });

  it("undefined/빈 문자열 처리", () => {
    expect(getTopLevelField(undefined)).toBe("");
    expect(getTopLevelField("")).toBe("");
  });
});

describe("repair-engine — extractArrayIndex", () => {
  it("배열 인덱스 추출", () => {
    expect(extractArrayIndex("suggestions[3]")).toBe(3);
    expect(extractArrayIndex("strengths[0]")).toBe(0);
    expect(extractArrayIndex("improvements[12].priority")).toBe(12);
  });

  it("배열 인덱스 없으면 null", () => {
    expect(extractArrayIndex("strategyNotes")).toBeNull();
    expect(extractArrayIndex(undefined)).toBeNull();
    expect(extractArrayIndex("")).toBeNull();
  });
});

describe("repair-engine — groupViolationsByTopField", () => {
  it("최상위 필드별 그룹화", () => {
    const violations: Violation[] = [
      v("A", "error", "strengths[0]"),
      v("B", "error", "strengths[1]"),
      v("C", "error", "improvements[0].action"),
      v("D", "warning", "strategyNotes"),
    ];
    const grouped = groupViolationsByTopField(violations);
    expect(grouped.get("strengths")).toHaveLength(2);
    expect(grouped.get("improvements")).toHaveLength(1);
    expect(grouped.get("strategyNotes")).toHaveLength(1);
  });

  it("fieldPath 없는 위반은 제외", () => {
    const violations: Violation[] = [
      v("NoField", "error"),
      v("Field", "error", "strengths[0]"),
    ];
    const grouped = groupViolationsByTopField(violations);
    expect(grouped.size).toBe(1);
    expect(grouped.has("strengths")).toBe(true);
  });
});
