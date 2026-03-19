import { describe, it, expect } from "vitest";
import { cleanRows, cleanValue, isEmptyValue, normalizeBasis } from "../import/cleaner";
import type { RawAdmissionRow } from "../types";

describe("isEmptyValue", () => {
  it("null/undefined → true", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
  });

  it("빈 문자열 → true", () => {
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue("  ")).toBe(true);
  });

  it("대시 변형 → true", () => {
    expect(isEmptyValue("-")).toBe(true);
    expect(isEmptyValue("—")).toBe(true);
    expect(isEmptyValue("–")).toBe(true);
  });

  it("실제 값 → false", () => {
    expect(isEmptyValue("3.5")).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue("없음")).toBe(false);
  });
});

describe("cleanValue", () => {
  it("비어있는 값 → null", () => {
    expect(cleanValue(null)).toBeNull();
    expect(cleanValue("-")).toBeNull();
    expect(cleanValue("")).toBeNull();
  });

  it("실제 값 → trimmed string", () => {
    expect(cleanValue("  서울대학교  ")).toBe("서울대학교");
    expect(cleanValue(3.5)).toBe("3.5");
    expect(cleanValue(0)).toBe("0");
  });
});

describe("normalizeBasis", () => {
  it("오타 → 정규화", () => {
    expect(normalizeBasis("최종등록자퍙균")).toBe("최종등록자평균");
    expect(normalizeBasis("최종증록자70%컷")).toBe("최종등록자70%컷");
    expect(normalizeBasis("최종동륵자평균")).toBe("최종등록자평균");
    expect(normalizeBasis("최저등록자85%컷")).toBe("최종등록자85%컷");
  });

  it("공백 변형 → 정규화", () => {
    expect(normalizeBasis("최종등록자 평균")).toBe("최종등록자평균");
    expect(normalizeBasis("최종등록자 70%컷")).toBe("최종등록자70%컷");
  });

  it("% 누락 → 복원", () => {
    expect(normalizeBasis("최종등록자70컷")).toBe("최종등록자70%컷");
    expect(normalizeBasis("최종등록자85컷")).toBe("최종등록자85%컷");
  });

  it("정상값 → 그대로", () => {
    expect(normalizeBasis("최종등록자평균")).toBe("최종등록자평균");
    expect(normalizeBasis("최종등록자70%컷")).toBe("최종등록자70%컷");
    expect(normalizeBasis("1단계합격자평균")).toBe("1단계합격자평균");
  });
});

describe("cleanRows", () => {
  it("선택 컬럼 제거", () => {
    const rows: RawAdmissionRow[] = [
      { "선택": 1, "대학교": "서울대학교", "모집단위명": "경제학부" },
    ];
    const { cleaned } = cleanRows(rows, []);
    expect(cleaned[0]["선택"]).toBeUndefined();
    expect(cleaned[0]["대학교"]).toBe("서울대학교");
  });

  it("열1 컬럼도 제거 (구버전 헤더)", () => {
    const rows: RawAdmissionRow[] = [
      { "열1": null, "대학교": "고려대학교" },
    ];
    const { cleaned } = cleanRows(rows, []);
    expect(cleaned[0]["열1"]).toBeUndefined();
  });

  it("정확 중복 제거", () => {
    const row = { "대학교": "청주대학교", "모집단위명": "경영학과", "전형유형": "학생부교과" };
    const rows: RawAdmissionRow[] = [row, { ...row }, { "대학교": "다른대학교" }];
    const { cleaned, stats } = cleanRows(rows, []);
    expect(cleaned.length).toBe(2);
    expect(stats.exactDuplicatesRemoved).toBe(1);
  });

  it("기준 오타 정규화 카운팅", () => {
    const rows: RawAdmissionRow[] = [
      { "기준A": "최종등록자퍙균", "기준B": "최종등록자평균" },
    ];
    const { cleaned, stats } = cleanRows(rows, ["기준A", "기준B"]);
    expect(stats.typosNormalized).toBe(1);
    expect(cleaned[0]["기준A"]).toBe("최종등록자평균");
    expect(cleaned[0]["기준B"]).toBe("최종등록자평균"); // 원래 정상이므로 변경 안 됨
  });

  it("'-' 값 카운팅", () => {
    const rows: RawAdmissionRow[] = [
      { "경쟁률": "-", "입결": "2.5", "충원": "-" },
    ];
    const { stats } = cleanRows(rows, []);
    expect(stats.dashToNull).toBe(2);
  });
});
