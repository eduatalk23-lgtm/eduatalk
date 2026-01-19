/**
 * generatePlansFromGroup 통합 테스트
 *
 * Phase 4: 기존 플랜 충돌 검증 및 자동 조정 기능을 테스트합니다.
 *
 * @module __tests__/lib/plan/generatePlansFromGroup.integration.test
 */

import { describe, it, expect } from "vitest";
import {
  validateNoTimeOverlaps,
  validateNoInternalOverlaps,
  adjustOverlappingTimes,
} from "@/lib/scheduler/utils/timeOverlapValidator";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";
import type {
  GeneratePlansResult,
  OverlapValidationResult,
} from "@/lib/scheduler/types";

// 테스트용 ScheduledPlan 생성 헬퍼
function createScheduledPlan(
  overrides: Partial<ScheduledPlan> & { plan_date: string; content_id: string }
): ScheduledPlan {
  return {
    plan_date: overrides.plan_date,
    block_index: 0,
    content_type: "book",
    content_id: overrides.content_id,
    planned_start_page_or_time: 1,
    planned_end_page_or_time: 10,
    is_reschedulable: true,
    start_time: overrides.start_time,
    end_time: overrides.end_time,
    ...overrides,
  };
}

// 테스트용 ExistingPlanInfo 생성 헬퍼
function createExistingPlan(
  date: string,
  start_time: string,
  end_time: string
): ExistingPlanInfo {
  return { date, start_time, end_time };
}

// GeneratePlansResult 시뮬레이션 헬퍼
function simulateGeneratePlansResult(
  plans: ScheduledPlan[],
  existingPlans: ExistingPlanInfo[],
  options?: { autoAdjustOverlaps?: boolean; maxEndTime?: string }
): GeneratePlansResult {
  let resultPlans = plans;
  let overlapValidation: OverlapValidationResult | undefined;
  let wasAutoAdjusted = false;
  let autoAdjustedCount = 0;
  let unadjustablePlans: Array<{ plan: ScheduledPlan; reason: string }> | undefined;

  if (existingPlans.length > 0) {
    overlapValidation = validateNoTimeOverlaps(resultPlans, existingPlans);

    if (overlapValidation.hasOverlaps && options?.autoAdjustOverlaps) {
      const adjustmentResult = adjustOverlappingTimes(
        resultPlans,
        existingPlans,
        options.maxEndTime || "23:59"
      );

      resultPlans = adjustmentResult.adjustedPlans;
      wasAutoAdjusted = adjustmentResult.adjustedCount > 0;
      autoAdjustedCount = adjustmentResult.adjustedCount;
      unadjustablePlans =
        adjustmentResult.unadjustablePlans.length > 0
          ? adjustmentResult.unadjustablePlans
          : undefined;

      // 조정 후 재검증
      overlapValidation = validateNoTimeOverlaps(resultPlans, existingPlans);
    }
  }

  return {
    plans: resultPlans,
    overlapValidation,
    wasAutoAdjusted: wasAutoAdjusted || undefined,
    autoAdjustedCount: autoAdjustedCount > 0 ? autoAdjustedCount : undefined,
    unadjustablePlans,
  };
}

describe("generatePlansFromGroup 통합 테스트", () => {
  describe("기존 플랜 충돌 검증 (Phase 4)", () => {
    it("기존 플랜이 없으면 overlapValidation이 undefined", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const result = simulateGeneratePlansResult(plans, []);

      expect(result.overlapValidation).toBeUndefined();
      expect(result.wasAutoAdjusted).toBeUndefined();
    });

    it("기존 플랜과 충돌이 없으면 hasOverlaps가 false", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "14:00", "15:00"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans);

      expect(result.overlapValidation?.hasOverlaps).toBe(false);
      expect(result.overlapValidation?.overlaps).toHaveLength(0);
    });

    it("기존 플랜과 충돌 시 overlaps에 상세 정보 포함", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:30", "10:30"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans);

      expect(result.overlapValidation?.hasOverlaps).toBe(true);
      expect(result.overlapValidation?.overlaps).toHaveLength(1);
      expect(result.overlapValidation?.overlaps[0].overlapMinutes).toBe(30);
    });
  });

  describe("자동 조정 기능 (autoAdjustOverlaps)", () => {
    it("autoAdjustOverlaps가 false면 충돌해도 조정하지 않음", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:30", "10:30"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: false,
      });

      expect(result.overlapValidation?.hasOverlaps).toBe(true);
      expect(result.wasAutoAdjusted).toBeUndefined();
      expect(result.plans[0].start_time).toBe("09:00"); // 원본 유지
    });

    it("autoAdjustOverlaps가 true면 충돌 시 자동 조정", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:30", "10:30"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: true,
      });

      expect(result.wasAutoAdjusted).toBe(true);
      expect(result.autoAdjustedCount).toBe(1);
      expect(result.plans[0].start_time).toBe("10:30"); // 기존 플랜 종료 후로 이동
      expect(result.plans[0].end_time).toBe("11:30");
    });

    it("조정 후에는 충돌이 해소됨", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:00", "09:30"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: true,
      });

      expect(result.overlapValidation?.hasOverlaps).toBe(false);
    });

    it("여러 플랜이 연속 충돌 시 순차적으로 조정", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-2",
          start_time: "09:30",
          end_time: "10:30",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:00", "11:00"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: true,
      });

      expect(result.autoAdjustedCount).toBe(2);
      expect(result.plans[0].start_time).toBe("11:00");
      expect(result.plans[1].start_time).toBe("11:00");
    });
  });

  describe("maxEndTime 제한", () => {
    it("조정 후 maxEndTime 초과 시 unadjustablePlans에 포함", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "22:00",
          end_time: "23:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "22:30", "23:30"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: true,
        maxEndTime: "23:30",
      });

      expect(result.unadjustablePlans).toHaveLength(1);
      expect(result.unadjustablePlans![0].reason).toContain("최대 허용 시간");
    });

    it("기본 maxEndTime은 23:59", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "22:00",
          end_time: "23:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "22:00", "22:30"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: true,
      });

      // 22:30 -> 23:30은 23:59 이내이므로 조정 가능
      expect(result.wasAutoAdjusted).toBe(true);
      expect(result.unadjustablePlans).toBeUndefined();
    });
  });

  describe("복합 시나리오", () => {
    it("여러 날짜에 걸친 플랜과 기존 플랜 혼합", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
        createScheduledPlan({
          plan_date: "2024-01-16",
          content_id: "content-2",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:30", "10:30"), // 첫째 날만 충돌
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: true,
      });

      expect(result.autoAdjustedCount).toBe(1); // 첫째 날만 조정
      expect(result.plans[0].start_time).toBe("10:30");
      expect(result.plans[1].start_time).toBe("09:00"); // 둘째 날은 원본 유지
    });

    it("시간 정보 없는 플랜은 충돌 검사에서 제외", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: undefined,
          end_time: undefined,
        }),
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-2",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:30", "10:30"),
      ];

      const result = simulateGeneratePlansResult(plans, existingPlans, {
        autoAdjustOverlaps: true,
      });

      expect(result.autoAdjustedCount).toBe(1); // 시간 정보 있는 플랜만 조정
      expect(result.plans[0].start_time).toBeUndefined(); // 시간 없는 플랜 유지
      expect(result.plans[1].start_time).toBe("10:30");
    });
  });

  describe("내부 플랜 간 충돌 검증", () => {
    it("새 플랜들 간의 충돌도 감지", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:30",
        }),
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-2",
          start_time: "10:00",
          end_time: "11:00",
        }),
      ];

      const internalResult = validateNoInternalOverlaps(plans);

      expect(internalResult.hasOverlaps).toBe(true);
      expect(internalResult.overlaps).toHaveLength(1);
      expect(internalResult.totalOverlapMinutes).toBe(30);
    });

    it("다른 날짜의 플랜은 내부 충돌로 감지하지 않음", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
        createScheduledPlan({
          plan_date: "2024-01-16",
          content_id: "content-2",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const internalResult = validateNoInternalOverlaps(plans);

      expect(internalResult.hasOverlaps).toBe(false);
    });
  });
});
