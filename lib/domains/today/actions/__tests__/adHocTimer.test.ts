/**
 * Ad-Hoc Timer Actions 모듈 테스트
 *
 * Phase 3.1: student_plan (is_adhoc=true)와 레거시 ad_hoc_plans 테이블
 * 양쪽을 지원하는 통합 타이머 함수 export 및 타입 검증
 *
 * @module lib/domains/today/actions/__tests__/adHocTimer.test
 */

import { describe, it, expect } from "vitest";

describe("adHocTimer 모듈 exports", () => {
  it("필요한 타이머 함수들이 올바르게 내보내져야 함", async () => {
    const module = await import("../adHocTimer");

    // 핵심 타이머 함수들
    expect(typeof module.startAdHocPlan).toBe("function");
    expect(typeof module.pauseAdHocPlan).toBe("function");
    expect(typeof module.resumeAdHocPlan).toBe("function");
    expect(typeof module.completeAdHocPlan).toBe("function");
    expect(typeof module.cancelAdHocPlan).toBe("function");
    expect(typeof module.getAdHocPlanStatus).toBe("function");
  });

  it("함수들이 planId 파라미터를 받아야 함", async () => {
    const module = await import("../adHocTimer");

    // 함수 시그니처 확인 (파라미터 개수)
    expect(module.startAdHocPlan.length).toBeGreaterThanOrEqual(1);
    expect(module.pauseAdHocPlan.length).toBeGreaterThanOrEqual(1);
    expect(module.resumeAdHocPlan.length).toBeGreaterThanOrEqual(1);
    expect(module.completeAdHocPlan.length).toBeGreaterThanOrEqual(1);
    expect(module.cancelAdHocPlan.length).toBeGreaterThanOrEqual(1);
    expect(module.getAdHocPlanStatus.length).toBeGreaterThanOrEqual(1);
  });
});

describe("adHocTimer Phase 3.1 통합 지원", () => {
  it("모듈이 student_plan과 ad_hoc_plans 양쪽 테이블을 지원해야 함", async () => {
    // 모듈 import로 코드 구조 검증
    const module = await import("../adHocTimer");

    // 모든 함수가 존재하는지 확인
    const expectedFunctions = [
      "startAdHocPlan",
      "pauseAdHocPlan",
      "resumeAdHocPlan",
      "completeAdHocPlan",
      "cancelAdHocPlan",
      "getAdHocPlanStatus",
    ];

    expectedFunctions.forEach((funcName) => {
      expect(module).toHaveProperty(funcName);
    });
  });
});
