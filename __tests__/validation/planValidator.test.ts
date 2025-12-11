/**
 * non_study_time_blocks 검증 단위 테스트
 */

import { describe, it, expect } from "vitest";
import { PlanValidator } from "@/lib/validation/planValidator";
import type { NonStudyTimeBlock } from "@/lib/types/plan";

describe("PlanValidator.validateNonStudyTimeBlocks", () => {
  describe("정상 케이스", () => {
    it("null 또는 undefined는 유효", () => {
      const result1 = PlanValidator.validateNonStudyTimeBlocks(null);
      expect(result1.valid).toBe(true);
      expect(result1.errors).toHaveLength(0);

      const result2 = PlanValidator.validateNonStudyTimeBlocks(undefined);
      expect(result2.valid).toBe(true);
      expect(result2.errors).toHaveLength(0);
    });

    it("빈 배열은 유효", () => {
      const result = PlanValidator.validateNonStudyTimeBlocks([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("유효한 시간 블록", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "12:00",
          end_time: "13:00",
        },
        {
          type: "수면",
          start_time: "22:00",
          end_time: "07:00",
          day_of_week: [0, 1, 2, 3, 4, 5, 6],
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("요일별 시간 블록", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "아침식사",
          start_time: "07:00",
          end_time: "08:00",
          day_of_week: [1, 2, 3, 4, 5], // 평일만
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("시간 형식 검증", () => {
    it("잘못된 시작 시간 형식", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "25:00", // 잘못된 형식
          end_time: "13:00",
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("HH:mm"))).toBe(true);
    });

    it("잘못된 종료 시간 형식", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "12:00",
          end_time: "13:60", // 잘못된 형식
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("HH:mm"))).toBe(true);
    });

    it("시간 형식이 문자열이 아님", () => {
      const blocks = [
        {
          type: "점심식사",
          start_time: 1200, // 숫자
          end_time: "13:00",
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("시간 범위 검증", () => {
    it("시작 시간이 종료 시간보다 늦음", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "13:00",
          end_time: "12:00", // 시작 시간보다 이전
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.includes("시작 시간이 종료 시간보다 이전"))
      ).toBe(true);
    });

    it("시작 시간과 종료 시간이 같음", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "12:00",
          end_time: "12:00", // 같은 시간
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("중복 체크", () => {
    it("동일한 시간 블록 중복", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "12:00",
          end_time: "13:00",
        },
        {
          type: "저녁식사",
          start_time: "12:00", // 중복
          end_time: "13:00",
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.includes("중복된 시간 블록"))
      ).toBe(true);
    });

    it("요일별 중복 체크", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "아침식사",
          start_time: "07:00",
          end_time: "08:00",
          day_of_week: [1, 2, 3], // 월화수
        },
        {
          type: "저녁식사",
          start_time: "07:00", // 같은 시간, 같은 요일
          end_time: "08:00",
          day_of_week: [1, 2, 3], // 월화수
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("다른 요일이면 중복 아님", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "아침식사",
          start_time: "07:00",
          end_time: "08:00",
          day_of_week: [1, 2, 3], // 월화수
        },
        {
          type: "저녁식사",
          start_time: "07:00", // 같은 시간이지만
          end_time: "08:00",
          day_of_week: [4, 5, 6], // 목금토 - 다른 요일
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("타입 검증", () => {
    it("유효하지 않은 타입", () => {
      const blocks = [
        {
          type: "잘못된타입",
          start_time: "12:00",
          end_time: "13:00",
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

