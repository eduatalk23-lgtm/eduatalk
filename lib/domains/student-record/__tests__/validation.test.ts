import { describe, it, expect } from "vitest";
import {
  countNeisBytes,
  detectNeisInvalidChars,
  validateNeisContent,
  normalizeLineBreaks,
} from "../validation";

// ============================================
// 1. countNeisBytes
// ============================================

describe("countNeisBytes", () => {
  // 한글
  it("한글 1자 = 3B", () => expect(countNeisBytes("가")).toBe(3));
  it("한글 2자 = 6B", () => expect(countNeisBytes("가나")).toBe(6));
  it("한글 500자 = 1500B (세특 제한)", () => expect(countNeisBytes("가".repeat(500))).toBe(1500));
  it("한글 자모 1자 = 3B", () => expect(countNeisBytes("ㄱ")).toBe(3));

  // ASCII
  it("영문 1자 = 1B", () => expect(countNeisBytes("A")).toBe(1));
  it("숫자 1자 = 1B", () => expect(countNeisBytes("1")).toBe(1));
  it("공백 1자 = 1B", () => expect(countNeisBytes(" ")).toBe(1));
  it("특수문자 . = 1B", () => expect(countNeisBytes(".")).toBe(1));

  // 혼합
  it("한글+영문 혼합 '가A' = 4B", () => expect(countNeisBytes("가A")).toBe(4));
  it("한글+숫자+공백 '가 1' = 5B", () => expect(countNeisBytes("가 1")).toBe(5));

  // CJK 한자
  it("한자 1자 = 3B", () => expect(countNeisBytes("學")).toBe(3));

  // 전각 특수문자
  it("전각 느낌표 ！ = 3B", () => expect(countNeisBytes("！")).toBe(3));

  // 줄바꿈
  it("LF = 1B", () => expect(countNeisBytes("\n")).toBe(1));
  it("CR = 1B", () => expect(countNeisBytes("\r")).toBe(1));
  it("CRLF = 2B", () => expect(countNeisBytes("\r\n")).toBe(2));

  // 이모지 (4B 문자)
  it("이모지 😀 = 4B", () => expect(countNeisBytes("😀")).toBe(4));
  it("이모지 포함 혼합 '가😀A' = 8B", () => expect(countNeisBytes("가😀A")).toBe(8));

  // 빈 문자열
  it("빈 문자열 = 0B", () => expect(countNeisBytes("")).toBe(0));

  // 실제 세특 샘플
  it("실제 세특 텍스트 바이트 계산", () => {
    const sample = "수업 시간에 적극적으로 참여하였음.";
    // "수업" 2×3=6, " " 1, "시간에" 3×3=9, " " 1, "적극적으로" 4×3=12,
    // " " 1, "참여하였음" 4×3=12, "." 1 → 총 15한글×3 + 3공백 + 1마침표 = 49
    expect(countNeisBytes(sample)).toBe(49);
  });

  // 경계값: 정확히 500자
  it("500자 한글 = 정확히 1500B", () => {
    const text = "가".repeat(500);
    expect(text.length).toBe(500);
    expect(countNeisBytes(text)).toBe(1500);
  });

  // 경계값: 501자 초과
  it("501자 한글 = 1503B (초과)", () => {
    expect(countNeisBytes("가".repeat(501))).toBe(1503);
  });
});

// ============================================
// 2. detectNeisInvalidChars
// ============================================

describe("detectNeisInvalidChars", () => {
  it("일반 텍스트 → 빈 배열", () => {
    expect(detectNeisInvalidChars("가나다 ABC 123")).toEqual([]);
  });

  it("이모지 감지", () => {
    const result = detectNeisInvalidChars("가😀나");
    expect(result).toHaveLength(1);
    expect(result[0].char).toBe("😀");
    expect(result[0].position).toBe(1);
  });

  it("여러 이모지 감지", () => {
    const result = detectNeisInvalidChars("😀가😂");
    expect(result).toHaveLength(2);
    expect(result[0].position).toBe(0);
    expect(result[1].position).toBe(2);
  });

  it("한글+영문+숫자+특수문자 → 빈 배열", () => {
    expect(detectNeisInvalidChars("학생은 A+를 받았다. (100점)")).toEqual([]);
  });
});

// ============================================
// 3. validateNeisContent
// ============================================

describe("validateNeisContent", () => {
  it("정상 범위 내 텍스트", () => {
    const result = validateNeisContent("가나다", 500);
    expect(result.chars).toBe(3);
    expect(result.bytes).toBe(9);
    expect(result.isOverChar).toBe(false);
    expect(result.isOverByte).toBe(false);
    expect(result.invalidChars).toEqual([]);
  });

  it("글자수 초과 감지", () => {
    const result = validateNeisContent("가".repeat(501), 500);
    expect(result.isOverChar).toBe(true);
    expect(result.isOverByte).toBe(true);
  });

  it("글자수 OK but 바이트 초과 (영문은 해당 없음)", () => {
    // 한글 500자 = 500자, 1500B → 정확히 한도
    const result = validateNeisContent("가".repeat(500), 500);
    expect(result.isOverChar).toBe(false);
    expect(result.isOverByte).toBe(false);
  });

  it("이모지 포함 시 invalidChars 반환", () => {
    const result = validateNeisContent("가😀나", 500);
    expect(result.invalidChars).toHaveLength(1);
  });

  it("행특 300자 제한 (2026~)", () => {
    const result = validateNeisContent("가".repeat(300), 300);
    expect(result.isOverChar).toBe(false);
    expect(result.charLimit).toBe(300);
    expect(result.byteLimit).toBe(900);
  });
});

// ============================================
// 4. normalizeLineBreaks
// ============================================

describe("normalizeLineBreaks", () => {
  it("CRLF → LF", () => {
    expect(normalizeLineBreaks("가\r\n나")).toBe("가\n나");
  });

  it("CR → LF", () => {
    expect(normalizeLineBreaks("가\r나")).toBe("가\n나");
  });

  it("LF는 유지", () => {
    expect(normalizeLineBreaks("가\n나")).toBe("가\n나");
  });

  it("혼합 줄바꿈 정규화", () => {
    expect(normalizeLineBreaks("가\r\n나\r다\n라")).toBe("가\n나\n다\n라");
  });

  it("줄바꿈 없는 텍스트", () => {
    expect(normalizeLineBreaks("가나다")).toBe("가나다");
  });
});
