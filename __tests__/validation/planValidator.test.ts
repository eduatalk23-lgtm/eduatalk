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

  describe("경계값 테스트", () => {
    it("최소 시간 값 (00:00)", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "수면",
          start_time: "00:00",
          end_time: "00:01",
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("최대 시간 값 (23:59)", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "수면",
          start_time: "23:58",
          end_time: "23:59",
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("경계값 초과 시간 (24:00)", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "수면",
          start_time: "23:00",
          end_time: "24:00", // 잘못된 형식
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("경계값 초과 분 (60분)", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "12:00",
          end_time: "12:60", // 잘못된 형식
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("특수 문자 포함된 타입", () => {
      const blocks = [
        {
          type: "점심식사<script>alert('xss')</script>",
          start_time: "12:00",
          end_time: "13:00",
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      // 타입 검증에서 실패해야 함
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("특수 문자 포함된 시간 형식", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "12:00<script>",
          end_time: "13:00",
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("매우 긴 문자열 타입", () => {
      const longType = "점심식사".repeat(1000); // 약 3000자
      const blocks = [
        {
          type: longType,
          start_time: "12:00",
          end_time: "13:00",
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      // 타입 검증에서 실패해야 함 (유효한 타입이 아님)
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("매우 긴 description", () => {
      const longDescription = "설명".repeat(1000); // 약 2000자
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "점심식사",
          start_time: "12:00",
          end_time: "13:00",
          description: longDescription,
        },
      ];

      // description은 선택사항이므로 검증 통과해야 함
      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("매우 많은 블록 (100개)", () => {
      const blocks: NonStudyTimeBlock[] = [];
      for (let i = 0; i < 100; i++) {
        blocks.push({
          type: "기타",
          start_time: `${String(i % 24).padStart(2, "0")}:00`,
          end_time: `${String((i % 24) + 1).padStart(2, "0")}:00`,
        });
      }

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      // 중복 체크에서 실패할 수 있음
      // 하지만 시간이 다르므로 통과해야 함
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("요일 배열 최대값 (0-6)", () => {
      const blocks: NonStudyTimeBlock[] = [
        {
          type: "수면",
          start_time: "22:00",
          end_time: "07:00",
          day_of_week: [0, 1, 2, 3, 4, 5, 6], // 모든 요일
        },
      ];

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("요일 배열 경계값 초과 (7)", () => {
      const blocks = [
        {
          type: "수면",
          start_time: "22:00",
          end_time: "07:00",
          day_of_week: [0, 1, 2, 3, 4, 5, 6, 7], // 7은 유효하지 않음
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      // 검증 로직에 따라 실패할 수 있음
      // 실제 구현에 따라 다를 수 있음
      expect(result.valid).toBe(false);
    });

    it("요일 배열 음수값", () => {
      const blocks = [
        {
          type: "수면",
          start_time: "22:00",
          end_time: "07:00",
          day_of_week: [-1, 0, 1], // -1은 유효하지 않음
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      // 검증 로직에 따라 실패할 수 있음
      expect(result.valid).toBe(false);
    });

    it("빈 문자열 시간", () => {
      const blocks = [
        {
          type: "점심식사",
          start_time: "",
          end_time: "13:00",
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("공백만 있는 시간", () => {
      const blocks = [
        {
          type: "점심식사",
          start_time: "   ",
          end_time: "13:00",
        },
      ] as any;

      const result = PlanValidator.validateNonStudyTimeBlocks(blocks);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

