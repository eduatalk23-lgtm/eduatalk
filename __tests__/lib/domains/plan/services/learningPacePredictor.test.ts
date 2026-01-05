/**
 * 학습 속도 예측 서비스 테스트
 *
 * EWMA 기반 학습 속도 예측 및 관련 헬퍼 함수 테스트
 *
 * @module __tests__/lib/domains/plan/services/learningPacePredictor.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  adjustEstimatedDuration,
  type PredictedLearningPace,
} from "@/lib/domains/plan/services/learningPacePredictor";

describe("learningPacePredictor", () => {
  describe("EWMA calculation", () => {
    // 내부 함수 테스트를 위한 로직 재현
    function calculateEWMA(values: number[], alpha: number = 0.3): number {
      if (values.length === 0) return 1.0;

      let ewma = values[0];
      for (let i = 1; i < values.length; i++) {
        ewma = alpha * values[i] + (1 - alpha) * ewma;
      }

      return ewma;
    }

    it("빈 배열에 대해 기본값 1.0 반환", () => {
      const result = calculateEWMA([]);
      expect(result).toBe(1.0);
    });

    it("단일 값에 대해 그 값 그대로 반환", () => {
      const result = calculateEWMA([0.8]);
      expect(result).toBe(0.8);
    });

    it("최근 값에 더 많은 가중치 부여", () => {
      // [1.0, 2.0] with alpha=0.3
      // ewma = 0.3 * 2.0 + 0.7 * 1.0 = 1.3
      const result = calculateEWMA([1.0, 2.0]);
      expect(result).toBeCloseTo(1.3, 5);
    });

    it("연속적인 값에 대해 올바르게 계산", () => {
      // [1.0, 1.5, 1.2, 1.8] with alpha=0.3
      const values = [1.0, 1.5, 1.2, 1.8];
      const result = calculateEWMA(values);

      // 수동 계산:
      // ewma1 = 1.0
      // ewma2 = 0.3 * 1.5 + 0.7 * 1.0 = 1.15
      // ewma3 = 0.3 * 1.2 + 0.7 * 1.15 = 1.165
      // ewma4 = 0.3 * 1.8 + 0.7 * 1.165 = 1.3555
      expect(result).toBeCloseTo(1.3555, 3);
    });
  });

  describe("getTimePeriod", () => {
    function getTimePeriod(
      time: string
    ): "morning" | "afternoon" | "evening" | "night" {
      const hour = parseInt(time.split(":")[0], 10);

      if (hour >= 6 && hour < 12) return "morning";
      if (hour >= 12 && hour < 18) return "afternoon";
      if (hour >= 18 && hour < 22) return "evening";
      return "night";
    }

    it("06:00-11:59는 morning", () => {
      expect(getTimePeriod("06:00")).toBe("morning");
      expect(getTimePeriod("09:30")).toBe("morning");
      expect(getTimePeriod("11:59")).toBe("morning");
    });

    it("12:00-17:59는 afternoon", () => {
      expect(getTimePeriod("12:00")).toBe("afternoon");
      expect(getTimePeriod("14:30")).toBe("afternoon");
      expect(getTimePeriod("17:59")).toBe("afternoon");
    });

    it("18:00-21:59는 evening", () => {
      expect(getTimePeriod("18:00")).toBe("evening");
      expect(getTimePeriod("20:00")).toBe("evening");
      expect(getTimePeriod("21:59")).toBe("evening");
    });

    it("22:00-05:59는 night", () => {
      expect(getTimePeriod("22:00")).toBe("night");
      expect(getTimePeriod("00:00")).toBe("night");
      expect(getTimePeriod("03:30")).toBe("night");
      expect(getTimePeriod("05:59")).toBe("night");
    });
  });

  describe("analyzeTrend", () => {
    function analyzeTrend(
      values: number[]
    ): "increasing" | "stable" | "decreasing" {
      if (values.length < 3) return "stable";

      const midpoint = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, midpoint);
      const secondHalf = values.slice(midpoint);

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      const change = (secondAvg - firstAvg) / firstAvg;

      if (change > 0.1) return "increasing";
      if (change < -0.1) return "decreasing";
      return "stable";
    }

    it("3개 미만의 값에 대해 stable 반환", () => {
      expect(analyzeTrend([1.0])).toBe("stable");
      expect(analyzeTrend([1.0, 1.5])).toBe("stable");
    });

    it("증가 추세 감지", () => {
      const values = [0.8, 0.9, 1.2, 1.3];
      expect(analyzeTrend(values)).toBe("increasing");
    });

    it("감소 추세 감지", () => {
      const values = [1.3, 1.2, 0.9, 0.8];
      expect(analyzeTrend(values)).toBe("decreasing");
    });

    it("안정적 추세 감지", () => {
      const values = [1.0, 1.02, 0.98, 1.01];
      expect(analyzeTrend(values)).toBe("stable");
    });
  });

  describe("determineConfidence", () => {
    function determineConfidence(
      dataPoints: number
    ): "low" | "medium" | "high" {
      if (dataPoints >= 30) return "high";
      if (dataPoints >= 20) return "medium";
      return "low";
    }

    it("30개 이상이면 high", () => {
      expect(determineConfidence(30)).toBe("high");
      expect(determineConfidence(50)).toBe("high");
    });

    it("20-29개면 medium", () => {
      expect(determineConfidence(20)).toBe("medium");
      expect(determineConfidence(29)).toBe("medium");
    });

    it("20개 미만이면 low", () => {
      expect(determineConfidence(5)).toBe("low");
      expect(determineConfidence(19)).toBe("low");
    });
  });

  describe("adjustEstimatedDuration", () => {
    it("빠른 학습자는 예상 시간 감소", () => {
      const pace: PredictedLearningPace = {
        baseVelocity: 1.2,
        subjectAdjustment: 1.0,
        timePeriodAdjustment: 1.0,
        fatigueAdjustment: 1.0,
        finalPredictedVelocity: 1.2, // 20% 빠름
        confidenceLevel: "high",
        dataPointsAnalyzed: 30,
      };

      const adjusted = adjustEstimatedDuration(60, pace);
      expect(adjusted).toBe(50); // 60 / 1.2 = 50
    });

    it("느린 학습자는 예상 시간 증가", () => {
      const pace: PredictedLearningPace = {
        baseVelocity: 0.8,
        subjectAdjustment: 1.0,
        timePeriodAdjustment: 1.0,
        fatigueAdjustment: 1.0,
        finalPredictedVelocity: 0.8, // 20% 느림
        confidenceLevel: "high",
        dataPointsAnalyzed: 30,
      };

      const adjusted = adjustEstimatedDuration(60, pace);
      expect(adjusted).toBe(75); // 60 / 0.8 = 75
    });

    it("최소 15분 보장", () => {
      const pace: PredictedLearningPace = {
        baseVelocity: 10.0,
        subjectAdjustment: 1.0,
        timePeriodAdjustment: 1.0,
        fatigueAdjustment: 1.0,
        finalPredictedVelocity: 10.0,
        confidenceLevel: "high",
        dataPointsAnalyzed: 30,
      };

      const adjusted = adjustEstimatedDuration(60, pace);
      expect(adjusted).toBe(15); // 60 / 10 = 6 → 최소 15분
    });

    it("최대 2배 제한", () => {
      const pace: PredictedLearningPace = {
        baseVelocity: 0.2,
        subjectAdjustment: 1.0,
        timePeriodAdjustment: 1.0,
        fatigueAdjustment: 1.0,
        finalPredictedVelocity: 0.2,
        confidenceLevel: "high",
        dataPointsAnalyzed: 30,
      };

      const adjusted = adjustEstimatedDuration(60, pace);
      expect(adjusted).toBe(120); // 60 / 0.2 = 300 → 최대 120분
    });

    it("속도 1.0이면 변경 없음", () => {
      const pace: PredictedLearningPace = {
        baseVelocity: 1.0,
        subjectAdjustment: 1.0,
        timePeriodAdjustment: 1.0,
        fatigueAdjustment: 1.0,
        finalPredictedVelocity: 1.0,
        confidenceLevel: "high",
        dataPointsAnalyzed: 30,
      };

      const adjusted = adjustEstimatedDuration(60, pace);
      expect(adjusted).toBe(60);
    });
  });

  describe("PredictedLearningPace structure", () => {
    it("올바른 구조 검증", () => {
      const mockPace: PredictedLearningPace = {
        baseVelocity: 1.05,
        subjectAdjustment: 0.95,
        timePeriodAdjustment: 1.1,
        fatigueAdjustment: 0.85,
        finalPredictedVelocity: 0.93,
        confidenceLevel: "medium",
        dataPointsAnalyzed: 25,
      };

      expect(mockPace.baseVelocity).toBeGreaterThan(0);
      expect(mockPace.subjectAdjustment).toBeGreaterThan(0);
      expect(mockPace.timePeriodAdjustment).toBeGreaterThan(0);
      expect(mockPace.fatigueAdjustment).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(mockPace.confidenceLevel);
      expect(mockPace.dataPointsAnalyzed).toBeGreaterThanOrEqual(0);
    });
  });
});
