/**
 * TimeAllocationService 테스트
 *
 * Best-Fit Decreasing 알고리즘의 정확성을 검증합니다.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TimeAllocationService } from "@/lib/plan/services/TimeAllocationService";
import type { ScheduledPlan } from "@/lib/plan/shared";

describe("TimeAllocationService", () => {
  let service: TimeAllocationService;

  beforeEach(() => {
    service = new TimeAllocationService();
  });

  describe("allocateTime", () => {
    it("빈 플랜 배열에 대해 빈 결과를 반환해야 함", async () => {
      const result = await service.allocateTime({
        scheduledPlans: [],
        dateTimeRanges: new Map(),
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      expect(result.data?.allocatedPlans).toHaveLength(0);
      expect(result.data?.unallocatedPlans).toHaveLength(0);
    });

    it("시간 슬롯이 없으면 기본 시간(09:00-10:00)으로 할당해야 함", async () => {
      const plans: ScheduledPlan[] = [
        createMockPlan("plan-1", "2025-01-05", 60),
      ];

      const result = await service.allocateTime({
        scheduledPlans: plans,
        dateTimeRanges: new Map(), // 빈 시간 슬롯
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      expect(result.data?.allocatedPlans).toHaveLength(1);
      expect(result.data?.allocatedPlans[0].start_time).toBe("09:00");
      expect(result.data?.allocatedPlans[0].end_time).toBe("10:00");
    });

    it("Best-Fit: 큰 플랜부터 가장 적합한 슬롯에 배정해야 함", async () => {
      // 60분, 90분, 30분 플랜
      const plans: ScheduledPlan[] = [
        createMockPlan("plan-1", "2025-01-05", 60),
        createMockPlan("plan-2", "2025-01-05", 90),
        createMockPlan("plan-3", "2025-01-05", 30),
      ];

      // 60분 슬롯과 90분 슬롯
      const dateTimeRanges = new Map([
        [
          "2025-01-05",
          [
            { start: "09:00", end: "10:00" }, // 60분
            { start: "10:00", end: "11:30" }, // 90분
          ],
        ],
      ]);

      const result = await service.allocateTime({
        scheduledPlans: plans,
        dateTimeRanges,
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      // 90분 플랜은 90분 슬롯에, 60분 플랜은 60분 슬롯에 배정
      expect(result.data?.allocatedPlans).toHaveLength(2);
      // 30분 플랜은 남은 공간 없음
      expect(result.data?.unallocatedPlans).toHaveLength(1);
      expect(result.data?.unallocatedPlans[0].content_id).toBe("content-3");
    });

    it("슬롯이 충분하면 모든 플랜을 배정해야 함", async () => {
      const plans: ScheduledPlan[] = [
        createMockPlan("plan-1", "2025-01-05", 30),
        createMockPlan("plan-2", "2025-01-05", 30),
        createMockPlan("plan-3", "2025-01-05", 30),
      ];

      // 2시간 슬롯 (120분)
      const dateTimeRanges = new Map([
        [
          "2025-01-05",
          [{ start: "09:00", end: "11:00" }], // 120분
        ],
      ]);

      const result = await service.allocateTime({
        scheduledPlans: plans,
        dateTimeRanges,
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      expect(result.data?.allocatedPlans).toHaveLength(3);
      expect(result.data?.unallocatedPlans).toHaveLength(0);
    });

    it("슬롯 용량 초과 시 일부 플랜을 미할당으로 분류해야 함", async () => {
      // 총 120분 플랜
      const plans: ScheduledPlan[] = [
        createMockPlan("plan-1", "2025-01-05", 60),
        createMockPlan("plan-2", "2025-01-05", 60),
      ];

      // 60분 슬롯 하나
      const dateTimeRanges = new Map([
        [
          "2025-01-05",
          [{ start: "09:00", end: "10:00" }], // 60분
        ],
      ]);

      const result = await service.allocateTime({
        scheduledPlans: plans,
        dateTimeRanges,
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      expect(result.data?.allocatedPlans).toHaveLength(1);
      expect(result.data?.unallocatedPlans).toHaveLength(1);
    });

    it("여러 날짜의 플랜을 각각 독립적으로 할당해야 함", async () => {
      const plans: ScheduledPlan[] = [
        createMockPlan("plan-1", "2025-01-05", 60),
        createMockPlan("plan-2", "2025-01-06", 60),
      ];

      const dateTimeRanges = new Map([
        ["2025-01-05", [{ start: "09:00", end: "10:00" }]],
        ["2025-01-06", [{ start: "10:00", end: "11:00" }]],
      ]);

      const result = await service.allocateTime({
        scheduledPlans: plans,
        dateTimeRanges,
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      expect(result.data?.allocatedPlans).toHaveLength(2);

      const day1Plan = result.data?.allocatedPlans.find(
        (p) => p.date === "2025-01-05"
      );
      const day2Plan = result.data?.allocatedPlans.find(
        (p) => p.date === "2025-01-06"
      );

      expect(day1Plan?.start_time).toBe("09:00");
      expect(day2Plan?.start_time).toBe("10:00");
    });

    it("estimated_duration이 없으면 기본값 60분을 사용해야 함", async () => {
      const plans: ScheduledPlan[] = [
        {
          ...createMockPlan("plan-1", "2025-01-05", 60),
          estimated_duration: undefined as unknown as number,
        },
      ];

      const dateTimeRanges = new Map([
        ["2025-01-05", [{ start: "09:00", end: "11:00" }]],
      ]);

      const result = await service.allocateTime({
        scheduledPlans: plans,
        dateTimeRanges,
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      expect(result.data?.allocatedPlans).toHaveLength(1);
      // 기본 60분으로 할당
      expect(result.data?.allocatedPlans[0].start_time).toBe("09:00");
      expect(result.data?.allocatedPlans[0].end_time).toBe("10:00");
    });

    it("여러 슬롯에 효율적으로 분배해야 함", async () => {
      // 45분, 45분, 30분 플랜
      const plans: ScheduledPlan[] = [
        createMockPlan("plan-1", "2025-01-05", 45),
        createMockPlan("plan-2", "2025-01-05", 45),
        createMockPlan("plan-3", "2025-01-05", 30),
      ];

      // 50분 슬롯 3개
      const dateTimeRanges = new Map([
        [
          "2025-01-05",
          [
            { start: "09:00", end: "09:50" }, // 50분
            { start: "10:00", end: "10:50" }, // 50분
            { start: "11:00", end: "11:50" }, // 50분
          ],
        ],
      ]);

      const result = await service.allocateTime({
        scheduledPlans: plans,
        dateTimeRanges,
        contentDurationMap: new Map(),
      });

      expect(result.success).toBe(true);
      // 모든 플랜이 할당되어야 함
      expect(result.data?.allocatedPlans).toHaveLength(3);
      expect(result.data?.unallocatedPlans).toHaveLength(0);
    });
  });
});

/**
 * 테스트용 모의 플랜 생성
 */
function createMockPlan(
  id: string,
  date: string,
  duration: number
): ScheduledPlan {
  const planNumber = id.split("-")[1];
  return {
    date,
    plan_date: date,
    content_id: `content-${planNumber}`,
    content_type: "book",
    estimated_duration: duration,
    planned_start_page_or_time: 1,
    planned_end_page_or_time: 10,
    block_index: 0,
    day_type: "학습일",
  };
}
