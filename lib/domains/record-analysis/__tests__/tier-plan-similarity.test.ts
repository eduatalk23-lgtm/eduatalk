// ============================================
// blueprint/tier-plan-similarity.ts — 순수 함수 유닛 테스트
// Phase 4b 수렴 가드 (jaccard 임계치 0.8 default).
// ============================================

import { describe, it, expect } from "vitest";
import {
  compareTierPlans,
  DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD,
} from "../blueprint/tier-plan-similarity";
import type { MainExplorationTierPlan } from "@/lib/domains/student-record/repository/main-exploration-repository";

const PLAN_A: MainExplorationTierPlan = {
  foundational: {
    theme: "기초 분자생물학",
    key_questions: ["DNA 구조의 의미는?", "단백질 합성 경로는?"],
    suggested_activities: ["분자생물학 입문 도서 정독"],
  },
  development: {
    theme: "유전 발현 조절",
    key_questions: ["전사 인자의 역할은?"],
    suggested_activities: ["전사 과정 시뮬레이션"],
  },
  advanced: {
    theme: "후성 유전체 연구",
    key_questions: ["메틸화의 후세대 영향은?"],
    suggested_activities: ["논문 리뷰 + 발표"],
  },
};

describe("compareTierPlans", () => {
  it("동일한 plan 은 overall=1, converged=true", () => {
    const result = compareTierPlans(PLAN_A, PLAN_A);
    expect(result.overall).toBe(1);
    expect(result.byTier.foundational).toBe(1);
    expect(result.byTier.development).toBe(1);
    expect(result.byTier.advanced).toBe(1);
    expect(result.converged).toBe(true);
  });

  it("거의 다른 토큰의 plan 은 overall < 0.2, converged=false", () => {
    // 완벽한 0 은 한국어 자연어에서 거의 불가능 (조사·어미 우연 일치).
    // 의미적으로 겹치지 않으면 0.2 미만으로 떨어지는지를 본다.
    const mostlyDifferent: MainExplorationTierPlan = {
      foundational: {
        theme: "AB",
        key_questions: ["CD?"],
        suggested_activities: ["EF GH"],
      },
      development: {
        theme: "IJ",
        key_questions: ["KL?"],
        suggested_activities: ["MN OP"],
      },
      advanced: {
        theme: "QR",
        key_questions: ["ST?"],
        suggested_activities: ["UV WX"],
      },
    };
    const result = compareTierPlans(PLAN_A, mostlyDifferent);
    expect(result.overall).toBeLessThan(0.05);
    expect(result.converged).toBe(false);
  });

  it("한 쪽이 null 이면 converged=false, overall=0", () => {
    expect(compareTierPlans(null, PLAN_A).converged).toBe(false);
    expect(compareTierPlans(PLAN_A, null).overall).toBe(0);
    expect(compareTierPlans(undefined, undefined).converged).toBe(false);
  });

  it("부분 일치는 0~1 사이", () => {
    const partial: MainExplorationTierPlan = {
      ...PLAN_A,
      advanced: {
        theme: "법학 입문",
        key_questions: ["법치주의?"],
        suggested_activities: ["헌법 정독"],
      },
    };
    const result = compareTierPlans(PLAN_A, partial);
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThan(1);
    expect(result.byTier.foundational).toBe(1);
    expect(result.byTier.development).toBe(1);
    expect(result.byTier.advanced).toBeLessThan(0.5);
  });

  it("threshold 옵션 적용", () => {
    const partial: MainExplorationTierPlan = {
      foundational: { theme: "기초 분자생물학", key_questions: [], suggested_activities: [] },
      development: { theme: "전혀 다른 주제", key_questions: [], suggested_activities: [] },
      advanced: { theme: "또 다른 주제", key_questions: [], suggested_activities: [] },
    };
    const strict = compareTierPlans(PLAN_A, partial, { threshold: 0.95 });
    const lenient = compareTierPlans(PLAN_A, partial, { threshold: 0.05 });
    expect(strict.converged).toBe(false);
    expect(lenient.converged).toBe(true);
  });

  it("DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD === 0.8", () => {
    expect(DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD).toBe(0.8);
  });

  it("빈 tier 양쪽 모두 비어있으면 1 (수렴 취급)", () => {
    const empty: MainExplorationTierPlan = {
      foundational: { theme: "", key_questions: [], suggested_activities: [] },
      development: { theme: "", key_questions: [], suggested_activities: [] },
      advanced: { theme: "", key_questions: [], suggested_activities: [] },
    };
    const result = compareTierPlans(empty, empty);
    expect(result.overall).toBe(1);
    expect(result.converged).toBe(true);
  });
});
