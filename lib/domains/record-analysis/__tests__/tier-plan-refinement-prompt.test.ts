// ============================================
// llm/prompts/tierPlanRefinement.ts — prompt builder + parser 테스트
// LLM 호출 없음 (순수 함수만).
// ============================================

import { describe, it, expect } from "vitest";
import {
  buildTierPlanRefinementUserPrompt,
  parseTierPlanRefinementResponse,
  type TierPlanRefinementInput,
} from "../llm/prompts/tierPlanRefinement";

const BASE_INPUT: TierPlanRefinementInput = {
  currentThemeLabel: "수학·통계 기반 사회현상 분석",
  currentThemeKeywords: ["통계", "데이터 윤리", "확률"],
  currentTierPlan: {
    foundational: {
      theme: "기초 통계학",
      key_questions: ["평균과 중앙값의 차이?", "분산이란?"],
      suggested_activities: ["통계학 입문 도서 정독", "엑셀 통계 함수 연습", "기초 데이터셋 탐색"],
    },
    development: {
      theme: "추론 통계 적용",
      key_questions: ["가설 검정의 한계?", "p-value 의 오용?"],
      suggested_activities: ["사회 데이터 회귀 분석", "여론조사 표본 검증", "데이터 시각화 발표"],
    },
    advanced: {
      theme: "데이터 윤리·정책",
      key_questions: ["알고리즘 편향의 책임은?", "데이터 주권?"],
      suggested_activities: ["윤리 케이스 토론", "정책 제안서 작성", "관련 논문 비평"],
    },
  },
  targetMajor: "통계학",
  targetMajor2: null,
  tier1Code: "NAT",
  currentGrade: 2,
  strategyHighlights: ["가설 검정 실습 강화", "윤리 토론 참여 확대"],
  roadmapHighlights: ["2학기: 회귀 분석 발표", "3학기: 윤리 정책 제안서"],
  qualityPatterns: ["깊이 부족 — 결론 단계 약함"],
  diagnosisWeaknesses: ["scientificValidity 평균 미달"],
};

describe("buildTierPlanRefinementUserPrompt", () => {
  it("학생 진로 정보 + 현 plan + Synthesis 섹션 모두 포함", () => {
    const prompt = buildTierPlanRefinementUserPrompt(BASE_INPUT);
    expect(prompt).toContain("학생 진로 정보");
    expect(prompt).toContain("통계학");
    expect(prompt).toContain("현 메인 탐구 (개정 대상)");
    expect(prompt).toContain("기초 통계학");
    expect(prompt).toContain("Synthesis 전략 요약");
    expect(prompt).toContain("Synthesis 로드맵 요약");
    expect(prompt).toContain("반복 품질 패턴");
    expect(prompt).toContain("진단 약점");
  });

  it("빈 highlights 섹션은 출력 생략", () => {
    const minimal: TierPlanRefinementInput = {
      ...BASE_INPUT,
      strategyHighlights: [],
      roadmapHighlights: [],
      qualityPatterns: [],
      diagnosisWeaknesses: [],
    };
    const prompt = buildTierPlanRefinementUserPrompt(minimal);
    expect(prompt).not.toContain("Synthesis 전략 요약");
    expect(prompt).not.toContain("Synthesis 로드맵 요약");
    expect(prompt).not.toContain("반복 품질 패턴");
    expect(prompt).not.toContain("진단 약점");
  });

  it("targetMajor2 가 null 이면 복수 전공 라인 생략", () => {
    const prompt = buildTierPlanRefinementUserPrompt(BASE_INPUT);
    expect(prompt).not.toContain("복수 전공 계열");
  });
});

describe("parseTierPlanRefinementResponse", () => {
  const VALID_JSON = JSON.stringify({
    themeLabel: "수학·통계 기반 사회현상 분석과 의사결정 탐구",
    themeKeywords: ["통계적 추론", "데이터 윤리", "확률"],
    tierPlan: {
      foundational: {
        theme: "기초 통계와 확률",
        key_questions: ["평균과 중앙값의 차이?", "분산의 의미?"],
        suggested_activities: ["입문 도서 정독", "엑셀 함수 연습", "기초 데이터셋 탐색"],
      },
      development: {
        theme: "추론 통계 응용",
        key_questions: ["가설 검정의 한계?", "p-value 오용?"],
        suggested_activities: ["회귀 분석 발표", "여론조사 검증", "시각화 보고"],
      },
      advanced: {
        theme: "데이터 윤리와 정책",
        key_questions: ["알고리즘 편향의 책임?", "데이터 주권?"],
        suggested_activities: ["윤리 토론", "정책 제안서", "논문 비평"],
      },
    },
  });

  it("유효한 JSON 파싱 성공", () => {
    const result = parseTierPlanRefinementResponse(VALID_JSON);
    expect(result.themeLabel).toContain("수학·통계");
    expect(result.themeKeywords).toHaveLength(3);
    expect(result.tierPlan.foundational.suggested_activities).toHaveLength(3);
  });

  it("themeLabel 누락 시 throw", () => {
    const invalid = JSON.stringify({ themeKeywords: ["a", "b", "c"], tierPlan: {} });
    expect(() => parseTierPlanRefinementResponse(invalid)).toThrow();
  });

  it("themeKeywords 부족 시 throw", () => {
    const invalid = JSON.stringify({
      themeLabel: "x",
      themeKeywords: ["a"],
      tierPlan: {},
    });
    expect(() => parseTierPlanRefinementResponse(invalid)).toThrow();
  });

  it("suggested_activities 부족 시 throw", () => {
    const invalid = JSON.parse(VALID_JSON);
    invalid.tierPlan.foundational.suggested_activities = ["one only"];
    expect(() => parseTierPlanRefinementResponse(JSON.stringify(invalid))).toThrow();
  });
});
