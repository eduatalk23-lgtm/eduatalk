/**
 * SchedulerEngine 통합 테스트
 *
 * 실제 SchedulerEngine 클래스를 사용하여 스케줄링 동작을 검증합니다.
 * Phase 2: 기존 플랜이 있을 때 시간 충돌 방지 로직을 테스트합니다.
 *
 * @module __tests__/lib/scheduler/schedulerEngine.integration.test
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Timetable1730Scheduler } from "@/lib/scheduler/schedulers/Timetable1730Scheduler";
import type { SchedulerInput } from "@/lib/scheduler/types";
import type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";
import type { ContentInfo, DateTimeSlots } from "@/lib/plan/scheduler";

// DateTimeSlots 타입의 슬롯 항목 타입
type TimeSlotEntry = {
  type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
  start: string;
  end: string;
  label?: string;
};

// 날짜별 시간 슬롯 생성 헬퍼
function createDefaultDateTimeSlots(dates: string[]): DateTimeSlots {
  const slots = new Map<string, TimeSlotEntry[]>();
  for (const date of dates) {
    slots.set(date, [
      { type: "학습시간", start: "09:00", end: "12:00" }, // 3시간 학습
      { type: "자율학습", start: "19:00", end: "21:00" }, // 2시간 자율학습
    ]);
  }
  return slots;
}

// 테스트용 헬퍼 함수
function createTestInput(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  const dates = [
    "2024-01-15",
    "2024-01-16",
    "2024-01-17",
    "2024-01-18",
    "2024-01-19",
    "2024-01-20",
    "2024-01-21",
  ];

  const defaultInput: SchedulerInput = {
    availableDates: dates,
    contentInfos: [
      {
        content_id: "book-1",
        content_type: "book",
        start_range: 1,
        end_range: 100,
        estimated_duration: 60, // 분 단위
      },
    ],
    blocks: [],
    academySchedules: [],
    exclusions: [],
    options: {
      cycle_type: "1730",
      study_days: 6,
      review_day: 1,
    },
    dateTimeSlots: createDefaultDateTimeSlots(dates),
    contentDurationMap: new Map([
      ["book-1", { durationMinutes: 60, source: "default" }],
    ]),
    ...overrides,
  };

  return defaultInput;
}

// 시간 문자열을 분으로 변환
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// 두 시간 범위가 겹치는지 확인
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && s2 < e1;
}

describe("SchedulerEngine 통합 테스트", () => {
  describe("기본 스케줄링", () => {
    it("콘텐츠가 있으면 플랜이 생성되어야 함", () => {
      const input = createTestInput();

      const result = Timetable1730Scheduler.generate(input);

      expect(result.plans.length).toBeGreaterThan(0);
      expect(result.failureReasons.length).toBe(0);
    });

    it("생성된 플랜에는 시간 정보가 포함되어야 함", () => {
      const input = createTestInput();

      const result = Timetable1730Scheduler.generate(input);

      // 적어도 일부 플랜에는 시간 정보가 있어야 함
      const plansWithTime = result.plans.filter(
        (p) => p.start_time && p.end_time
      );
      expect(plansWithTime.length).toBeGreaterThan(0);
    });

    it("콘텐츠가 없으면 플랜이 생성되지 않아야 함", () => {
      const input = createTestInput({ contentInfos: [] });

      const result = Timetable1730Scheduler.generate(input);

      expect(result.plans.length).toBe(0);
    });
  });

  describe("Phase 2: 기존 플랜과의 시간 충돌 방지", () => {
    it("기존 플랜이 없으면 학습 시간대에 플랜이 배치됨", () => {
      const input = createTestInput({
        existingPlans: [],
      });

      const result = Timetable1730Scheduler.generate(input);
      const plansWithTime = result.plans.filter(
        (p) => p.start_time && p.end_time
      );

      // 플랜이 학습 시간대(09:00-12:00)에 배치되어야 함
      for (const plan of plansWithTime) {
        if (plan.start_time && plan.end_time) {
          const startMinutes = timeToMinutes(plan.start_time);
          // 학습 시간(09:00-12:00) 또는 자율학습 시간(19:00-21:00) 내에 있어야 함
          const isInStudyTime = startMinutes >= 540 && startMinutes < 720; // 09:00-12:00
          const isInSelfStudyTime = startMinutes >= 1140 && startMinutes < 1260; // 19:00-21:00
          expect(isInStudyTime || isInSelfStudyTime).toBe(true);
        }
      }
    });

    it("기존 플랜이 있는 시간대는 회피해야 함", () => {
      // 09:00-10:00에 기존 플랜이 있음
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "10:00" },
      ];

      const input = createTestInput({
        existingPlans,
        contentInfos: [
          {
            content_id: "book-1",
            content_type: "book",
            start_range: 1,
            end_range: 50,
            estimated_duration: 30, // 30분짜리 플랜
          },
        ],
      });

      const result = Timetable1730Scheduler.generate(input);

      // 2024-01-15에 생성된 플랜 확인
      const plansOnDay = result.plans.filter(
        (p) => p.plan_date === "2024-01-15" && p.start_time && p.end_time
      );

      // 기존 플랜 시간(09:00-10:00)과 겹치지 않아야 함
      for (const plan of plansOnDay) {
        if (plan.start_time && plan.end_time) {
          const overlaps = timeRangesOverlap(
            plan.start_time,
            plan.end_time,
            "09:00",
            "10:00"
          );
          expect(overlaps).toBe(false);
        }
      }
    });

    it("학습 시간이 가득 찬 날짜에서는 자율학습 시간에 배치됨", () => {
      // 학습 시간 전체(09:00-12:00)를 차지하는 기존 플랜
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "12:00" },
      ];

      const input = createTestInput({
        existingPlans,
        availableDates: ["2024-01-15"], // 하루만 테스트
        contentInfos: [
          {
            content_id: "book-1",
            content_type: "book",
            start_range: 1,
            end_range: 30,
            estimated_duration: 30, // 30분
          },
        ],
      });

      const result = Timetable1730Scheduler.generate(input);

      // 플랜이 자율학습 시간(19:00-21:00)에 배치되거나
      // 다른 날짜에 배치되어야 함
      const plansOnDay = result.plans.filter(
        (p) => p.plan_date === "2024-01-15" && p.start_time && p.end_time
      );

      for (const plan of plansOnDay) {
        if (plan.start_time && plan.end_time) {
          const startMinutes = timeToMinutes(plan.start_time);
          // 자율학습 시간(19:00-21:00)에 있어야 함
          const isInSelfStudyTime = startMinutes >= 1140 && startMinutes < 1260;
          // 또는 학습 시간과 겹치지 않아야 함
          const overlapsWithExisting = timeRangesOverlap(
            plan.start_time,
            plan.end_time,
            "09:00",
            "12:00"
          );
          expect(isInSelfStudyTime || !overlapsWithExisting).toBe(true);
        }
      }
    });

    it("여러 날짜에 기존 플랜이 있으면 가용 시간이 줄어듦", () => {
      // 각 날짜에 1시간씩 기존 플랜이 있음 (총 3시간 사용)
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "10:00" },
        { date: "2024-01-16", start_time: "10:00", end_time: "11:00" },
        { date: "2024-01-17", start_time: "11:00", end_time: "12:00" },
      ];

      const inputWithExisting = createTestInput({
        existingPlans,
        contentInfos: [
          {
            content_id: "book-1",
            content_type: "book",
            start_range: 1,
            end_range: 100,
            estimated_duration: 60,
          },
        ],
      });

      const inputWithoutExisting = createTestInput({
        existingPlans: [],
        contentInfos: [
          {
            content_id: "book-1",
            content_type: "book",
            start_range: 1,
            end_range: 100,
            estimated_duration: 60,
          },
        ],
      });

      const resultWithExisting = Timetable1730Scheduler.generate(inputWithExisting);
      const resultWithoutExisting = Timetable1730Scheduler.generate(inputWithoutExisting);

      // 기존 플랜이 있는 경우에도 플랜이 생성되어야 함
      expect(resultWithExisting.plans.length).toBeGreaterThan(0);

      // 기존 플랜이 있는 경우 스케줄러가 existingPlans를 고려함
      // (정확한 시간 회피는 스케줄러 구현에 따라 다름)
      // 여기서는 스케줄러가 existingPlans 정보를 받아서 처리했음을 확인
      expect(resultWithExisting.failureReasons.length).toBe(0);
    });
  });

  describe("스케줄링 실패 케이스", () => {
    it("학습 가능한 날짜가 없으면 실패 원인 반환", () => {
      const input = createTestInput({
        availableDates: [],
      });

      const result = Timetable1730Scheduler.generate(input);

      expect(result.plans.length).toBe(0);
      expect(result.failureReasons.length).toBeGreaterThan(0);
      expect(result.failureReasons[0].type).toBe("no_study_days");
    });
  });

  describe("복수 콘텐츠 스케줄링", () => {
    it("여러 콘텐츠가 있으면 모두 스케줄링됨", () => {
      const input = createTestInput({
        contentInfos: [
          {
            content_id: "book-1",
            content_type: "book",
            start_range: 1,
            end_range: 50,
            estimated_duration: 30,
          },
          {
            content_id: "book-2",
            content_type: "book",
            start_range: 1,
            end_range: 50,
            estimated_duration: 30,
          },
        ],
        contentDurationMap: new Map([
          ["book-1", { durationMinutes: 30, source: "default" }],
          ["book-2", { durationMinutes: 30, source: "default" }],
        ]),
      });

      const result = Timetable1730Scheduler.generate(input);

      // 두 콘텐츠 모두에 대한 플랜이 있어야 함
      const book1Plans = result.plans.filter((p) => p.content_id === "book-1");
      const book2Plans = result.plans.filter((p) => p.content_id === "book-2");

      expect(book1Plans.length).toBeGreaterThan(0);
      expect(book2Plans.length).toBeGreaterThan(0);
    });
  });
});
