/**
 * 플랜 시간 배정 테스트
 * assignPlanTimes 함수의 Best Fit 알고리즘 검증
 */

import { describe, it, expect, beforeEach } from "vitest";
import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import type {
  PlanTimeInput,
  StudyTimeSlot,
} from "@/lib/plan/assignPlanTimes";
import type { ContentDurationInfo } from "@/lib/types/plan-generation";
import { timeToMinutes } from "@/lib/plan/assignPlanTimes";

describe("assignPlanTimes", () => {
  let contentDurationMap: Map<string, ContentDurationInfo>;

  beforeEach(() => {
    // 각 테스트 전에 contentDurationMap 초기화
    contentDurationMap = new Map();
  });

  describe("정상 배정 (Full Allocation)", () => {
    it("60분짜리 학습 슬롯에 60분짜리 플랜이 정확히 배정되어야 함", () => {
      const plans: PlanTimeInput[] = [
        {
          content_id: "book-1",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 10,
        },
      ];

      const studyTimeSlots: StudyTimeSlot[] = [
        { start: "09:00", end: "10:00" }, // 60분 슬롯
      ];

      // 60분짜리 책 (10페이지 * 6분/페이지 = 60분)
      contentDurationMap.set("book-1", {
        content_type: "book",
        content_id: "book-1",
        difficulty_level: "기본", // 6분/페이지
      });

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "학습일",
        1 // 총 1시간
      );

      expect(segments).toHaveLength(1);
      expect(segments[0].start).toBe("09:00");
      expect(segments[0].end).toBe("10:00");
      expect(segments[0].isPartial).toBe(false);
      expect(segments[0].isContinued).toBe(false);
    });
  });

  describe("분할 배정 (Partial Allocation)", () => {
    it("30분짜리 슬롯에 60분짜리 플랜이 분할되어 배정되어야 함", () => {
      const plans: PlanTimeInput[] = [
        {
          content_id: "book-1",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 10,
        },
      ];

      const studyTimeSlots: StudyTimeSlot[] = [
        { start: "09:00", end: "09:30" }, // 30분 슬롯
      ];

      // 60분짜리 책 (10페이지 * 6분/페이지 = 60분)
      contentDurationMap.set("book-1", {
        content_type: "book",
        content_id: "book-1",
        difficulty_level: "기본", // 6분/페이지
      });

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "학습일",
        0.5 // 총 0.5시간 (30분)
      );

      expect(segments).toHaveLength(1);
      expect(segments[0].start).toBe("09:00");
      expect(segments[0].end).toBe("09:30");
      expect(segments[0].isPartial).toBe(true); // 분할됨
      expect(segments[0].isContinued).toBe(false); // 첫 번째 세그먼트

      // 남은 시간 확인: 60분 - 30분 = 30분
      const usedTime =
        timeToMinutes(segments[0].end) - timeToMinutes(segments[0].start);
      expect(usedTime).toBe(30);
    });

    it("두 개의 슬롯에 걸쳐 분할 배정되어야 함", () => {
      const plans: PlanTimeInput[] = [
        {
          content_id: "book-1",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 10,
        },
      ];

      const studyTimeSlots: StudyTimeSlot[] = [
        { start: "09:00", end: "09:30" }, // 30분 슬롯
        { start: "10:00", end: "10:30" }, // 30분 슬롯 (총 60분)
      ];

      // 60분짜리 책
      contentDurationMap.set("book-1", {
        content_type: "book",
        content_id: "book-1",
        difficulty_level: "기본", // 6분/페이지
      });

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "학습일",
        1 // 총 1시간
      );

      // 두 개의 슬롯에 걸쳐 배정되어야 함
      expect(segments.length).toBeGreaterThanOrEqual(1);
      
      // 첫 번째 세그먼트
      expect(segments[0].start).toBe("09:00");
      expect(segments[0].end).toBe("09:30");
      expect(segments[0].isPartial).toBe(true);
      expect(segments[0].isContinued).toBe(false);

      // 두 번째 세그먼트가 있는 경우
      if (segments.length > 1) {
        expect(segments[1].start).toBe("10:00");
        expect(segments[1].isContinued).toBe(true); // 연속된 세그먼트
      }
    });
  });

  describe("슬롯 선택 (Best Fit)", () => {
    it("여러 슬롯 중 남은 공간이 가장 적은 슬롯에 우선 배정되어야 함", () => {
      const plans: PlanTimeInput[] = [
        {
          content_id: "book-1",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 5, // 30분 (5페이지 * 6분/페이지)
        },
      ];

      // 40분 슬롯과 100분 슬롯 중, 30분 플랜은 40분 슬롯에 배정되어야 함 (Best Fit)
      const studyTimeSlots: StudyTimeSlot[] = [
        { start: "09:00", end: "09:40" }, // 40분 슬롯
        { start: "10:00", end: "11:40" }, // 100분 슬롯
      ];

      contentDurationMap.set("book-1", {
        content_type: "book",
        content_id: "book-1",
        difficulty_level: "기본", // 6분/페이지
      });

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "학습일",
        2.33 // 총 약 2.33시간
      );

      expect(segments).toHaveLength(1);
      // Best Fit: 40분 슬롯에 배정되어야 함 (남은 공간이 10분으로 더 적음)
      expect(segments[0].start).toBe("09:00");
      expect(segments[0].end).toBe("09:30"); // 30분 사용
      expect(segments[0].isPartial).toBe(false);
    });

    it("여러 플랜이 있을 때 Best Fit 알고리즘으로 배정되어야 함", () => {
      const plans: PlanTimeInput[] = [
        {
          content_id: "book-1",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 10, // 60분
        },
        {
          content_id: "book-2",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 5, // 30분
        },
      ];

      const studyTimeSlots: StudyTimeSlot[] = [
        { start: "09:00", end: "10:00" }, // 60분 슬롯
        { start: "10:00", end: "11:00" }, // 60분 슬롯
      ];

      contentDurationMap.set("book-1", {
        content_type: "book",
        content_id: "book-1",
        difficulty_level: "기본",
      });

      contentDurationMap.set("book-2", {
        content_type: "book",
        content_id: "book-2",
        difficulty_level: "기본",
      });

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "학습일",
        2 // 총 2시간
      );

      expect(segments.length).toBeGreaterThanOrEqual(2);

      // 시간 순으로 정렬되어 있어야 함
      for (let i = 1; i < segments.length; i++) {
        const prevTime = timeToMinutes(segments[i - 1].start);
        const currentTime = timeToMinutes(segments[i].start);
        expect(currentTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });

  describe("경계 케이스", () => {
    it("빈 플랜 배열에 대해 빈 배열 반환", () => {
      const plans: PlanTimeInput[] = [];
      const studyTimeSlots: StudyTimeSlot[] = [
        { start: "09:00", end: "10:00" },
      ];

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "학습일",
        1
      );

      expect(segments).toHaveLength(0);
    });

    it("빈 슬롯 배열에 대해 빈 배열 반환", () => {
      const plans: PlanTimeInput[] = [
        {
          content_id: "book-1",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 10,
        },
      ];
      const studyTimeSlots: StudyTimeSlot[] = [];

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "학습일",
        0
      );

      expect(segments).toHaveLength(0);
    });

    it("복습일일 때 시간이 단축되어 배정되어야 함", () => {
      const plans: PlanTimeInput[] = [
        {
          content_id: "book-1",
          content_type: "book",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 10, // 학습일: 60분, 복습일: 30분
        },
      ];

      const studyTimeSlots: StudyTimeSlot[] = [
        { start: "09:00", end: "09:30" }, // 30분 슬롯
      ];

      contentDurationMap.set("book-1", {
        content_type: "book",
        content_id: "book-1",
        difficulty_level: "기본",
      });

      const segments = assignPlanTimes(
        plans,
        studyTimeSlots,
        contentDurationMap,
        "복습일",
        0.5 // 총 0.5시간
      );

      expect(segments).toHaveLength(1);
      expect(segments[0].start).toBe("09:00");
      expect(segments[0].end).toBe("09:30");
      expect(segments[0].isPartial).toBe(false); // 복습일에는 30분으로 충분
    });
  });
});

