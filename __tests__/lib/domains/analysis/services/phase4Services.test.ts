/**
 * Phase 4 Services Unit Tests
 * 학습 패턴 예측 및 조기 경고 시스템 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Phase 4.1: Prediction Service Tests
// ============================================================================

describe("PredictionService", () => {
  describe("Type Exports", () => {
    it("should export PredictionType type", async () => {
      const { PredictionService } = await import(
        "@/lib/domains/analysis/services/predictionService"
      );
      expect(PredictionService).toBeDefined();
    });

    it("should export convenience functions", async () => {
      const {
        predictWeeklyPerformance,
        predictBurnoutRisk,
        predictSubjectStruggle,
        runAllPredictions,
      } = await import("@/lib/domains/analysis/services/predictionService");

      expect(typeof predictWeeklyPerformance).toBe("function");
      expect(typeof predictBurnoutRisk).toBe("function");
      expect(typeof predictSubjectStruggle).toBe("function");
      expect(typeof runAllPredictions).toBe("function");
    });
  });

  describe("PredictionService Class", () => {
    it("should be instantiable with tenantId", async () => {
      const { PredictionService } = await import(
        "@/lib/domains/analysis/services/predictionService"
      );

      const service = new PredictionService("tenant-1");
      expect(service).toBeDefined();
      expect(typeof service.predictWeeklyPerformance).toBe("function");
      expect(typeof service.predictBurnoutRisk).toBe("function");
      expect(typeof service.predictSubjectStruggle).toBe("function");
      expect(typeof service.runAllPredictions).toBe("function");
      expect(typeof service.extractFeatures).toBe("function");
      expect(typeof service.savePrediction).toBe("function");
    });
  });
});

// ============================================================================
// Phase 4.2: Early Warning Service Tests
// ============================================================================

describe("EarlyWarningService", () => {
  describe("Type Exports", () => {
    it("should export EarlyWarningService", async () => {
      const { EarlyWarningService } = await import(
        "@/lib/domains/analysis/services/earlyWarningService"
      );
      expect(EarlyWarningService).toBeDefined();
    });

    it("should export convenience functions", async () => {
      const {
        detectWarnings,
        getUnresolvedWarnings,
        acknowledgeWarning,
        resolveWarning,
        getWarningStats,
      } = await import("@/lib/domains/analysis/services/earlyWarningService");

      expect(typeof detectWarnings).toBe("function");
      expect(typeof getUnresolvedWarnings).toBe("function");
      expect(typeof acknowledgeWarning).toBe("function");
      expect(typeof resolveWarning).toBe("function");
      expect(typeof getWarningStats).toBe("function");
    });

    it("should export label constants", async () => {
      const {
        WARNING_TYPE_LABELS,
        SEVERITY_LABELS,
        SEVERITY_COLORS,
      } = await import("@/lib/domains/analysis/services/earlyWarningService");

      expect(WARNING_TYPE_LABELS).toBeDefined();
      expect(WARNING_TYPE_LABELS.completion_drop).toBe("완수율 급락");
      expect(WARNING_TYPE_LABELS.burnout_risk).toBe("번아웃 위험");

      expect(SEVERITY_LABELS).toBeDefined();
      expect(SEVERITY_LABELS.critical).toBe("심각");
      expect(SEVERITY_LABELS.high).toBe("높음");
      expect(SEVERITY_LABELS.medium).toBe("보통");
      expect(SEVERITY_LABELS.low).toBe("낮음");

      expect(SEVERITY_COLORS).toBeDefined();
      expect(SEVERITY_COLORS.critical).toContain("red");
    });
  });

  describe("EarlyWarningService Class", () => {
    it("should be instantiable with tenantId", async () => {
      const { EarlyWarningService } = await import(
        "@/lib/domains/analysis/services/earlyWarningService"
      );

      const service = new EarlyWarningService("tenant-1");
      expect(service).toBeDefined();
      expect(typeof service.detectWarnings).toBe("function");
      expect(typeof service.getUnresolvedWarnings).toBe("function");
      expect(typeof service.acknowledgeWarning).toBe("function");
      expect(typeof service.resolveWarning).toBe("function");
      expect(typeof service.recordAction).toBe("function");
      expect(typeof service.getWarningStats).toBe("function");
    });
  });

  describe("Warning Types", () => {
    it("should have all warning types defined", async () => {
      const { WARNING_TYPE_LABELS } = await import(
        "@/lib/domains/analysis/services/earlyWarningService"
      );

      const expectedTypes = [
        "completion_drop",
        "streak_break",
        "subject_struggle",
        "burnout_risk",
        "schedule_overload",
        "exam_unpreparedness",
      ];

      for (const type of expectedTypes) {
        expect(WARNING_TYPE_LABELS[type as keyof typeof WARNING_TYPE_LABELS]).toBeDefined();
      }
    });
  });
});

// ============================================================================
// Phase 4.3: Adaptive Rescheduling Service Tests
// ============================================================================

describe("AdaptiveReschedulingService", () => {
  describe("Type Exports", () => {
    it("should export AdaptiveReschedulingService", async () => {
      const { AdaptiveReschedulingService } = await import(
        "@/lib/domains/analysis/services/adaptiveReschedulingService"
      );
      expect(AdaptiveReschedulingService).toBeDefined();
    });

    it("should export convenience functions", async () => {
      const {
        analyzeAndRecommendReschedule,
        autoRescheduleIncomplete,
        applyRescheduleRecommendation,
      } = await import(
        "@/lib/domains/analysis/services/adaptiveReschedulingService"
      );

      expect(typeof analyzeAndRecommendReschedule).toBe("function");
      expect(typeof autoRescheduleIncomplete).toBe("function");
      expect(typeof applyRescheduleRecommendation).toBe("function");
    });

    it("should export label constants", async () => {
      const {
        RESCHEDULE_REASON_LABELS,
        IMPACT_LABELS,
        DAY_NAMES,
        DAY_NAMES_EN,
      } = await import(
        "@/lib/domains/analysis/services/adaptiveReschedulingService"
      );

      expect(RESCHEDULE_REASON_LABELS).toBeDefined();
      expect(RESCHEDULE_REASON_LABELS.low_day_performance).toBe("저성과 요일");
      expect(RESCHEDULE_REASON_LABELS.consecutive_subject).toBe("동일 과목 연속");
      expect(RESCHEDULE_REASON_LABELS.overload).toBe("과부하");

      expect(IMPACT_LABELS).toBeDefined();
      expect(IMPACT_LABELS.high).toBe("높음");

      expect(DAY_NAMES).toBeDefined();
      expect(DAY_NAMES[0]).toBe("일");
      expect(DAY_NAMES[1]).toBe("월");

      expect(DAY_NAMES_EN).toBeDefined();
      expect(DAY_NAMES_EN[0]).toBe("sun");
      expect(DAY_NAMES_EN[1]).toBe("mon");
    });
  });

  describe("AdaptiveReschedulingService Class", () => {
    it("should be instantiable with tenantId", async () => {
      const { AdaptiveReschedulingService } = await import(
        "@/lib/domains/analysis/services/adaptiveReschedulingService"
      );

      const service = new AdaptiveReschedulingService("tenant-1");
      expect(service).toBeDefined();
      expect(typeof service.analyzeAndRecommend).toBe("function");
      expect(typeof service.autoRescheduleIncomplete).toBe("function");
      expect(typeof service.applyRecommendation).toBe("function");
      expect(typeof service.applyRecommendations).toBe("function");
    });
  });

  describe("Reschedule Reason Types", () => {
    it("should have all reason types defined", async () => {
      const { RESCHEDULE_REASON_LABELS } = await import(
        "@/lib/domains/analysis/services/adaptiveReschedulingService"
      );

      const expectedTypes = [
        "low_day_performance",
        "consecutive_subject",
        "overload",
        "underload",
        "time_preference",
        "incomplete_pattern",
      ];

      for (const type of expectedTypes) {
        expect(
          RESCHEDULE_REASON_LABELS[type as keyof typeof RESCHEDULE_REASON_LABELS]
        ).toBeDefined();
      }
    });
  });
});

// ============================================================================
// Domain Index Exports Tests
// ============================================================================

describe("Analysis Domain Index Exports", () => {
  it("should export all Phase 4.1 prediction types and functions", async () => {
    const analysis = await import("@/lib/domains/analysis");

    // Service class
    expect(analysis.PredictionService).toBeDefined();

    // Convenience functions
    expect(typeof analysis.predictWeeklyPerformance).toBe("function");
    expect(typeof analysis.predictBurnoutRisk).toBe("function");
    expect(typeof analysis.predictSubjectStruggle).toBe("function");
    expect(typeof analysis.runAllPredictions).toBe("function");
  });

  it("should export all Phase 4.2 warning types and functions", async () => {
    const analysis = await import("@/lib/domains/analysis");

    // Service class
    expect(analysis.EarlyWarningService).toBeDefined();

    // Convenience functions
    expect(typeof analysis.detectWarnings).toBe("function");
    expect(typeof analysis.getUnresolvedWarnings).toBe("function");
    expect(typeof analysis.acknowledgeWarning).toBe("function");
    expect(typeof analysis.resolveWarning).toBe("function");
    expect(typeof analysis.getWarningStats).toBe("function");

    // Labels
    expect(analysis.WARNING_TYPE_LABELS).toBeDefined();
    expect(analysis.SEVERITY_LABELS).toBeDefined();
    expect(analysis.SEVERITY_COLORS).toBeDefined();
  });

  it("should export all Phase 4.3 rescheduling types and functions", async () => {
    const analysis = await import("@/lib/domains/analysis");

    // Service class
    expect(analysis.AdaptiveReschedulingService).toBeDefined();

    // Convenience functions
    expect(typeof analysis.analyzeAndRecommendReschedule).toBe("function");
    expect(typeof analysis.autoRescheduleIncomplete).toBe("function");
    expect(typeof analysis.applyRescheduleRecommendation).toBe("function");

    // Labels
    expect(analysis.RESCHEDULE_REASON_LABELS).toBeDefined();
    expect(analysis.IMPACT_LABELS).toBeDefined();
    expect(analysis.DAY_NAMES).toBeDefined();
    expect(analysis.DAY_NAMES_EN).toBeDefined();
  });

  it("should still export existing learning pattern functions", async () => {
    const analysis = await import("@/lib/domains/analysis");

    expect(typeof analysis.analyzeLearningPatterns).toBe("function");
    expect(typeof analysis.calculatePreferredStudyTimes).toBe("function");
    expect(typeof analysis.analyzeStrongWeakDays).toBe("function");
    expect(typeof analysis.findFrequentlyIncompleteSubjects).toBe("function");
    expect(typeof analysis.saveLearningPatterns).toBe("function");
    expect(typeof analysis.getTimeSlotLabel).toBe("function");
    expect(typeof analysis.getDayLabel).toBe("function");
  });
});
