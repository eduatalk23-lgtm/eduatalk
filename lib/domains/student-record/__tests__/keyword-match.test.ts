import { describe, it, expect } from "vitest";
import {
  matchKeywordInText,
  calculateReflectionRate,
  calculateReflectionSummary,
} from "../keyword-match";

// ============================================
// 1. matchKeywordInText
// ============================================

describe("matchKeywordInText", () => {
  it("정확한 키워드 매칭", () => {
    expect(matchKeywordInText("미적분", "수업에서 미적분의 극한을 탐구함")).toBe(true);
  });

  it("부분 문자열 매칭", () => {
    expect(matchKeywordInText("의료영상", "CT 의료영상 처리 알고리즘")).toBe(true);
  });

  it("정규화 후 매칭 (특수문자 제거)", () => {
    expect(matchKeywordInText("연립방정식", "연립방정식의 풀이를 탐구함")).toBe(true);
  });

  it("2글자 미만 키워드는 무시", () => {
    expect(matchKeywordInText("수", "수학을 공부함")).toBe(false);
    expect(matchKeywordInText("A", "A등급을 받음")).toBe(false);
  });

  it("복합 키워드 분리 매칭 (개별 단어 중 하나라도)", () => {
    expect(matchKeywordInText("의료공학 모델링", "의료공학에 관심을 가짐")).toBe(true);
    expect(matchKeywordInText("인공지능 알고리즘", "딥러닝 알고리즘을 학습함")).toBe(true);
  });

  it("매칭 안 되는 경우", () => {
    expect(matchKeywordInText("양자역학", "미적분을 공부함")).toBe(false);
  });

  it("빈 텍스트", () => {
    expect(matchKeywordInText("미적분", "")).toBe(false);
  });

  it("대소문자 무관", () => {
    expect(matchKeywordInText("DNA", "dna 분석을 수행함")).toBe(true);
  });
});

// ============================================
// 2. calculateReflectionRate
// ============================================

describe("calculateReflectionRate", () => {
  it("전체 키워드 매칭 → 100%", () => {
    const result = calculateReflectionRate(
      "수학",
      ["미적분", "극한", "연속성"],
      "미적분의 극한과 연속성을 탐구하였다",
    );
    expect(result.rate).toBe(100);
    expect(result.matchedKeywords).toBe(3);
    expect(result.totalKeywords).toBe(3);
    expect(result.details.every((d) => d.matched)).toBe(true);
  });

  it("부분 매칭 → 비율 계산", () => {
    const result = calculateReflectionRate(
      "물리",
      ["역학", "에너지", "파동", "전자기"],
      "역학과 에너지 보존 법칙을 탐구함",
    );
    expect(result.rate).toBe(50); // 2/4
    expect(result.matchedKeywords).toBe(2);
  });

  it("키워드 없으면 rate 0, details 빈 배열", () => {
    const result = calculateReflectionRate("과목", [], "아무 텍스트");
    expect(result.rate).toBe(0);
    expect(result.totalKeywords).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it("세특 텍스트 비어있으면 전체 미매칭", () => {
    const result = calculateReflectionRate(
      "수학",
      ["미적분", "극한"],
      "",
    );
    expect(result.rate).toBe(0);
    expect(result.matchedKeywords).toBe(0);
    expect(result.details.every((d) => !d.matched)).toBe(true);
  });

  it("subjectName 정확히 반환", () => {
    const result = calculateReflectionRate("화학", ["산화", "환원"], "산화 환원 반응");
    expect(result.subjectName).toBe("화학");
  });
});

// ============================================
// 3. calculateReflectionSummary
// ============================================

describe("calculateReflectionSummary", () => {
  it("여러 과목 요약 계산", () => {
    const guideItems = [
      { subjectName: "수학", keywords: ["미적분", "극한"] },
      { subjectName: "과학", keywords: ["역학", "에너지", "파동"] },
    ];
    const textMap = new Map([
      ["수학", "미적분의 극한을 탐구"],
      ["과학", "역학 실험을 수행"],
    ]);
    const summary = calculateReflectionSummary(guideItems, textMap);

    expect(summary.subjects).toHaveLength(2);
    expect(summary.totalKeywords).toBe(5);
    expect(summary.totalMatched).toBe(3); // 미적분+극한+역학
    expect(summary.averageRate).toBe(60); // 3/5 = 60%
  });

  it("빈 가이드 → 전체 0", () => {
    const summary = calculateReflectionSummary([], new Map());
    expect(summary.subjects).toHaveLength(0);
    expect(summary.averageRate).toBe(0);
  });

  it("세특 텍스트 없는 과목은 0%", () => {
    const guideItems = [
      { subjectName: "영어", keywords: ["문법", "독해"] },
    ];
    const summary = calculateReflectionSummary(guideItems, new Map());
    expect(summary.subjects[0].rate).toBe(0);
    expect(summary.averageRate).toBe(0);
  });
});
