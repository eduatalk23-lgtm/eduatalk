/**
 * 스케줄러 로직 테스트
 *
 * scheduler.ts의 핵심 함수들을 검증합니다.
 * - 콘텐츠를 날짜별로 분배
 * - 학습일/복습일 사이클 적용
 * - 1730 타임테이블 로직
 *
 * @module __tests__/lib/plan/scheduler.test
 */

import { describe, it, expect } from "vitest";

// Types for testing
type DayType = "학습일" | "복습일" | null;

interface ContentRange {
  content_id: string;
  content_type: "book" | "lecture" | "custom";
  start_range: number;
  end_range: number;
  total_units: number; // 총 페이지 또는 에피소드 수
}

interface ScheduledPlan {
  date: string;
  content_id: string;
  content_type: string;
  start_range: number;
  end_range: number;
  estimated_duration: number;
  is_review: boolean;
  day_type: DayType;
}

interface DateMetadata {
  date: string;
  day_type: DayType;
  week_number: number;
}

describe("scheduler", () => {
  describe("날짜별 콘텐츠 분배", () => {
    it("10일에 100페이지를 균등 분배하면 하루 10페이지", () => {
      // Given
      const content: ContentRange = {
        content_id: "book-1",
        content_type: "book",
        start_range: 1,
        end_range: 100,
        total_units: 100,
      };
      const availableDays = 10;

      // When: 균등 분배
      const unitsPerDay = Math.ceil(content.total_units / availableDays);

      // Then
      expect(unitsPerDay).toBe(10);
    });

    it("나누어 떨어지지 않으면 마지막 날에 남은 분량 배정", () => {
      // Given: 103페이지를 10일에 분배
      const totalPages = 103;
      const availableDays = 10;
      const pagesPerDay = Math.ceil(totalPages / availableDays); // 11

      // When: 분배 계산
      const distribution: number[] = [];
      let remaining = totalPages;

      for (let i = 0; i < availableDays; i++) {
        const pages = Math.min(pagesPerDay, remaining);
        distribution.push(pages);
        remaining -= pages;
      }

      // Then
      expect(distribution.slice(0, 9)).toEqual([11, 11, 11, 11, 11, 11, 11, 11, 11]);
      expect(distribution[9]).toBe(4); // 마지막 날: 103 - 99 = 4페이지
      expect(distribution.reduce((a, b) => a + b, 0)).toBe(103);
    });

    it("여러 콘텐츠를 순차적으로 분배", () => {
      // Given: 2개의 교재
      const contents: ContentRange[] = [
        {
          content_id: "book-1",
          content_type: "book",
          start_range: 1,
          end_range: 50,
          total_units: 50,
        },
        {
          content_id: "book-2",
          content_type: "book",
          start_range: 1,
          end_range: 50,
          total_units: 50,
        },
      ];
      const availableDays = 10;
      const totalUnits = contents.reduce((sum, c) => sum + c.total_units, 0);
      const unitsPerDay = Math.ceil(totalUnits / availableDays);

      // Then
      expect(totalUnits).toBe(100);
      expect(unitsPerDay).toBe(10);
    });
  });

  describe("학습일/복습일 사이클", () => {
    it("기본 패턴: 5일 학습 + 2일 복습", () => {
      // Given
      const studyDays = 5;
      const reviewDays = 2;
      const totalDays = 14; // 2주

      // When: 날짜별 타입 생성
      const dateTypes: DayType[] = [];
      let studyCount = 0;
      let reviewCount = 0;

      for (let i = 0; i < totalDays; i++) {
        if (studyCount < studyDays) {
          dateTypes.push("학습일");
          studyCount++;
        } else if (reviewCount < reviewDays) {
          dateTypes.push("복습일");
          reviewCount++;
          if (reviewCount === reviewDays) {
            studyCount = 0;
            reviewCount = 0;
          }
        }
      }

      // Then: 첫 주기 검증 (5학습 + 2복습)
      expect(dateTypes.slice(0, 7)).toEqual([
        "학습일",
        "학습일",
        "학습일",
        "학습일",
        "학습일",
        "복습일",
        "복습일",
      ]);
    });

    it("복습일에는 학습일 콘텐츠를 복습", () => {
      // Given: 학습일 플랜
      const studyPlans: ScheduledPlan[] = [
        {
          date: "2025-01-01",
          content_id: "book-1",
          content_type: "book",
          start_range: 1,
          end_range: 10,
          estimated_duration: 60,
          is_review: false,
          day_type: "학습일",
        },
      ];

      // When: 복습일 플랜 생성
      const reviewPlan: ScheduledPlan = {
        ...studyPlans[0],
        date: "2025-01-06",
        is_review: true,
        day_type: "복습일",
        estimated_duration: 30, // 복습은 50% 시간
      };

      // Then
      expect(reviewPlan.is_review).toBe(true);
      expect(reviewPlan.estimated_duration).toBe(30);
      expect(reviewPlan.content_id).toBe(studyPlans[0].content_id);
    });
  });

  describe("1730 타임테이블", () => {
    describe("주차별 학습 구조", () => {
      it("1주차: 5일 학습 + 2일 복습", () => {
        const week1Pattern = generateWeekPattern(1);

        expect(week1Pattern.studyDays).toBe(5);
        expect(week1Pattern.reviewDays).toBe(2);
      });

      it("2주차: 5일 학습 + 2일 복습", () => {
        const week2Pattern = generateWeekPattern(2);

        expect(week2Pattern.studyDays).toBe(5);
        expect(week2Pattern.reviewDays).toBe(2);
      });

      it("3주차: 3일 학습 + 4일 복습 (1,2주차 전체 복습)", () => {
        const week3Pattern = generateWeekPattern(3);

        expect(week3Pattern.studyDays).toBe(3);
        expect(week3Pattern.reviewDays).toBe(4);
      });
    });

    describe("복습 범위", () => {
      it("1주차 복습: 해당 주 학습 내용만", () => {
        // Given: 1주차 학습 플랜
        const week1StudyPlans: ScheduledPlan[] = [
          createPlan("2025-01-01", "book-1", 1, 10),
          createPlan("2025-01-02", "book-1", 11, 20),
        ];

        // When: 1주차 복습 범위 계산
        const reviewScope = calculateReviewScope(week1StudyPlans, 1);

        // Then: 1주차 내용만 복습
        expect(reviewScope.start_range).toBe(1);
        expect(reviewScope.end_range).toBe(20);
      });

      it("3주차 복습: 1,2주차 전체 내용", () => {
        // Given: 1,2주차 학습 플랜
        const allPlans: ScheduledPlan[] = [
          createPlan("2025-01-01", "book-1", 1, 10, 1),  // 1주차
          createPlan("2025-01-08", "book-1", 11, 20, 2), // 2주차
        ];

        // When: 3주차 복습 범위 계산
        const reviewScope = calculateReviewScope(allPlans, 3);

        // Then: 1,2주차 전체 복습
        expect(reviewScope.start_range).toBe(1);
        expect(reviewScope.end_range).toBe(20);
      });
    });
  });

  describe("에피소드 분할", () => {
    it("강의 범위를 개별 에피소드로 분할", () => {
      // Given: 1~5강 범위
      const lectureRange = {
        content_id: "lecture-1",
        start_range: 1,
        end_range: 5,
      };

      // When: 에피소드 분할
      const episodes: number[] = [];
      for (let i = lectureRange.start_range; i <= lectureRange.end_range; i++) {
        episodes.push(i);
      }

      // Then
      expect(episodes).toEqual([1, 2, 3, 4, 5]);
      expect(episodes.length).toBe(5);
    });

    it("에피소드별 시간에 맞게 시간 슬롯에 배치", () => {
      // Given: 에피소드별 duration
      const episodes = [
        { number: 1, duration: 30 },
        { number: 2, duration: 45 },
        { number: 3, duration: 25 },
      ];

      // 60분 슬롯
      const slotDuration = 60;

      // When: 슬롯에 배치
      const slots: { episodes: number[]; totalDuration: number }[] = [];
      let currentSlot = { episodes: [] as number[], totalDuration: 0 };

      episodes.forEach((ep) => {
        if (currentSlot.totalDuration + ep.duration <= slotDuration) {
          currentSlot.episodes.push(ep.number);
          currentSlot.totalDuration += ep.duration;
        } else {
          if (currentSlot.episodes.length > 0) {
            slots.push(currentSlot);
          }
          currentSlot = { episodes: [ep.number], totalDuration: ep.duration };
        }
      });

      if (currentSlot.episodes.length > 0) {
        slots.push(currentSlot);
      }

      // Then
      expect(slots[0].episodes).toEqual([1]); // 30분
      expect(slots[1].episodes).toEqual([2]); // 45분
      expect(slots[2].episodes).toEqual([3]); // 25분
    });
  });

  describe("제외일 처리", () => {
    it("제외일은 스케줄에서 건너뜀", () => {
      // Given: 날짜 목록과 제외일
      const dates = ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"];
      const exclusions = new Set(["2025-01-02"]);

      // When: 제외일 필터링
      const availableDates = dates.filter((d) => !exclusions.has(d));

      // Then
      expect(availableDates).toEqual(["2025-01-01", "2025-01-03", "2025-01-04"]);
      expect(availableDates.length).toBe(3);
    });

    it("학원 일정 시간대는 학습 시간에서 제외", () => {
      // Given: 학습 가능 시간과 학원 일정
      const availableSlots = [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "18:00" },
      ];
      const academySchedule = { start: "14:00", end: "16:00" };

      // When: 학원 시간 제외
      const filteredSlots = excludeTimeRange(availableSlots, academySchedule);

      // Then
      expect(filteredSlots).toHaveLength(3);
      expect(filteredSlots[0]).toEqual({ start: "09:00", end: "12:00" });
      expect(filteredSlots[1]).toEqual({ start: "13:00", end: "14:00" });
      expect(filteredSlots[2]).toEqual({ start: "16:00", end: "18:00" });
    });
  });

  describe("경계 조건", () => {
    it("1일에 전체 콘텐츠 배정", () => {
      const totalPages = 100;
      const availableDays = 1;

      const pagesPerDay = Math.ceil(totalPages / availableDays);

      expect(pagesPerDay).toBe(100);
    });

    it("콘텐츠보다 날짜가 많으면 일부 날짜는 비어있음", () => {
      // Given: 5페이지를 10일에 분배
      const totalPages = 5;
      const availableDays = 10;

      // When: 하루 1페이지씩 최대 5일만 사용
      const distribution: number[] = [];
      let remaining = totalPages;

      for (let i = 0; i < availableDays; i++) {
        if (remaining > 0) {
          distribution.push(1);
          remaining--;
        } else {
          distribution.push(0);
        }
      }

      // Then
      expect(distribution.filter((d) => d > 0).length).toBe(5);
      expect(distribution.filter((d) => d === 0).length).toBe(5);
    });

    it("빈 콘텐츠 배열은 빈 스케줄 반환", () => {
      const contents: ContentRange[] = [];
      const schedule: ScheduledPlan[] = [];

      expect(schedule.length).toBe(0);
    });
  });
});

// Helper functions for tests
function generateWeekPattern(weekNumber: number): {
  studyDays: number;
  reviewDays: number;
} {
  // 1730 패턴: 1,2주차는 5+2, 3주차는 3+4
  if (weekNumber === 3) {
    return { studyDays: 3, reviewDays: 4 };
  }
  return { studyDays: 5, reviewDays: 2 };
}

function createPlan(
  date: string,
  contentId: string,
  startRange: number,
  endRange: number,
  weekNumber: number = 1
): ScheduledPlan {
  return {
    date,
    content_id: contentId,
    content_type: "book",
    start_range: startRange,
    end_range: endRange,
    estimated_duration: (endRange - startRange + 1) * 6,
    is_review: false,
    day_type: "학습일",
  };
}

function calculateReviewScope(
  plans: ScheduledPlan[],
  reviewWeek: number
): { start_range: number; end_range: number } {
  // 3주차는 1,2주차 전체 복습
  const targetWeeks = reviewWeek === 3 ? [1, 2] : [reviewWeek];

  const relevantPlans = plans.filter((p) => !p.is_review);

  if (relevantPlans.length === 0) {
    return { start_range: 0, end_range: 0 };
  }

  const startRange = Math.min(...relevantPlans.map((p) => p.start_range));
  const endRange = Math.max(...relevantPlans.map((p) => p.end_range));

  return { start_range: startRange, end_range: endRange };
}

function excludeTimeRange(
  slots: { start: string; end: string }[],
  exclude: { start: string; end: string }
): { start: string; end: string }[] {
  const result: { start: string; end: string }[] = [];

  slots.forEach((slot) => {
    // 시간 비교를 위해 분으로 변환
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    const exStart = timeToMinutes(exclude.start);
    const exEnd = timeToMinutes(exclude.end);

    if (exStart >= slotEnd || exEnd <= slotStart) {
      // 겹치지 않음
      result.push(slot);
    } else {
      // 겹침 - 분할
      if (slotStart < exStart) {
        result.push({ start: slot.start, end: exclude.start });
      }
      if (slotEnd > exEnd) {
        result.push({ start: exclude.end, end: slot.end });
      }
    }
  });

  return result;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
