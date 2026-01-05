/**
 * 피로도 모델링 서비스 테스트
 *
 * @module __tests__/lib/domains/plan/services/fatigueModelingService.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  suggestRestDays,
  adjustLearningIntensity,
  generateFatigueWarnings,
  type FatigueMetrics,
} from "@/lib/domains/plan/services/fatigueModelingService";

describe("fatigueModelingService", () => {
  describe("suggestRestDays", () => {
    it("휴식이 필요 없는 경우 빈 배열 반환", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 3,
        averageDailyMinutes: 120,
        fatigueScore: 30,
        intensityLevel: "low",
        recommendedRestDays: 0,
        suggestedIntensityAdjustment: 1.15,
        analyzedDays: 7,
        weeklyTrendPercent: 0,
      };

      const plannedDates = ["2025-01-06", "2025-01-07", "2025-01-08"];
      const suggestions = suggestRestDays(metrics, plannedDates);

      expect(suggestions).toHaveLength(0);
    });

    it("피로도 80 이상이면 첫 번째 날에 즉시 휴식 권장", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 10,
        averageDailyMinutes: 240,
        fatigueScore: 85,
        intensityLevel: "overload",
        recommendedRestDays: 1,
        suggestedIntensityAdjustment: 0.5,
        analyzedDays: 14,
        weeklyTrendPercent: 20,
      };

      const plannedDates = [
        "2025-01-06",
        "2025-01-07",
        "2025-01-08",
        "2025-01-09",
      ];
      const suggestions = suggestRestDays(metrics, plannedDates);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].date).toBe("2025-01-06");
      expect(suggestions[0].priority).toBe("high");
    });

    it("피로도 60-79이면 3일 내 휴식 권장", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 5,
        averageDailyMinutes: 180,
        fatigueScore: 65,
        intensityLevel: "medium",
        recommendedRestDays: 1,
        suggestedIntensityAdjustment: 0.85,
        analyzedDays: 10,
        weeklyTrendPercent: 10,
      };

      const plannedDates = [
        "2025-01-06",
        "2025-01-07",
        "2025-01-08",
        "2025-01-09",
      ];
      const suggestions = suggestRestDays(metrics, plannedDates);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].date).toBe("2025-01-08"); // 3일차
      expect(suggestions[0].priority).toBe("medium");
    });

    it("14일 이상 연속 학습 시 추가 휴식일 제안", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 14,
        averageDailyMinutes: 150,
        fatigueScore: 75,
        intensityLevel: "high",
        recommendedRestDays: 2,
        suggestedIntensityAdjustment: 0.7,
        analyzedDays: 14,
        weeklyTrendPercent: 5,
      };

      const plannedDates = Array.from({ length: 10 }, (_, i) => {
        const date = new Date("2025-01-06");
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const suggestions = suggestRestDays(metrics, plannedDates);

      // 피로도 높음으로 첫 휴식 + 연속 학습으로 추가 휴식
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it("빈 날짜 배열에 대해 빈 결과 반환", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 10,
        averageDailyMinutes: 200,
        fatigueScore: 80,
        intensityLevel: "overload",
        recommendedRestDays: 1,
        suggestedIntensityAdjustment: 0.5,
        analyzedDays: 10,
        weeklyTrendPercent: 15,
      };

      const suggestions = suggestRestDays(metrics, []);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe("adjustLearningIntensity", () => {
    it("피로도 낮음이면 학습량 증가 가능", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 2,
        averageDailyMinutes: 100,
        fatigueScore: 25,
        intensityLevel: "low",
        recommendedRestDays: 0,
        suggestedIntensityAdjustment: 1.15,
        analyzedDays: 7,
        weeklyTrendPercent: -5,
      };

      const adjusted = adjustLearningIntensity(60, metrics);

      expect(adjusted).toBe(69); // 60 * 1.15 = 69
    });

    it("피로도 높음이면 학습량 30% 감소", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 8,
        averageDailyMinutes: 200,
        fatigueScore: 75,
        intensityLevel: "high",
        recommendedRestDays: 1,
        suggestedIntensityAdjustment: 0.7,
        analyzedDays: 14,
        weeklyTrendPercent: 15,
      };

      const adjusted = adjustLearningIntensity(60, metrics);

      expect(adjusted).toBe(42); // 60 * 0.7 = 42
    });

    it("피로도 과부하면 학습량 50% 감소", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 12,
        averageDailyMinutes: 250,
        fatigueScore: 90,
        intensityLevel: "overload",
        recommendedRestDays: 2,
        suggestedIntensityAdjustment: 0.5,
        analyzedDays: 14,
        weeklyTrendPercent: 25,
      };

      const adjusted = adjustLearningIntensity(60, metrics);

      expect(adjusted).toBe(30); // 60 * 0.5 = 30
    });

    it("피로도 중간이면 학습량 15% 감소", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 5,
        averageDailyMinutes: 150,
        fatigueScore: 55,
        intensityLevel: "medium",
        recommendedRestDays: 1,
        suggestedIntensityAdjustment: 0.85,
        analyzedDays: 10,
        weeklyTrendPercent: 10,
      };

      const adjusted = adjustLearningIntensity(60, metrics);

      expect(adjusted).toBe(51); // 60 * 0.85 = 51
    });
  });

  describe("generateFatigueWarnings", () => {
    it("피로도 과부하 시 즉시 휴식 경고 생성", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 10,
        averageDailyMinutes: 300,
        fatigueScore: 90,
        intensityLevel: "overload",
        recommendedRestDays: 2,
        suggestedIntensityAdjustment: 0.5,
        analyzedDays: 14,
        weeklyTrendPercent: 20,
      };

      const warnings = generateFatigueWarnings(metrics);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes("매우 높습니다"))).toBe(true);
    });

    it("14일 이상 연속 학습 시 휴식 필요 경고", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 14,
        averageDailyMinutes: 150,
        fatigueScore: 60,
        intensityLevel: "medium",
        recommendedRestDays: 1,
        suggestedIntensityAdjustment: 0.85,
        analyzedDays: 14,
        weeklyTrendPercent: 0,
      };

      const warnings = generateFatigueWarnings(metrics);

      expect(warnings.some((w) => w.includes("14일 연속"))).toBe(true);
      expect(warnings.some((w) => w.includes("충분한 휴식"))).toBe(true);
    });

    it("7-13일 연속 학습 시 휴식일 계획 권장", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 8,
        averageDailyMinutes: 120,
        fatigueScore: 45,
        intensityLevel: "low",
        recommendedRestDays: 0,
        suggestedIntensityAdjustment: 1.0,
        analyzedDays: 10,
        weeklyTrendPercent: 5,
      };

      const warnings = generateFatigueWarnings(metrics);

      expect(warnings.some((w) => w.includes("8일 연속"))).toBe(true);
      expect(warnings.some((w) => w.includes("휴식일을 계획"))).toBe(true);
    });

    it("과도한 학습량 경고", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 3,
        averageDailyMinutes: 300, // 5시간, 목표 3시간의 1.5배 초과
        fatigueScore: 50,
        intensityLevel: "medium",
        recommendedRestDays: 0,
        suggestedIntensityAdjustment: 0.85,
        analyzedDays: 7,
        weeklyTrendPercent: 10,
      };

      const warnings = generateFatigueWarnings(metrics);

      expect(warnings.some((w) => w.includes("학습량이 많습니다"))).toBe(true);
    });

    it("피로도 낮고 연속 학습일 짧으면 경고 없음", () => {
      const metrics: FatigueMetrics = {
        consecutiveDays: 3,
        averageDailyMinutes: 100,
        fatigueScore: 25,
        intensityLevel: "low",
        recommendedRestDays: 0,
        suggestedIntensityAdjustment: 1.15,
        analyzedDays: 7,
        weeklyTrendPercent: 0,
      };

      const warnings = generateFatigueWarnings(metrics);

      expect(warnings).toHaveLength(0);
    });
  });
});
