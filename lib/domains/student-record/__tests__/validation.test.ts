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

  // 줄바꿈 — NEIS 기준: 엔터 1회 = 2B
  it("LF = 2B (NEIS 기준 줄바꿈 1회)", () => expect(countNeisBytes("\n")).toBe(2));
  it("CR = 2B (정규화 후 LF → 2B)", () => expect(countNeisBytes("\r")).toBe(2));
  it("CRLF = 2B (정규화 후 LF 1회 → 2B)", () => expect(countNeisBytes("\r\n")).toBe(2));
  it("줄바꿈 3회 = 6B", () => expect(countNeisBytes("\n\n\n")).toBe(6));
  it("한글+줄바꿈 '가\\n나' = 8B", () => expect(countNeisBytes("가\n나")).toBe(8));

  // 이모지 (4B 문자)
  it("이모지 😀 = 4B", () => expect(countNeisBytes("😀")).toBe(4));
  it("이모지 포함 혼합 '가😀A' = 8B", () => expect(countNeisBytes("가😀A")).toBe(8));

  // 빈 문자열
  it("빈 문자열 = 0B", () => expect(countNeisBytes("")).toBe(0));

  // 실제 세특 샘플
  it("실제 세특 텍스트 바이트 계산", () => {
    const sample = "수업 시간에 적극적으로 참여하였음.";
    // 한글 15자×3=45 + 공백 3×1=3 + 마침표 1×1=1 → 총 49B
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

  // NEIS 핵심 케이스: 영문/공백 많으면 500자 넘어도 1500B 이내
  it("영문 592자 = 592B (1500B 이내, NEIS 통과)", () => {
    const text = "A".repeat(592);
    expect(text.length).toBe(592);
    expect(countNeisBytes(text)).toBe(592);
  });

  it("한영 혼합: 300한글 + 250영문 = 1150B (500자 넘지만 NEIS 통과)", () => {
    const text = "가".repeat(300) + "A".repeat(250);
    expect(text.length).toBe(550);
    expect(countNeisBytes(text)).toBe(1150);
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
    expect(result.isOver).toBe(false);
    expect(result.isOverByte).toBe(false);
    expect(result.invalidChars).toEqual([]);
  });

  it("한글 501자 → 바이트 초과 (isOver=true)", () => {
    const result = validateNeisContent("가".repeat(501), 500);
    expect(result.isOver).toBe(true);
    expect(result.isOverByte).toBe(true);
    expect(result.isOverChar).toBe(true);
  });

  it("한글 500자 → 정확히 한도", () => {
    const result = validateNeisContent("가".repeat(500), 500);
    expect(result.isOver).toBe(false);
    expect(result.isOverByte).toBe(false);
  });

  it("영문 550자 → 글자수 초과지만 바이트 이내 (NEIS 통과)", () => {
    const result = validateNeisContent("A".repeat(550), 500);
    expect(result.chars).toBe(550);
    expect(result.bytes).toBe(550);
    expect(result.isOverChar).toBe(true);  // 글자수로는 초과
    expect(result.isOverByte).toBe(false); // 바이트로는 OK
    expect(result.isOver).toBe(false);     // NEIS 기준 = 바이트 기준 → OK
  });

  it("이모지 포함 시 invalidChars 반환", () => {
    const result = validateNeisContent("가😀나", 500);
    expect(result.invalidChars).toHaveLength(1);
  });

  it("행특 300자 제한 (2026~)", () => {
    const result = validateNeisContent("가".repeat(300), 300);
    expect(result.isOver).toBe(false);
    expect(result.charLimit).toBe(300);
    expect(result.byteLimit).toBe(900);
  });

  it("줄바꿈 포함 바이트 계산", () => {
    // 한글 499자 + 줄바꿈 1회 = 499×3 + 2 = 1499B → OK
    const result = validateNeisContent("가".repeat(499) + "\n", 500);
    expect(result.bytes).toBe(1499);
    expect(result.isOver).toBe(false);
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
