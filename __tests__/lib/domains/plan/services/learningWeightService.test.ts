/**
 * 학습 데이터 기반 추천 가중치 서비스 테스트
 *
 * 학습 이력 기반 가중치 계산 및 적용 기능 테스트
 *
 * @module __tests__/lib/domains/plan/services/learningWeightService.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getTimeSlotWeight,
  getSubjectWeight,
  applyLearningWeights,
  type LearningWeightResult,
} from "@/lib/domains/plan/services/learningWeightService";

describe("learningWeightService", () => {
  // 테스트용 mock 데이터
  const mockLearningWeights: LearningWeightResult = {
    studentId: "test-student-id",
    subjectWeights: [
      {
        subjectType: "math",
        weight: 1.2,
        completionRate: 85,
        avgDuration: 45,
        dataPoints: 15,
      },
      {
        subjectType: "english",
        weight: 0.8,
        completionRate: 60,
        avgDuration: 55,
        dataPoints: 12,
      },
      {
        subjectType: "science",
        weight: 1.0,
        completionRate: 75,
        avgDuration: 50,
        dataPoints: 2, // 데이터 부족
      },
    ],
    timeSlotWeights: [
      {
        hour: 9,
        dayOfWeek: "monday",
        weight: 1.3,
        completionRate: 90,
        dataPoints: 10,
      },
      {
        hour: 14,
        dayOfWeek: "wednesday",
        weight: 0.7,
        completionRate: 55,
        dataPoints: 8,
      },
      {
        hour: 19,
        dayOfWeek: "friday",
        weight: 1.1,
        completionRate: 80,
        dataPoints: 2, // 데이터 부족
      },
    ],
    dayOfWeekWeights: {
      sunday: 0.9,
      monday: 1.2,
      tuesday: 1.1,
      wednesday: 0.8,
      thursday: 1.0,
      friday: 1.0,
      saturday: 0.7,
    },
    overallEfficiency: 0.78,
    recommendedWorkload: 165,
    analyzedPlansCount: 45,
    period: {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    },
  };

  describe("normalizeWeight", () => {
    // 내부 함수 테스트를 위한 로직 재현
    function normalizeWeight(value: number, avg: number): number {
      if (avg === 0) return 1.0;
      const ratio = value / avg;
      return Math.max(0.5, Math.min(1.5, ratio));
    }

    it("평균이 0이면 기본값 1.0 반환", () => {
      expect(normalizeWeight(50, 0)).toBe(1.0);
    });

    it("값이 평균과 같으면 1.0 반환", () => {
      expect(normalizeWeight(80, 80)).toBe(1.0);
    });

    it("값이 평균보다 높으면 1.0 초과", () => {
      expect(normalizeWeight(100, 80)).toBe(1.25);
    });

    it("값이 평균보다 낮으면 1.0 미만", () => {
      expect(normalizeWeight(60, 80)).toBe(0.75);
    });

    it("최소값 0.5 보장", () => {
      expect(normalizeWeight(20, 80)).toBe(0.5); // 0.25 → 0.5
    });

    it("최대값 1.5 제한", () => {
      expect(normalizeWeight(160, 80)).toBe(1.5); // 2.0 → 1.5
    });
  });

  describe("calculateRecommendedWorkload", () => {
    function calculateRecommendedWorkload(
      avgCompletedMinutes: number,
      completionRate: number
    ): number {
      const adjustmentFactor =
        completionRate >= 80 ? 1.1 : completionRate >= 60 ? 1.0 : 0.9;
      return Math.round(avgCompletedMinutes * adjustmentFactor);
    }

    it("완료율 80% 이상이면 10% 증가", () => {
      expect(calculateRecommendedWorkload(100, 85)).toBe(110);
    });

    it("완료율 60-79%면 그대로 유지", () => {
      expect(calculateRecommendedWorkload(100, 70)).toBe(100);
    });

    it("완료율 60% 미만이면 10% 감소", () => {
      expect(calculateRecommendedWorkload(100, 50)).toBe(90);
    });
  });

  describe("getTimeSlotWeight", () => {
    it("데이터가 충분한 시간 슬롯의 가중치 반환", () => {
      const weight = getTimeSlotWeight(mockLearningWeights, 9, "monday");
      expect(weight).toBe(1.3);
    });

    it("데이터가 부족한 시간 슬롯은 요일 가중치 반환", () => {
      const weight = getTimeSlotWeight(mockLearningWeights, 19, "friday");
      // dataPoints < 3 이므로 dayOfWeekWeights["friday"] = 1.0 반환
      expect(weight).toBe(1.0);
    });

    it("일치하는 시간 슬롯 없으면 요일 가중치 반환", () => {
      const weight = getTimeSlotWeight(mockLearningWeights, 10, "tuesday");
      expect(weight).toBe(1.1); // dayOfWeekWeights["tuesday"]
    });

    it("일치하는 요일도 없으면 기본값 1.0 반환", () => {
      const emptyWeights: LearningWeightResult = {
        ...mockLearningWeights,
        timeSlotWeights: [],
        dayOfWeekWeights: {} as LearningWeightResult["dayOfWeekWeights"],
      };
      const weight = getTimeSlotWeight(emptyWeights, 10, "sunday");
      expect(weight).toBe(1.0);
    });
  });

  describe("getSubjectWeight", () => {
    it("데이터가 충분한 과목의 가중치 반환", () => {
      const weight = getSubjectWeight(mockLearningWeights, "math");
      expect(weight).toBe(1.2);
    });

    it("데이터가 부족한 과목은 기본값 1.0 반환", () => {
      const weight = getSubjectWeight(mockLearningWeights, "science");
      // dataPoints < 3 이므로 기본값 1.0 반환
      expect(weight).toBe(1.0);
    });

    it("일치하는 과목 없으면 기본값 1.0 반환", () => {
      const weight = getSubjectWeight(mockLearningWeights, "history");
      expect(weight).toBe(1.0);
    });
  });

  describe("applyLearningWeights", () => {
    it("시간 슬롯 가중치만 적용", () => {
      const adjusted = applyLearningWeights(100, mockLearningWeights, {
        hour: 9,
        dayOfWeek: "monday",
      });
      expect(adjusted).toBe(130); // 100 * 1.3
    });

    it("과목 가중치만 적용", () => {
      const adjusted = applyLearningWeights(100, mockLearningWeights, {
        subjectType: "math",
      });
      expect(adjusted).toBe(120); // 100 * 1.2
    });

    it("시간 슬롯과 과목 가중치 모두 적용", () => {
      const adjusted = applyLearningWeights(100, mockLearningWeights, {
        hour: 9,
        dayOfWeek: "monday",
        subjectType: "math",
      });
      expect(adjusted).toBe(156); // 100 * 1.3 * 1.2 = 156
    });

    it("옵션 없으면 원래 점수 그대로 반환", () => {
      const adjusted = applyLearningWeights(100, mockLearningWeights, {});
      expect(adjusted).toBe(100);
    });

    it("시간 슬롯이 없으면 요일 가중치 적용", () => {
      const adjusted = applyLearningWeights(100, mockLearningWeights, {
        hour: 10,
        dayOfWeek: "saturday",
      });
      expect(adjusted).toBe(70); // 100 * 0.7 (saturday weight)
    });
  });

  describe("LearningWeightResult structure", () => {
    it("올바른 구조 검증", () => {
      expect(mockLearningWeights.studentId).toBe("test-student-id");
      expect(mockLearningWeights.subjectWeights).toHaveLength(3);
      expect(mockLearningWeights.timeSlotWeights).toHaveLength(3);
      expect(Object.keys(mockLearningWeights.dayOfWeekWeights)).toHaveLength(7);
      expect(mockLearningWeights.overallEfficiency).toBeGreaterThan(0);
      expect(mockLearningWeights.overallEfficiency).toBeLessThanOrEqual(1);
      expect(mockLearningWeights.recommendedWorkload).toBeGreaterThan(0);
      expect(mockLearningWeights.analyzedPlansCount).toBeGreaterThan(0);
    });

    it("SubjectWeight 구조 검증", () => {
      const mathWeight = mockLearningWeights.subjectWeights.find(
        (s) => s.subjectType === "math"
      );
      expect(mathWeight).toBeDefined();
      expect(mathWeight!.weight).toBeGreaterThan(0);
      expect(mathWeight!.completionRate).toBeGreaterThanOrEqual(0);
      expect(mathWeight!.completionRate).toBeLessThanOrEqual(100);
      expect(mathWeight!.avgDuration).toBeGreaterThan(0);
      expect(mathWeight!.dataPoints).toBeGreaterThan(0);
    });

    it("TimeSlotWeight 구조 검증", () => {
      const mondaySlot = mockLearningWeights.timeSlotWeights.find(
        (s) => s.dayOfWeek === "monday"
      );
      expect(mondaySlot).toBeDefined();
      expect(mondaySlot!.hour).toBeGreaterThanOrEqual(0);
      expect(mondaySlot!.hour).toBeLessThanOrEqual(23);
      expect(mondaySlot!.weight).toBeGreaterThan(0);
      expect(mondaySlot!.completionRate).toBeGreaterThanOrEqual(0);
      expect(mondaySlot!.dataPoints).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("빈 데이터로 기본값 처리", () => {
      const emptyWeights: LearningWeightResult = {
        studentId: "empty-student",
        subjectWeights: [],
        timeSlotWeights: [],
        dayOfWeekWeights: {
          sunday: 1.0,
          monday: 1.0,
          tuesday: 1.0,
          wednesday: 1.0,
          thursday: 1.0,
          friday: 1.0,
          saturday: 1.0,
        },
        overallEfficiency: 1.0,
        recommendedWorkload: 180,
        analyzedPlansCount: 0,
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      expect(getSubjectWeight(emptyWeights, "any")).toBe(1.0);
      expect(getTimeSlotWeight(emptyWeights, 10, "monday")).toBe(1.0);
      expect(applyLearningWeights(100, emptyWeights, {})).toBe(100);
    });

    it("극단적인 가중치 값 처리", () => {
      const extremeWeights: LearningWeightResult = {
        ...mockLearningWeights,
        subjectWeights: [
          {
            subjectType: "extreme",
            weight: 1.5, // 최대값
            completionRate: 100,
            avgDuration: 30,
            dataPoints: 50,
          },
        ],
      };

      const adjusted = applyLearningWeights(100, extremeWeights, {
        subjectType: "extreme",
      });
      expect(adjusted).toBe(150);
    });

    it("복합 가중치 계산 정확도", () => {
      // 1.3 * 1.2 = 1.56 → 반올림하여 156
      const adjusted = applyLearningWeights(100, mockLearningWeights, {
        hour: 9,
        dayOfWeek: "monday",
        subjectType: "math",
      });
      expect(adjusted).toBe(156);
    });
  });

  describe("요일별 가중치", () => {
    it("모든 요일이 정의되어 있어야 함", () => {
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ] as const;

      for (const day of days) {
        expect(mockLearningWeights.dayOfWeekWeights[day]).toBeDefined();
        expect(mockLearningWeights.dayOfWeekWeights[day]).toBeGreaterThan(0);
      }
    });

    it("주말 가중치가 낮게 설정됨", () => {
      expect(mockLearningWeights.dayOfWeekWeights.saturday).toBeLessThan(1.0);
      expect(mockLearningWeights.dayOfWeekWeights.sunday).toBeLessThan(1.0);
    });
  });
});
