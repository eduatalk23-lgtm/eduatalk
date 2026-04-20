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

  // α3-4 (2026-04-20): blueprintGap 섹션
  it("blueprintGap 주입 시 GAP 섹션 렌더 + priority 힌트 추가", () => {
    const prompt = buildTierPlanRefinementUserPrompt({
      ...BASE_INPUT,
      blueprintGap: {
        computedAt: "2026-04-20T00:00:00Z",
        version: "v1_rule",
        remainingSemesters: 4,
        areaGaps: {
          academic: { area: "academic", currentScore: 75, targetScore: 95, gapSize: 20, mainCause: "탐구력 부족 (2등급)" },
          career: { area: "career", currentScore: null, targetScore: null, gapSize: null, mainCause: null },
          community: { area: "community", currentScore: 80, targetScore: 85, gapSize: 5, mainCause: null },
        },
        axisGaps: [
          {
            code: "academic_inquiry",
            area: "academic",
            currentGrade: "B+",
            targetGrade: "A+",
            gapSize: 2,
            pattern: "insufficient",
            rationale: "탐구력 B+ → 목표 A+ (차 2등급)",
          },
          {
            code: "community_leadership",
            area: "community",
            currentGrade: null,
            targetGrade: "A-",
            gapSize: 5,
            pattern: "latent",
            rationale: "리더십 미측정. 잔여 4학기 내 활성화 가능",
          },
        ],
        priority: "high",
        summary: "학업역량 갭 20점. 주원인 = 탐구력 부족 (2등급)",
      },
    });

    expect(prompt).toContain("청사진 GAP (우선 개정 대상)");
    expect(prompt).toContain("priority: HIGH");
    expect(prompt).toContain("remainingSemesters: 4");
    expect(prompt).toContain("summary: 학업역량 갭 20점");
    expect(prompt).toContain("areaGaps");
    expect(prompt).toContain("학업: gap +20");
    expect(prompt).toContain("공동체: gap +5");
    // career 는 gapSize null 이라 라인 생략
    expect(prompt).not.toContain("진로: gap");
    expect(prompt).toContain("[부족] academic_inquiry");
    expect(prompt).toContain("[잠재] community_leadership");
    // priority high 이면 우선 개정 힌트가 마지막에 추가됨
    expect(prompt).toContain("청사진 GAP priority=high");
  });

  it("blueprintGap null 이면 GAP 섹션 없음 + priority 힌트 없음", () => {
    const prompt = buildTierPlanRefinementUserPrompt({ ...BASE_INPUT, blueprintGap: null });
    expect(prompt).not.toContain("청사진 GAP");
  });

  it("blueprintGap priority=low 면 섹션은 렌더하지만 우선 개정 힌트는 생략", () => {
    const prompt = buildTierPlanRefinementUserPrompt({
      ...BASE_INPUT,
      blueprintGap: {
        computedAt: "2026-04-20T00:00:00Z",
        version: "v1_rule",
        remainingSemesters: 6,
        areaGaps: {
          academic: { area: "academic", currentScore: 85, targetScore: 85, gapSize: 0, mainCause: null },
          career: { area: "career", currentScore: null, targetScore: null, gapSize: null, mainCause: null },
          community: { area: "community", currentScore: null, targetScore: null, gapSize: null, mainCause: null },
        },
        axisGaps: [],
        priority: "low",
        summary: "전 영역 청사진 목표 충족 (gap ≤ 0)",
      },
    });
    expect(prompt).toContain("청사진 GAP (우선 개정 대상)");
    expect(prompt).toContain("priority: LOW");
    expect(prompt).not.toContain("청사진 GAP priority=");
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
