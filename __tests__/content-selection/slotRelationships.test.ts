/**
 * 슬롯 관계 (연계/배타) 테스트
 *
 * 1. 연계 슬롯 (linked): 슬롯 순서 강제 (강의 → 복습)
 * 2. 배타적 슬롯 (exclusive): 같은 날 배치 방지
 * 3. 관계 검증: 순환 참조, 자기 참조, 존재하지 않는 슬롯 참조
 */

import { describe, it, expect } from "vitest";
import {
  calculateVirtualTimeline,
  type DailyScheduleInfo,
} from "@/lib/plan/virtualSchedulePreview";
import {
  validateSlotRelationships,
  type ContentSlot,
} from "@/lib/types/content-selection";

// 테스트용 일정 생성 헬퍼
function createDailySchedules(days: number): DailyScheduleInfo[] {
  const schedules: DailyScheduleInfo[] = [];
  const baseDate = new Date("2025-01-06"); // 월요일

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    schedules.push({
      date: date.toISOString().split("T")[0],
      day_type: "학습일",
      study_hours: 4,
      week_number: Math.floor(i / 7) + 1,
    });
  }

  return schedules;
}

// 테스트용 슬롯 생성 헬퍼
function createSlot(
  index: number,
  overrides: Partial<ContentSlot> = {}
): ContentSlot {
  return {
    slot_index: index,
    slot_type: "book",
    subject_category: "수학",
    id: `slot-${index}`,
    ...overrides,
  };
}

describe("슬롯 관계 스케줄링", () => {
  describe("연계 슬롯 (linked slots)", () => {
    it("연계된 슬롯들이 같은 날에 연속 배치되어야 함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", subject_category: "수학" }),
        createSlot(1, {
          id: "slot-1",
          subject_category: "수학",
          linked_slot_id: "slot-0",
          link_type: "after",
        }),
      ];

      const result = calculateVirtualTimeline(slots, createDailySchedules(7));

      expect(result.plans).toHaveLength(2);

      // 같은 날에 배치되어야 함
      expect(result.plans[0].date).toBe(result.plans[1].date);

      // 연계 정보가 포함되어야 함
      const linkedPlan = result.plans.find((p) => p.slot_index === 1);
      expect(linkedPlan?.linked_to_slot_index).toBe(0);
      expect(linkedPlan?.link_type).toBe("after");
    });

    it("연계 그룹은 같은 linked_group_id를 가져야 함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, {
          id: "slot-1",
          linked_slot_id: "slot-0",
          link_type: "after",
        }),
        createSlot(2, {
          id: "slot-2",
          linked_slot_id: "slot-1",
          link_type: "after",
        }),
      ];

      const result = calculateVirtualTimeline(slots, createDailySchedules(7));

      // 모든 연계 슬롯이 같은 그룹 ID를 가져야 함
      const groupIds = result.plans.map((p) => p.linked_group_id);
      expect(groupIds[0]).toBe(groupIds[1]);
      expect(groupIds[1]).toBe(groupIds[2]);
    });

    it("시간이 부족하면 연계 슬롯이 다른 날에 배치될 수 있고 경고 발생", () => {
      // 하루 1시간만 가용
      const limitedSchedules: DailyScheduleInfo[] = [
        { date: "2025-01-06", day_type: "학습일", study_hours: 1, week_number: 1 },
        { date: "2025-01-07", day_type: "학습일", study_hours: 1, week_number: 1 },
      ];

      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", duration_minutes: 50 }),
        createSlot(1, {
          id: "slot-1",
          duration_minutes: 50,
          linked_slot_id: "slot-0",
          link_type: "after",
        }),
      ];

      const result = calculateVirtualTimeline(slots, limitedSchedules);

      // 다른 날에 배치될 수 있음
      if (result.plans[0].date !== result.plans[1].date) {
        // 경고 메시지가 있어야 함
        expect(
          result.warnings.some((w) => w.includes("연계된 슬롯"))
        ).toBe(true);
      }
    });
  });

  describe("배타적 슬롯 (exclusive slots)", () => {
    it("배타적 슬롯은 같은 날에 배치되면 안 됨", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", subject_category: "수학" }),
        createSlot(1, {
          id: "slot-1",
          subject_category: "영어",
          exclusive_with: ["slot-0"],
        }),
      ];

      const result = calculateVirtualTimeline(slots, createDailySchedules(7));

      expect(result.plans).toHaveLength(2);
      // 다른 날에 배치되어야 함
      expect(result.plans[0].date).not.toBe(result.plans[1].date);
    });

    it("배타적 관계로 조정되면 경고 메시지 발생", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, { id: "slot-1", exclusive_with: ["slot-0"] }),
      ];

      const result = calculateVirtualTimeline(slots, createDailySchedules(7));

      expect(result.warnings.some((w) => w.includes("배타적"))).toBe(true);
    });

    it("양방향 배타적 관계도 처리해야 함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", exclusive_with: ["slot-1"] }),
        createSlot(1, { id: "slot-1", exclusive_with: ["slot-0"] }),
      ];

      const result = calculateVirtualTimeline(slots, createDailySchedules(7));

      expect(result.plans[0].date).not.toBe(result.plans[1].date);
    });

    it("배타적 슬롯 인덱스가 결과에 포함되어야 함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, { id: "slot-1", exclusive_with: ["slot-0"] }),
      ];

      const result = calculateVirtualTimeline(slots, createDailySchedules(7));

      const exclusivePlan = result.plans.find((p) => p.slot_index === 1);
      expect(exclusivePlan?.exclusive_with_indices).toContain(0);
    });

    it("배치할 날짜가 없으면 경고 발생", () => {
      // 하루만 가용
      const limitedSchedules: DailyScheduleInfo[] = [
        { date: "2025-01-06", day_type: "학습일", study_hours: 8, week_number: 1 },
      ];

      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, { id: "slot-1", exclusive_with: ["slot-0"] }),
      ];

      const result = calculateVirtualTimeline(slots, limitedSchedules);

      // 두 번째 슬롯은 배치되지 않거나 경고 발생
      expect(
        result.plans.length < 2 ||
          result.warnings.some((w) => w.includes("배치"))
      ).toBe(true);
    });
  });

  describe("복합 관계", () => {
    it("연계와 배타가 동시에 적용될 수 있음", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, {
          id: "slot-1",
          linked_slot_id: "slot-0",
          link_type: "after",
        }),
        createSlot(2, { id: "slot-2", exclusive_with: ["slot-0", "slot-1"] }),
      ];

      const result = calculateVirtualTimeline(slots, createDailySchedules(7));

      expect(result.plans).toHaveLength(3);

      // slot-0과 slot-1은 같은 날
      const date0 = result.plans.find((p) => p.slot_index === 0)?.date;
      const date1 = result.plans.find((p) => p.slot_index === 1)?.date;
      const date2 = result.plans.find((p) => p.slot_index === 2)?.date;

      expect(date0).toBe(date1);
      expect(date2).not.toBe(date0);
    });
  });
});

describe("슬롯 관계 검증 (validateSlotRelationships)", () => {
  describe("자기 참조 검증", () => {
    it("연계 슬롯에서 자기 자신 참조 시 에러", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", linked_slot_id: "slot-0" }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("자기 자신"))).toBe(true);
    });

    it("배타적 관계에서 자기 자신 참조 시 에러", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", exclusive_with: ["slot-0"] }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("자기 자신"))).toBe(true);
    });
  });

  describe("존재하지 않는 슬롯 참조", () => {
    it("연계 슬롯이 존재하지 않으면 경고", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", linked_slot_id: "non-existent" }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.warnings.some((w) => w.includes("존재하지 않"))).toBe(true);
    });

    it("배타적 슬롯이 존재하지 않으면 경고", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", exclusive_with: ["non-existent"] }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.warnings.some((w) => w.includes("존재하지 않"))).toBe(true);
    });
  });

  describe("순환 참조 검증", () => {
    it("A→B→A 순환 참조 탐지", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", linked_slot_id: "slot-1" }),
        createSlot(1, { id: "slot-1", linked_slot_id: "slot-0" }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("순환"))).toBe(true);
    });

    it("A→B→C→A 순환 참조 탐지", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0", linked_slot_id: "slot-1" }),
        createSlot(1, { id: "slot-1", linked_slot_id: "slot-2" }),
        createSlot(2, { id: "slot-2", linked_slot_id: "slot-0" }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("순환"))).toBe(true);
    });

    it("순환이 없는 체인은 유효함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, { id: "slot-1", linked_slot_id: "slot-0" }),
        createSlot(2, { id: "slot-2", linked_slot_id: "slot-1" }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("유효한 관계", () => {
    it("관계가 없는 슬롯은 유효함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, { id: "slot-1" }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
    });

    it("올바른 연계 관계는 유효함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, { id: "slot-1", linked_slot_id: "slot-0", link_type: "after" }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
    });

    it("올바른 배타적 관계는 유효함", () => {
      const slots: ContentSlot[] = [
        createSlot(0, { id: "slot-0" }),
        createSlot(1, { id: "slot-1", exclusive_with: ["slot-0"] }),
      ];

      const result = validateSlotRelationships(slots);

      expect(result.valid).toBe(true);
    });
  });
});
