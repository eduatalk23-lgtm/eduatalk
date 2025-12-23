import { describe, it, expect } from "vitest";
import {
  calculateVirtualTimeline,
  DailyScheduleInfo,
} from "@/lib/plan/virtualSchedulePreview";
import type { ContentSlot } from "@/lib/types/content-selection";

// ============================================================================
// 테스트 헬퍼
// ============================================================================

/**
 * 테스트용 일별 스케줄 생성
 */
function createDailySchedules(
  startDate: string,
  count: number,
  studyHours: number = 6
): DailyScheduleInfo[] {
  const schedules: DailyScheduleInfo[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    schedules.push({
      date: date.toISOString().split("T")[0],
      day_type: "학습일",
      study_hours: studyHours,
      week_number: Math.floor(i / 7) + 1,
    });
  }

  return schedules;
}

// ============================================================================
// 연계 슬롯 스케줄링 테스트
// ============================================================================

describe("Virtual Timeline - Linked Slots Scheduling", () => {
  it("연계된 슬롯들은 같은 그룹으로 연속 배치되어야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "lecture",
        subject_category: "수학",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "self_study",
        subject_category: "수학",
        linked_slot_id: "slot-1",
        link_type: "after",
        self_study_purpose: "review",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7);
    const result = calculateVirtualTimeline(slots, schedules);

    // 두 플랜이 같은 날에 배치되어야 함
    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);

    expect(slot1Plan).toBeDefined();
    expect(slot2Plan).toBeDefined();
    expect(slot1Plan!.date).toBe(slot2Plan!.date);
  });

  it("link_type: after인 슬롯은 연결된 슬롯 다음에 배치되어야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "lecture",
        subject_category: "수학",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "self_study",
        subject_category: "수학",
        linked_slot_id: "slot-1",
        link_type: "after",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7);
    const result = calculateVirtualTimeline(slots, schedules);

    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);

    // slot-2는 slot-1 다음에 와야 함
    const slot1EndTime = slot1Plan!.end_time;
    const slot2StartTime = slot2Plan!.start_time;

    expect(slot2StartTime >= slot1EndTime).toBe(true);
  });

  it("link_type: before인 슬롯은 연결된 슬롯 이전에 배치되어야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "self_study",
        subject_category: "수학",
        linked_slot_id: "slot-2",
        link_type: "before", // slot-2 이전에 배치
        self_study_purpose: "preview",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "lecture",
        subject_category: "수학",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7);
    const result = calculateVirtualTimeline(slots, schedules);

    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);

    // slot-1은 slot-2 이전에 와야 함
    expect(slot1Plan!.start_time <= slot2Plan!.start_time).toBe(true);
  });

  it("3개 이상 연계된 슬롯도 올바른 순서로 배치되어야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "lecture",
        subject_category: "수학",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "self_study",
        subject_category: "수학",
        linked_slot_id: "slot-1",
        link_type: "after",
      },
      {
        id: "slot-3",
        slot_index: 2,
        slot_type: "test",
        subject_category: "수학",
        linked_slot_id: "slot-2",
        link_type: "after",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8); // 충분한 시간
    const result = calculateVirtualTimeline(slots, schedules);

    const plans = result.plans.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

    // 순서: slot-1 → slot-2 → slot-3
    const order = plans.map((p) => p.slot_index);
    expect(order).toEqual([0, 1, 2]);
  });

  it("연계 그룹이 하루에 들어가지 않으면 경고를 표시해야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
        content_id: "content-1",
        start_range: 1,
        end_range: 100, // 큰 범위
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "book",
        subject_category: "수학",
        linked_slot_id: "slot-1",
        link_type: "after",
        content_id: "content-2",
        start_range: 1,
        end_range: 100,
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 2); // 하루 2시간만
    const result = calculateVirtualTimeline(slots, schedules);

    // 같은 날에 배치되지 못하면 경고
    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);

    if (slot1Plan?.date !== slot2Plan?.date) {
      expect(result.warnings.some((w) => w.includes("연계"))).toBe(true);
    }
  });
});

// ============================================================================
// 배타적 슬롯 스케줄링 테스트
// ============================================================================

describe("Virtual Timeline - Exclusive Slots Scheduling", () => {
  it("배타적 슬롯은 같은 날에 배치되지 않아야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "영어",
        exclusive_with: ["slot-2"],
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "lecture",
        subject_category: "영어",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);

    expect(slot1Plan).toBeDefined();
    expect(slot2Plan).toBeDefined();
    expect(slot1Plan!.date).not.toBe(slot2Plan!.date);
  });

  it("배타적 관계로 다른 날로 조정되면 경고를 표시해야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "lecture",
        subject_category: "영어",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "book",
        subject_category: "영어",
        exclusive_with: ["slot-1"],
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    // 배타적 제약으로 조정되었다는 경고
    expect(result.warnings.some((w) => w.includes("배타적") || w.includes("조정"))).toBe(true);
  });

  it("양방향 배타적 관계도 처리해야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "영어",
        exclusive_with: ["slot-2"],
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "lecture",
        subject_category: "영어",
        exclusive_with: ["slot-1"], // 양방향 배타
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);

    expect(slot1Plan!.date).not.toBe(slot2Plan!.date);
  });

  it("여러 슬롯과 배타적 관계인 경우 모두 다른 날에 배치해야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
        exclusive_with: ["slot-2", "slot-3"],
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "lecture",
        subject_category: "수학",
      },
      {
        id: "slot-3",
        slot_index: 2,
        slot_type: "self_study",
        subject_category: "수학",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);
    const slot3Plan = result.plans.find((p) => p.slot_index === 2);

    // slot-1은 slot-2, slot-3과 다른 날
    expect(slot1Plan!.date).not.toBe(slot2Plan!.date);
    expect(slot1Plan!.date).not.toBe(slot3Plan!.date);
  });
});

// ============================================================================
// 복합 시나리오 테스트
// ============================================================================

describe("Virtual Timeline - Complex Scenarios", () => {
  it("연계와 배타 관계가 함께 있을 때 올바르게 처리해야 함", () => {
    const slots: ContentSlot[] = [
      // 그룹 1: 수학 강의 → 복습 (연계)
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "lecture",
        subject_category: "수학",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "self_study",
        subject_category: "수학",
        linked_slot_id: "slot-1",
        link_type: "after",
      },
      // 그룹 2: 영어 (slot-1, slot-2와 배타)
      {
        id: "slot-3",
        slot_index: 2,
        slot_type: "book",
        subject_category: "영어",
        exclusive_with: ["slot-1", "slot-2"],
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    const slot1Plan = result.plans.find((p) => p.slot_index === 0);
    const slot2Plan = result.plans.find((p) => p.slot_index === 1);
    const slot3Plan = result.plans.find((p) => p.slot_index === 2);

    // slot-1, slot-2는 같은 날 (연계)
    expect(slot1Plan!.date).toBe(slot2Plan!.date);

    // slot-3는 slot-1, slot-2와 다른 날 (배타)
    expect(slot3Plan!.date).not.toBe(slot1Plan!.date);
  });

  it("관계가 없는 슬롯은 일반적으로 배치되어야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "lecture",
        subject_category: "영어",
      },
      {
        id: "slot-3",
        slot_index: 2,
        slot_type: "book",
        subject_category: "국어",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    expect(result.plans).toHaveLength(3);
    expect(result.warnings).toHaveLength(0);
  });

  it("ID가 없는 슬롯도 정상적으로 배치되어야 함", () => {
    const slots: ContentSlot[] = [
      {
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
      },
      {
        slot_index: 1,
        slot_type: "lecture",
        subject_category: "영어",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    expect(result.plans).toHaveLength(2);
  });

  it("배타적 제약으로 배치 불가능할 때 경고를 표시해야 함", () => {
    // 모든 슬롯이 서로 배타적이고, 날짜가 부족한 경우
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
        exclusive_with: ["slot-2", "slot-3"],
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "book",
        subject_category: "수학",
        exclusive_with: ["slot-1", "slot-3"],
      },
      {
        id: "slot-3",
        slot_index: 2,
        slot_type: "book",
        subject_category: "수학",
        exclusive_with: ["slot-1", "slot-2"],
      },
    ];

    // 2일만 제공 (3개 슬롯이 각각 다른 날에 배치되어야 하는데 불가능)
    const schedules = createDailySchedules("2025-01-01", 2, 8);
    const result = calculateVirtualTimeline(slots, schedules);

    // 배치 불가능하면 경고 또는 에러
    expect(result.warnings.length > 0 || result.plans.length < 3).toBe(true);
  });
});

// ============================================================================
// 엣지 케이스 테스트
// ============================================================================

describe("Virtual Timeline - Edge Cases", () => {
  it("빈 슬롯 배열은 빈 결과를 반환해야 함", () => {
    const schedules = createDailySchedules("2025-01-01", 7);
    const result = calculateVirtualTimeline([], schedules);

    expect(result.plans).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("유효한 슬롯"))).toBe(true);
  });

  it("빈 스케줄 배열은 경고를 반환해야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: "book",
        subject_category: "수학",
      },
    ];

    const result = calculateVirtualTimeline(slots, []);

    expect(result.plans).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("날짜"))).toBe(true);
  });

  it("유효하지 않은 슬롯(타입 없음)은 필터링되어야 함", () => {
    const slots: ContentSlot[] = [
      {
        id: "slot-1",
        slot_index: 0,
        slot_type: null, // 타입 없음
        subject_category: "수학",
      },
      {
        id: "slot-2",
        slot_index: 1,
        slot_type: "book",
        subject_category: "수학",
      },
    ];

    const schedules = createDailySchedules("2025-01-01", 7);
    const result = calculateVirtualTimeline(slots, schedules);

    // slot-1은 필터링되고 slot-2만 배치
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].slot_index).toBe(1);
  });
});
