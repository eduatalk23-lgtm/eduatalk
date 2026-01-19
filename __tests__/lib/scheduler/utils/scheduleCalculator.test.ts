/**
 * Schedule Calculator 단위 테스트
 *
 * @module __tests__/lib/scheduler/utils/scheduleCalculator.test
 */

import { describe, it, expect } from "vitest";
import { calculateAvailableDateStrings } from "@/lib/scheduler/utils/scheduleCalculator";

describe("scheduleCalculator", () => {
  describe("calculateAvailableDateStrings", () => {
    it("기간 내 모든 날짜를 반환해야 함", () => {
      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-01-05",
        []
      );

      expect(result).toEqual([
        "2024-01-01",
        "2024-01-02",
        "2024-01-03",
        "2024-01-04",
        "2024-01-05",
      ]);
    });

    it("제외일을 제외하고 반환해야 함", () => {
      const exclusions = [
        { exclusion_date: "2024-01-02" },
        { exclusion_date: "2024-01-04" },
      ];

      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-01-05",
        exclusions
      );

      expect(result).toEqual([
        "2024-01-01",
        "2024-01-03",
        "2024-01-05",
      ]);
    });

    it("시간 정보가 포함된 제외일도 처리해야 함", () => {
      const exclusions = [
        { exclusion_date: "2024-01-02T00:00:00.000Z" },
        { exclusion_date: "2024-01-04T12:30:00.000Z" },
      ];

      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-01-05",
        exclusions
      );

      expect(result).toEqual([
        "2024-01-01",
        "2024-01-03",
        "2024-01-05",
      ]);
    });

    it("단일 날짜 기간을 처리해야 함", () => {
      const result = calculateAvailableDateStrings(
        "2024-01-15",
        "2024-01-15",
        []
      );

      expect(result).toEqual(["2024-01-15"]);
    });

    it("단일 날짜가 제외되면 빈 배열을 반환해야 함", () => {
      const exclusions = [{ exclusion_date: "2024-01-15" }];

      const result = calculateAvailableDateStrings(
        "2024-01-15",
        "2024-01-15",
        exclusions
      );

      expect(result).toEqual([]);
    });

    it("모든 날짜가 제외되면 빈 배열을 반환해야 함", () => {
      const exclusions = [
        { exclusion_date: "2024-01-01" },
        { exclusion_date: "2024-01-02" },
        { exclusion_date: "2024-01-03" },
      ];

      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-01-03",
        exclusions
      );

      expect(result).toEqual([]);
    });

    it("기간 외 제외일은 무시해야 함", () => {
      const exclusions = [
        { exclusion_date: "2023-12-31" }, // 기간 이전
        { exclusion_date: "2024-01-10" }, // 기간 이후
      ];

      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-01-03",
        exclusions
      );

      expect(result).toEqual([
        "2024-01-01",
        "2024-01-02",
        "2024-01-03",
      ]);
    });

    it("월을 넘어가는 기간을 처리해야 함", () => {
      const result = calculateAvailableDateStrings(
        "2024-01-30",
        "2024-02-02",
        []
      );

      expect(result).toEqual([
        "2024-01-30",
        "2024-01-31",
        "2024-02-01",
        "2024-02-02",
      ]);
    });

    it("연도를 넘어가는 기간을 처리해야 함", () => {
      const result = calculateAvailableDateStrings(
        "2023-12-30",
        "2024-01-02",
        []
      );

      expect(result).toEqual([
        "2023-12-30",
        "2023-12-31",
        "2024-01-01",
        "2024-01-02",
      ]);
    });

    it("윤년 2월을 올바르게 처리해야 함", () => {
      // 2024는 윤년
      const result = calculateAvailableDateStrings(
        "2024-02-28",
        "2024-03-01",
        []
      );

      expect(result).toEqual([
        "2024-02-28",
        "2024-02-29",
        "2024-03-01",
      ]);
    });

    it("빈 제외일 배열을 처리해야 함", () => {
      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-01-03",
        []
      );

      expect(result).toHaveLength(3);
    });

    it("중복 제외일을 올바르게 처리해야 함", () => {
      const exclusions = [
        { exclusion_date: "2024-01-02" },
        { exclusion_date: "2024-01-02" }, // 중복
        { exclusion_date: "2024-01-02" }, // 중복
      ];

      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-01-03",
        exclusions
      );

      expect(result).toEqual([
        "2024-01-01",
        "2024-01-03",
      ]);
    });

    it("긴 기간을 처리할 수 있어야 함", () => {
      const result = calculateAvailableDateStrings(
        "2024-01-01",
        "2024-12-31",
        []
      );

      // 2024년은 윤년이므로 366일
      expect(result).toHaveLength(366);
      expect(result[0]).toBe("2024-01-01");
      expect(result[365]).toBe("2024-12-31");
    });
  });
});
