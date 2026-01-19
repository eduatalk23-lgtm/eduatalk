/**
 * Time Overlap Validator 단위 테스트
 *
 * @module __tests__/lib/scheduler/utils/timeOverlapValidator.test
 */

import { describe, it, expect } from "vitest";
import {
  validateNoTimeOverlaps,
  validateNoInternalOverlaps,
  adjustOverlappingTimes,
} from "@/lib/scheduler/utils/timeOverlapValidator";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";

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

describe("timeOverlapValidator", () => {
  describe("validateNoTimeOverlaps", () => {
    it("충돌이 없으면 hasOverlaps가 false여야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "10:00", "11:00"), // 겹치지 않음
      ];

      const result = validateNoTimeOverlaps(newPlans, existingPlans);

      expect(result.hasOverlaps).toBe(false);
      expect(result.overlaps).toHaveLength(0);
      expect(result.totalOverlapMinutes).toBe(0);
    });

    it("같은 시간대에 충돌이 있으면 감지해야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:30", "10:30"), // 30분 겹침
      ];

      const result = validateNoTimeOverlaps(newPlans, existingPlans);

      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(1);
      expect(result.totalOverlapMinutes).toBe(30);
      expect(result.overlaps[0].date).toBe("2024-01-15");
      expect(result.overlaps[0].overlapMinutes).toBe(30);
    });

    it("완전히 포함되는 시간대를 감지해야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "12:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "10:00", "11:00"), // 60분 완전 포함
      ];

      const result = validateNoTimeOverlaps(newPlans, existingPlans);

      expect(result.hasOverlaps).toBe(true);
      expect(result.totalOverlapMinutes).toBe(60);
    });

    it("다른 날짜는 충돌로 감지하지 않아야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-16", "09:00", "10:00"), // 다른 날짜
      ];

      const result = validateNoTimeOverlaps(newPlans, existingPlans);

      expect(result.hasOverlaps).toBe(false);
    });

    it("시간 정보가 없는 플랜은 스킵해야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: undefined,
          end_time: undefined,
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:00", "10:00"),
      ];

      const result = validateNoTimeOverlaps(newPlans, existingPlans);

      expect(result.hasOverlaps).toBe(false);
    });

    it("여러 충돌을 모두 감지해야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-2",
          start_time: "14:00",
          end_time: "15:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:30", "09:45"), // 15분 겹침
        createExistingPlan("2024-01-15", "14:30", "15:30"), // 30분 겹침
      ];

      const result = validateNoTimeOverlaps(newPlans, existingPlans);

      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(2);
      expect(result.totalOverlapMinutes).toBe(45); // 15 + 30
    });

    it("빈 배열에 대해 충돌 없음을 반환해야 함", () => {
      const result1 = validateNoTimeOverlaps([], []);
      expect(result1.hasOverlaps).toBe(false);

      const result2 = validateNoTimeOverlaps(
        [
          createScheduledPlan({
            plan_date: "2024-01-15",
            content_id: "content-1",
            start_time: "09:00",
            end_time: "10:00",
          }),
        ],
        []
      );
      expect(result2.hasOverlaps).toBe(false);
    });

    it("정확히 맞닿는 시간은 충돌이 아님", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "10:00", "11:00"), // 끝 시간 = 시작 시간
      ];

      const result = validateNoTimeOverlaps(newPlans, existingPlans);

      expect(result.hasOverlaps).toBe(false);
    });
  });

  describe("validateNoInternalOverlaps", () => {
    it("플랜 간 충돌이 없으면 hasOverlaps가 false여야 함", () => {
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
          start_time: "10:00",
          end_time: "11:00",
        }),
      ];

      const result = validateNoInternalOverlaps(plans);

      expect(result.hasOverlaps).toBe(false);
    });

    it("같은 날짜의 플랜 간 충돌을 감지해야 함", () => {
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

      const result = validateNoInternalOverlaps(plans);

      expect(result.hasOverlaps).toBe(true);
      expect(result.overlaps).toHaveLength(1);
      expect(result.totalOverlapMinutes).toBe(30);
    });

    it("다른 날짜의 플랜은 충돌로 감지하지 않아야 함", () => {
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

      const result = validateNoInternalOverlaps(plans);

      expect(result.hasOverlaps).toBe(false);
    });

    it("시간 정보가 없는 플랜은 스킵해야 함", () => {
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
          start_time: undefined,
          end_time: undefined,
        }),
      ];

      const result = validateNoInternalOverlaps(plans);

      expect(result.hasOverlaps).toBe(false);
    });

    it("빈 배열에 대해 충돌 없음을 반환해야 함", () => {
      const result = validateNoInternalOverlaps([]);

      expect(result.hasOverlaps).toBe(false);
      expect(result.overlaps).toHaveLength(0);
    });

    it("단일 플랜에 대해 충돌 없음을 반환해야 함", () => {
      const plans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const result = validateNoInternalOverlaps(plans);

      expect(result.hasOverlaps).toBe(false);
    });
  });

  describe("adjustOverlappingTimes", () => {
    it("충돌이 없으면 플랜을 그대로 반환해야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "10:00", "11:00"),
      ];

      const result = adjustOverlappingTimes(newPlans, existingPlans);

      expect(result.adjustedCount).toBe(0);
      expect(result.unadjustablePlans).toHaveLength(0);
      expect(result.adjustedPlans[0].start_time).toBe("09:00");
      expect(result.adjustedPlans[0].end_time).toBe("10:00");
    });

    it("충돌하는 플랜을 기존 플랜 종료 시간 이후로 조정해야 함", () => {
      const newPlans: ScheduledPlan[] = [
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

      const result = adjustOverlappingTimes(newPlans, existingPlans);

      expect(result.adjustedCount).toBe(1);
      expect(result.adjustedPlans[0].start_time).toBe("10:30");
      expect(result.adjustedPlans[0].end_time).toBe("11:30");
    });

    it("여러 기존 플랜과 충돌 시 마지막 플랜 이후로 조정해야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:00", "10:00"),
        createExistingPlan("2024-01-15", "10:00", "11:00"),
      ];

      const result = adjustOverlappingTimes(newPlans, existingPlans);

      expect(result.adjustedCount).toBe(1);
      expect(result.adjustedPlans[0].start_time).toBe("11:00");
      expect(result.adjustedPlans[0].end_time).toBe("12:00");
    });

    it("최대 종료 시간 초과 시 조정 불가로 표시해야 함", () => {
      const newPlans: ScheduledPlan[] = [
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

      const result = adjustOverlappingTimes(newPlans, existingPlans, "23:59");

      expect(result.adjustedCount).toBe(0);
      expect(result.unadjustablePlans).toHaveLength(1);
      expect(result.unadjustablePlans[0].reason).toContain("최대 허용 시간");
    });

    it("시간 정보가 없는 플랜은 그대로 유지해야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: undefined,
          end_time: undefined,
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-15", "09:00", "10:00"),
      ];

      const result = adjustOverlappingTimes(newPlans, existingPlans);

      expect(result.adjustedCount).toBe(0);
      expect(result.adjustedPlans[0].start_time).toBeUndefined();
    });

    it("다른 날짜의 플랜은 조정하지 않아야 함", () => {
      const newPlans: ScheduledPlan[] = [
        createScheduledPlan({
          plan_date: "2024-01-15",
          content_id: "content-1",
          start_time: "09:00",
          end_time: "10:00",
        }),
      ];

      const existingPlans: ExistingPlanInfo[] = [
        createExistingPlan("2024-01-16", "09:00", "10:00"),
      ];

      const result = adjustOverlappingTimes(newPlans, existingPlans);

      expect(result.adjustedCount).toBe(0);
      expect(result.adjustedPlans[0].start_time).toBe("09:00");
    });

    it("빈 배열에 대해 빈 결과를 반환해야 함", () => {
      const result = adjustOverlappingTimes([], []);

      expect(result.adjustedCount).toBe(0);
      expect(result.adjustedPlans).toHaveLength(0);
      expect(result.unadjustablePlans).toHaveLength(0);
    });
  });
});
