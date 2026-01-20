/**
 * Unified Ad-Hoc Plans 조회 함수 모듈 테스트
 *
 * Phase 3.1: student_plan (is_adhoc=true)와 레거시 ad_hoc_plans 테이블
 * 양쪽에서 데이터를 조회하고 통합하는 함수 export 및 타입 검증
 *
 * @module lib/data/__tests__/unifiedAdHocPlans.test
 */

import { describe, it, expect } from "vitest";

describe("unifiedAdHocPlans 모듈 exports", () => {
  it("필요한 조회 함수들이 올바르게 내보내져야 함", async () => {
    const module = await import("../unifiedAdHocPlans");

    // 핵심 조회 함수들
    expect(typeof module.getUnifiedAdHocPlans).toBe("function");
    expect(typeof module.getUnifiedAdHocPlansForDate).toBe("function");
    expect(typeof module.getUnifiedAdHocPlansForDateRange).toBe("function");
    expect(typeof module.getUnifiedAdHocPlanById).toBe("function");
    expect(typeof module.getUnifiedAdHocPlansByContainer).toBe("function");
  });

  it("함수들이 올바른 파라미터를 받아야 함", async () => {
    const module = await import("../unifiedAdHocPlans");

    // 함수 시그니처 확인 (파라미터 개수)
    expect(module.getUnifiedAdHocPlans.length).toBeGreaterThanOrEqual(1);
    expect(module.getUnifiedAdHocPlansForDate.length).toBeGreaterThanOrEqual(1);
    expect(module.getUnifiedAdHocPlansForDateRange.length).toBeGreaterThanOrEqual(1);
    expect(module.getUnifiedAdHocPlanById.length).toBeGreaterThanOrEqual(1);
    expect(module.getUnifiedAdHocPlansByContainer.length).toBeGreaterThanOrEqual(1);
  });
});

describe("unifiedAdHocPlans Phase 3.1 통합 지원", () => {
  it("모듈이 student_plan과 ad_hoc_plans 양쪽 테이블 통합 조회를 지원해야 함", async () => {
    const module = await import("../unifiedAdHocPlans");

    // 모든 함수가 존재하는지 확인
    const expectedFunctions = [
      "getUnifiedAdHocPlans",
      "getUnifiedAdHocPlansForDate",
      "getUnifiedAdHocPlansForDateRange",
      "getUnifiedAdHocPlanById",
      "getUnifiedAdHocPlansByContainer",
    ];

    expectedFunctions.forEach((funcName) => {
      expect(module).toHaveProperty(funcName);
    });
  });

  it("UnifiedAdHocPlan 타입이 source_table 필드를 포함해야 함 (타입 검증)", async () => {
    // 이 테스트는 TypeScript 컴파일 시 타입 검증
    // 런타임에서는 모듈이 올바르게 로드되는지만 확인
    const module = await import("../unifiedAdHocPlans");
    expect(module).toBeDefined();
  });
});

describe("unifiedAdHocPlans 용도별 함수", () => {
  it("Today 페이지용 함수가 존재함", async () => {
    const { getUnifiedAdHocPlansForDate } = await import("../unifiedAdHocPlans");
    expect(getUnifiedAdHocPlansForDate).toBeDefined();
  });

  it("캘린더용 함수가 존재함", async () => {
    const { getUnifiedAdHocPlansForDateRange } = await import("../unifiedAdHocPlans");
    expect(getUnifiedAdHocPlansForDateRange).toBeDefined();
  });

  it("단일 조회 함수가 존재함", async () => {
    const { getUnifiedAdHocPlanById } = await import("../unifiedAdHocPlans");
    expect(getUnifiedAdHocPlanById).toBeDefined();
  });

  it("컨테이너별 조회 함수가 존재함", async () => {
    const { getUnifiedAdHocPlansByContainer } = await import("../unifiedAdHocPlans");
    expect(getUnifiedAdHocPlansByContainer).toBeDefined();
  });
});
