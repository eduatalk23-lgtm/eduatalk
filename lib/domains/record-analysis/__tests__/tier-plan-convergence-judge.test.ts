// ============================================
// llm/prompts/tierPlanConvergenceJudge.ts — 프롬프트 빌더 + verdict 매핑 테스트.
// LLM 호출 없음 (순수 함수만).
//
// LLM 호출이 포함된 judgeTierPlanConvergence 액션 자체의 통합 테스트는
// 측정 스크립트(scripts/test-s7-model-ab.ts)에서 실측으로 대체.
// ============================================

import { describe, it, expect } from "vitest";
import {
  TIER_PLAN_JUDGE_SYSTEM_PROMPT,
  TIER_PLAN_VERDICTS,
  TIER_PLAN_DELTA_CATEGORIES,
  buildTierPlanJudgeUserPrompt,
  isConvergedVerdict,
  tierPlanJudgeResponseSchema,
  type TierPlanJudgeInput,
} from "../llm/prompts/tierPlanConvergenceJudge";

const BASE_INPUT: TierPlanJudgeInput = {
  targetMajor: "데이터사이언스/통계",
  targetMajor2: null,
  currentGrade: 2,
  currentThemeLabel: "수리·통계와 컴퓨터 과학의 융합 탐구",
  proposedThemeLabel: "수리·통계와 컴퓨터 과학의 융합 탐구",
  currentTierPlan: {
    foundational: {
      theme: "기초 통계 및 프로그래밍 개념 학습",
      key_questions: ["통계의 기본 개념은 무엇인가?", "프로그래밍 언어 기초는?"],
      suggested_activities: [
        "기본 통계 개념을 정리한 노트를 작성하기",
        "Python 또는 R을 이용한 간단한 프로그래밍 실습하기",
        "기초 통계 관련 도서를 읽고 요약하기",
      ],
    },
    development: {
      theme: "실제 데이터 분석 프로젝트 수행",
      key_questions: ["어떤 데이터 세트를 선택할 것인가?", "어떤 통계 기법을 사용할 것인가?"],
      suggested_activities: [
        "공공 데이터 포털에서 데이터 세트 다운로드 후 분석하기",
        "선택한 데이터에 대한 통계적 분석 보고서 작성하기",
        "분석 결과를 시각화하여 발표 자료 만들기",
      ],
    },
    advanced: {
      theme: "데이터 윤리 및 알고리즘의 사회적 영향 탐구",
      key_questions: ["데이터 분석에서 윤리는 왜 중요한가?", "알고리즘 편향성 해결 방안?"],
      suggested_activities: [
        "데이터 윤리에 관한 논문 읽고 비평하기",
        "알고리즘의 사회적 영향에 대한 토론 참여하기",
        "자신의 데이터 분석 결과에 대한 윤리적 검토 보고서 작성하기",
      ],
    },
  },
  proposedTierPlan: {
    foundational: {
      theme: "기초 통계 및 프로그래밍 개념 학습",
      key_questions: ["통계의 기본 개념은 무엇인가?", "프로그래밍 언어 기초는?"],
      suggested_activities: [
        "기본 통계 개념을 정리한 노트를 작성하기",
        "Python 또는 R을 이용한 간단한 프로그래밍 실습하기",
        "기초 통계 관련 도서를 읽고 요약하기",
      ],
    },
    development: {
      theme: "실제 데이터 분석 프로젝트 수행",
      key_questions: ["어떤 데이터 세트를 선택할 것인가?", "어떤 통계 기법을 사용할 것인가?"],
      suggested_activities: [
        "공공 데이터 포털에서 데이터 세트 다운로드 후 분석하기",
        "선택한 데이터에 대한 통계적 분석 보고서 작성하기",
        "분석 결과를 시각화하여 발표 자료 만들기",
      ],
    },
    advanced: {
      theme: "데이터 윤리 및 알고리즘의 사회적 영향 탐구",
      key_questions: ["데이터 분석에서 윤리는 왜 중요한가?", "알고리즘 편향성 해결 방안?"],
      suggested_activities: [
        "데이터 윤리에 관한 논문 읽고 비평하기",
        "알고리즘의 사회적 영향에 대한 토론 참여하기",
        "자신의 데이터 분석 결과에 대한 윤리적 검토 보고서 작성하기",
      ],
    },
  },
};

describe("tierPlanConvergenceJudge — 상수", () => {
  it("verdict 3-class 가 정확히 정의되어 있다", () => {
    expect(TIER_PLAN_VERDICTS).toEqual([
      "semantically_equivalent",
      "minor_refinement",
      "substantial_change",
    ]);
  });

  it("delta categories 5 종이 정의되어 있다", () => {
    expect(TIER_PLAN_DELTA_CATEGORIES).toEqual([
      "rephrasing_only",
      "specificity_added",
      "new_keyword",
      "scope_expansion",
      "tier_realignment",
    ]);
  });

  it("시스템 프롬프트가 컨설팅 가치 동등성 핵심 질문을 포함한다", () => {
    expect(TIER_PLAN_JUDGE_SYSTEM_PROMPT).toContain("컨설팅 가치 동등성");
    expect(TIER_PLAN_JUDGE_SYSTEM_PROMPT).toContain("진정한 보강");
    expect(TIER_PLAN_JUDGE_SYSTEM_PROMPT).toContain("동어반복");
  });
});

describe("isConvergedVerdict — verdict → boolean 매핑", () => {
  it("semantically_equivalent → converged", () => {
    expect(isConvergedVerdict("semantically_equivalent")).toBe(true);
  });

  it("minor_refinement → converged", () => {
    expect(isConvergedVerdict("minor_refinement")).toBe(true);
  });

  it("substantial_change → refined (NOT converged)", () => {
    expect(isConvergedVerdict("substantial_change")).toBe(false);
  });
});

describe("buildTierPlanJudgeUserPrompt", () => {
  it("학생 진로 + 두 plan 을 모두 포함한다", () => {
    const prompt = buildTierPlanJudgeUserPrompt(BASE_INPUT);
    expect(prompt).toContain("데이터사이언스/통계");
    expect(prompt).toContain("2학년");
    expect(prompt).toContain("## 현 plan (A)");
    expect(prompt).toContain("## 제안 plan (B)");
    expect(prompt).toContain("foundational");
    expect(prompt).toContain("development");
    expect(prompt).toContain("advanced");
  });

  it("targetMajor2 가 null 이면 복수 전공 라인을 포함하지 않는다", () => {
    const prompt = buildTierPlanJudgeUserPrompt(BASE_INPUT);
    expect(prompt).not.toContain("복수 전공 계열:");
  });

  it("targetMajor2 가 있으면 복수 전공 라인을 포함한다", () => {
    const prompt = buildTierPlanJudgeUserPrompt({
      ...BASE_INPUT,
      targetMajor2: "수학교육",
    });
    expect(prompt).toContain("복수 전공 계열: 수학교육");
  });

  it("판정 지시가 마지막에 포함된다", () => {
    const prompt = buildTierPlanJudgeUserPrompt(BASE_INPUT);
    expect(prompt).toMatch(/같은 컨설팅 방향을 가리키는지 판정/);
    expect(prompt).toMatch(/JSON 으로 출력/);
  });
});

describe("tierPlanJudgeResponseSchema", () => {
  it("정상 응답 파싱", () => {
    const parsed = tierPlanJudgeResponseSchema.parse({
      verdict: "minor_refinement",
      reasoning: "활동 항목이 동일하고 표현만 일부 변경됨",
      deltaCategories: ["rephrasing_only", "specificity_added"],
    });
    expect(parsed.verdict).toBe("minor_refinement");
    expect(parsed.deltaCategories).toHaveLength(2);
  });

  it("deltaCategories 가 비어있어도 허용", () => {
    const parsed = tierPlanJudgeResponseSchema.parse({
      verdict: "semantically_equivalent",
      reasoning: "완전히 동일",
      deltaCategories: [],
    });
    expect(parsed.deltaCategories).toEqual([]);
  });

  it("invalid verdict 거부", () => {
    expect(() =>
      tierPlanJudgeResponseSchema.parse({
        verdict: "totally_different",
        reasoning: "x",
        deltaCategories: [],
      }),
    ).toThrow();
  });

  it("invalid deltaCategory 거부", () => {
    expect(() =>
      tierPlanJudgeResponseSchema.parse({
        verdict: "minor_refinement",
        reasoning: "x",
        deltaCategories: ["unknown_category"],
      }),
    ).toThrow();
  });
});
