import { describe, it, expect } from "vitest";
import { detectYears, findHeader } from "../import/header-detector";

describe("detectYears", () => {
  it("2026학년도 파일에서 2025/2024/2023 감지", () => {
    const headers = [
      "선택", "기초", "대학교", "계열", "모집단위명",
      "2025학년도경쟁률", "2024학년도경쟁률", "2023학년도경쟁률",
      "2025학년도 기준", "2025학년도입결(등급)",
    ];
    const result = detectYears(headers);
    expect(result.year0).toBe(2025);
    expect(result.year1).toBe(2024);
    expect(result.year2).toBe(2023);
  });

  it("2025학년도 파일에서 2024/2023/2022 감지", () => {
    const headers = [
      "대학교", "2024학년도경쟁률", "2023학년도경쟁률", "2022학년도경쟁률",
    ];
    const result = detectYears(headers);
    expect(result.year0).toBe(2024);
    expect(result.year1).toBe(2023);
    expect(result.year2).toBe(2022);
  });

  it("공백 포함 헤더도 감지", () => {
    const headers = ["2025학년도\r\n경쟁률", "2024학년도\r\n경쟁률"];
    // 줄바꿈이 제거된 후 감지 — excel-parser에서 이미 제거됨
    // header-detector는 원본 헤더를 받으므로 줄바꿈 포함 가능
    // detectYears의 패턴은 /(\d{4})학년도\s*경쟁률/이므로 \r\n도 매칭
    const result = detectYears(headers);
    expect(result.year0).toBe(2025);
    expect(result.year1).toBe(2024);
  });

  it("연도가 1개만 있으면 에러", () => {
    const headers = ["2025학년도경쟁률"];
    expect(() => detectYears(headers)).toThrow("2개 이상");
  });

  it("연도가 없으면 에러", () => {
    expect(() => detectYears(["대학교", "학과"])).toThrow("2개 이상");
  });
});

describe("findHeader", () => {
  const headers = [
    "선택", "기초", "대학교",
    "2025학년도경쟁률", "2024학년도경쟁률", "2023학년도경쟁률",
    "2025학년도 기준", "2025학년도입결(등급)", "2025학년도입결(환산점수)",
    "2025충원", "2024학년도 기준2", "2024학년도입결(등급)",
    "2023학년도입결",
  ];

  it("경쟁률 매칭", () => {
    expect(findHeader(headers, "경쟁률", 2025)).toBe("2025학년도경쟁률");
    expect(findHeader(headers, "경쟁률", 2024)).toBe("2024학년도경쟁률");
    expect(findHeader(headers, "경쟁률", 2023)).toBe("2023학년도경쟁률");
  });

  it("기준 매칭", () => {
    expect(findHeader(headers, "기준", 2025)).toBe("2025학년도 기준");
    expect(findHeader(headers, "기준", 2024)).toBe("2024학년도 기준2");
  });

  it("입결(등급) 매칭", () => {
    expect(findHeader(headers, "입결(등급)", 2025)).toBe("2025학년도입결(등급)");
    expect(findHeader(headers, "입결(등급)", 2024)).toBe("2024학년도입결(등급)");
  });

  it("충원 매칭", () => {
    expect(findHeader(headers, "충원", 2025)).toBe("2025충원");
  });

  it("없는 컬럼은 null", () => {
    expect(findHeader(headers, "경쟁률", 2022)).toBeNull();
    expect(findHeader(headers, "없는키워드", 2025)).toBeNull();
  });
});
