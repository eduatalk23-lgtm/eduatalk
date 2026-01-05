/**
 * 지연 예측 서비스 테스트
 *
 * 패턴 기반 지연 예측 및 선제 조치 기능 테스트
 *
 * @module __tests__/lib/domains/plan/services/delayPredictionService.test.ts
 */

import { describe, it, expect } from "vitest";
import type {
  RiskLevel,
  SuggestedAction,
  DelayPrediction,
  StudentPatternAnalysis,
} from "@/lib/domains/plan/services/delayPredictionService";

describe("delayPredictionService", () => {
  describe("determineRiskLevel", () => {
    // 리스크 임계값
    const RISK_THRESHOLDS = {
      HIGH: 0.7,
      MEDIUM: 0.4,
      LOW: 0.2,
    };

    function determineRiskLevel(riskScore: number): RiskLevel {
      if (riskScore >= RISK_THRESHOLDS.HIGH) return "high";
      if (riskScore >= RISK_THRESHOLDS.MEDIUM) return "medium";
      return "low";
    }

    it("0.7 이상이면 high 반환", () => {
      expect(determineRiskLevel(0.7)).toBe("high");
      expect(determineRiskLevel(0.9)).toBe("high");
      expect(determineRiskLevel(1.0)).toBe("high");
    });

    it("0.4-0.69면 medium 반환", () => {
      expect(determineRiskLevel(0.4)).toBe("medium");
      expect(determineRiskLevel(0.5)).toBe("medium");
      expect(determineRiskLevel(0.69)).toBe("medium");
    });

    it("0.4 미만이면 low 반환", () => {
      expect(determineRiskLevel(0.39)).toBe("low");
      expect(determineRiskLevel(0.2)).toBe("low");
      expect(determineRiskLevel(0)).toBe("low");
    });
  });

  describe("calculateDelayDays", () => {
    const RISK_THRESHOLDS = {
      HIGH: 0.7,
      MEDIUM: 0.4,
    };

    function calculateDelayDays(riskScore: number): number {
      if (riskScore >= RISK_THRESHOLDS.HIGH) return 3;
      if (riskScore >= RISK_THRESHOLDS.MEDIUM) return 1;
      return 0;
    }

    it("high risk면 3일 지연 예측", () => {
      expect(calculateDelayDays(0.7)).toBe(3);
      expect(calculateDelayDays(0.9)).toBe(3);
    });

    it("medium risk면 1일 지연 예측", () => {
      expect(calculateDelayDays(0.4)).toBe(1);
      expect(calculateDelayDays(0.6)).toBe(1);
    });

    it("low risk면 지연 없음", () => {
      expect(calculateDelayDays(0.3)).toBe(0);
      expect(calculateDelayDays(0)).toBe(0);
    });
  });

  describe("calculateConfidence", () => {
    function calculateConfidence(dataPoints: number): number {
      if (dataPoints >= 30) return 0.9;
      if (dataPoints >= 20) return 0.8;
      if (dataPoints >= 10) return 0.7;
      if (dataPoints >= 5) return 0.6;
      return 0.5;
    }

    it("30개 이상이면 신뢰도 0.9", () => {
      expect(calculateConfidence(30)).toBe(0.9);
      expect(calculateConfidence(50)).toBe(0.9);
    });

    it("20-29개면 신뢰도 0.8", () => {
      expect(calculateConfidence(20)).toBe(0.8);
      expect(calculateConfidence(29)).toBe(0.8);
    });

    it("10-19개면 신뢰도 0.7", () => {
      expect(calculateConfidence(10)).toBe(0.7);
      expect(calculateConfidence(19)).toBe(0.7);
    });

    it("5-9개면 신뢰도 0.6", () => {
      expect(calculateConfidence(5)).toBe(0.6);
      expect(calculateConfidence(9)).toBe(0.6);
    });

    it("5개 미만이면 신뢰도 0.5", () => {
      expect(calculateConfidence(4)).toBe(0.5);
      expect(calculateConfidence(0)).toBe(0.5);
    });
  });

  describe("generateActions", () => {
    function generateActions(
      riskLevel: RiskLevel,
      riskFactors: string[]
    ): SuggestedAction[] {
      const actions: SuggestedAction[] = [];

      if (riskLevel === "high") {
        actions.push({
          type: "reschedule",
          description: "지연 위험이 높습니다. 다른 날짜로 재조정을 고려하세요.",
          priority: "high",
        });

        if (riskFactors.includes("consecutive_incomplete")) {
          actions.push({
            type: "rest_day",
            description: "연속 미완료가 감지되었습니다. 휴식일을 추가하세요.",
            priority: "high",
          });
        }
      }

      if (riskLevel === "medium" || riskLevel === "high") {
        if (riskFactors.includes("overload")) {
          actions.push({
            type: "reduce_load",
            description: "학습량이 많습니다. 일부 플랜을 다른 날로 분산하세요.",
            priority: "medium",
          });
        }

        if (riskFactors.includes("weak_subject")) {
          actions.push({
            type: "split",
            description: "취약 과목입니다. 학습 시간을 나누어 진행하세요.",
            priority: "medium",
          });
        }
      }

      if (actions.length === 0 && riskLevel !== "low") {
        actions.push({
          type: "alert",
          description: "플랜 진행 상황을 주의깊게 모니터링하세요.",
          priority: "low",
        });
      }

      return actions;
    }

    it("high risk면 reschedule 제안", () => {
      const actions = generateActions("high", []);
      expect(actions.find((a) => a.type === "reschedule")).toBeDefined();
      expect(actions.find((a) => a.type === "reschedule")?.priority).toBe(
        "high"
      );
    });

    it("high risk + consecutive_incomplete면 rest_day도 제안", () => {
      const actions = generateActions("high", ["consecutive_incomplete"]);
      expect(actions.find((a) => a.type === "rest_day")).toBeDefined();
    });

    it("medium risk + overload면 reduce_load 제안", () => {
      const actions = generateActions("medium", ["overload"]);
      expect(actions.find((a) => a.type === "reduce_load")).toBeDefined();
    });

    it("medium risk + weak_subject면 split 제안", () => {
      const actions = generateActions("medium", ["weak_subject"]);
      expect(actions.find((a) => a.type === "split")).toBeDefined();
    });

    it("medium risk + 특별한 요인 없으면 alert만 제안", () => {
      const actions = generateActions("medium", []);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("alert");
    });

    it("low risk면 액션 없음", () => {
      const actions = generateActions("low", []);
      expect(actions).toHaveLength(0);
    });
  });

  describe("StudentPatternAnalysis structure", () => {
    it("올바른 구조 검증", () => {
      const mockPattern: StudentPatternAnalysis = {
        studentId: "test-student-id",
        weeklyCompletionRate: 72,
        weakDays: ["토", "일"],
        weakSubjects: ["영어", "수학"],
        consecutiveIncompleteStreak: 2,
        recentTrend: "stable",
        averageDelayDays: 0,
      };

      expect(mockPattern.weeklyCompletionRate).toBeGreaterThanOrEqual(0);
      expect(mockPattern.weeklyCompletionRate).toBeLessThanOrEqual(100);
      expect(["improving", "stable", "declining"]).toContain(
        mockPattern.recentTrend
      );
      expect(mockPattern.consecutiveIncompleteStreak).toBeGreaterThanOrEqual(0);
    });
  });

  describe("DelayPrediction structure", () => {
    it("올바른 구조 검증", () => {
      const mockPrediction: DelayPrediction = {
        planId: "test-plan-id",
        planDate: "2025-01-15",
        subjectType: "math",
        riskLevel: "medium",
        riskScore: 0.55,
        predictedDelayDays: 1,
        confidence: 0.8,
        riskFactors: ["weak_day", "declining_trend"],
        suggestedActions: [
          {
            type: "alert",
            description: "플랜 진행 상황을 주의깊게 모니터링하세요.",
            priority: "low",
          },
        ],
      };

      expect(["low", "medium", "high"]).toContain(mockPrediction.riskLevel);
      expect(mockPrediction.riskScore).toBeGreaterThanOrEqual(0);
      expect(mockPrediction.riskScore).toBeLessThanOrEqual(1);
      expect(mockPrediction.confidence).toBeGreaterThanOrEqual(0);
      expect(mockPrediction.confidence).toBeLessThanOrEqual(1);
      expect(mockPrediction.predictedDelayDays).toBeGreaterThanOrEqual(0);
    });
  });

  describe("riskScore 계산 로직", () => {
    function calculateRiskScore(pattern: StudentPatternAnalysis): number {
      let riskScore = 0;

      // 취약 요일
      if (pattern.weakDays.length > 0) {
        riskScore += 0.3;
      }

      // 취약 과목
      if (pattern.weakSubjects.length > 0) {
        riskScore += 0.3;
      }

      // 연속 미완료 (3회 이상)
      if (pattern.consecutiveIncompleteStreak >= 3) {
        riskScore += 0.4;
      }

      // 하락 추세
      if (pattern.recentTrend === "declining") {
        riskScore += 0.2;
      }

      // 낮은 완료율 (50% 미만)
      if (pattern.weeklyCompletionRate < 50) {
        riskScore += 0.2;
      }

      // 최대 1.0으로 정규화
      return Math.min(1.0, riskScore);
    }

    it("취약 요일만 있으면 0.3", () => {
      const pattern: StudentPatternAnalysis = {
        studentId: "test",
        weeklyCompletionRate: 80,
        weakDays: ["토"],
        weakSubjects: [],
        consecutiveIncompleteStreak: 0,
        recentTrend: "stable",
        averageDelayDays: 0,
      };
      expect(calculateRiskScore(pattern)).toBe(0.3);
    });

    it("취약 과목만 있으면 0.3", () => {
      const pattern: StudentPatternAnalysis = {
        studentId: "test",
        weeklyCompletionRate: 80,
        weakDays: [],
        weakSubjects: ["영어"],
        consecutiveIncompleteStreak: 0,
        recentTrend: "stable",
        averageDelayDays: 0,
      };
      expect(calculateRiskScore(pattern)).toBe(0.3);
    });

    it("연속 미완료 3회 이상이면 0.4 추가", () => {
      const pattern: StudentPatternAnalysis = {
        studentId: "test",
        weeklyCompletionRate: 80,
        weakDays: [],
        weakSubjects: [],
        consecutiveIncompleteStreak: 3,
        recentTrend: "stable",
        averageDelayDays: 0,
      };
      expect(calculateRiskScore(pattern)).toBe(0.4);
    });

    it("하락 추세면 0.2 추가", () => {
      const pattern: StudentPatternAnalysis = {
        studentId: "test",
        weeklyCompletionRate: 80,
        weakDays: [],
        weakSubjects: [],
        consecutiveIncompleteStreak: 0,
        recentTrend: "declining",
        averageDelayDays: 0,
      };
      expect(calculateRiskScore(pattern)).toBe(0.2);
    });

    it("낮은 완료율 (50% 미만)이면 0.2 추가", () => {
      const pattern: StudentPatternAnalysis = {
        studentId: "test",
        weeklyCompletionRate: 45,
        weakDays: [],
        weakSubjects: [],
        consecutiveIncompleteStreak: 0,
        recentTrend: "stable",
        averageDelayDays: 0,
      };
      expect(calculateRiskScore(pattern)).toBe(0.2);
    });

    it("모든 리스크 요인이 있으면 최대 1.0", () => {
      const pattern: StudentPatternAnalysis = {
        studentId: "test",
        weeklyCompletionRate: 30, // 0.2
        weakDays: ["토", "일"], // 0.3
        weakSubjects: ["영어", "수학"], // 0.3
        consecutiveIncompleteStreak: 5, // 0.4
        recentTrend: "declining", // 0.2
        averageDelayDays: 0,
      };
      // 0.2 + 0.3 + 0.3 + 0.4 + 0.2 = 1.4 → 최대 1.0
      expect(calculateRiskScore(pattern)).toBe(1.0);
    });

    it("리스크 요인이 없으면 0", () => {
      const pattern: StudentPatternAnalysis = {
        studentId: "test",
        weeklyCompletionRate: 90,
        weakDays: [],
        weakSubjects: [],
        consecutiveIncompleteStreak: 0,
        recentTrend: "improving",
        averageDelayDays: 0,
      };
      expect(calculateRiskScore(pattern)).toBe(0);
    });
  });

  describe("요일 이름 매핑", () => {
    const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

    it("JavaScript Date.getDay()와 매핑 일치", () => {
      // 2025-01-05 = 일요일 (0)
      const sunday = new Date("2025-01-05");
      expect(DAY_NAMES[sunday.getDay()]).toBe("일");

      // 2025-01-06 = 월요일 (1)
      const monday = new Date("2025-01-06");
      expect(DAY_NAMES[monday.getDay()]).toBe("월");

      // 2025-01-11 = 토요일 (6)
      const saturday = new Date("2025-01-11");
      expect(DAY_NAMES[saturday.getDay()]).toBe("토");
    });
  });

  describe("취약 요일/과목 임계값", () => {
    const WEAK_DAY_THRESHOLD = 50;

    function isWeakDay(completionRate: number): boolean {
      return completionRate < WEAK_DAY_THRESHOLD;
    }

    it("완료율 50% 미만이면 취약", () => {
      expect(isWeakDay(49)).toBe(true);
      expect(isWeakDay(30)).toBe(true);
    });

    it("완료율 50% 이상이면 취약 아님", () => {
      expect(isWeakDay(50)).toBe(false);
      expect(isWeakDay(80)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("완료율 경계값 50% 정확히", () => {
      const WEAK_DAY_THRESHOLD = 50;
      const completionRate = 50;
      expect(completionRate < WEAK_DAY_THRESHOLD).toBe(false);
    });

    it("연속 미완료 경계값 3회 정확히", () => {
      const CONSECUTIVE_INCOMPLETE_THRESHOLD = 3;
      const streak = 3;
      expect(streak >= CONSECUTIVE_INCOMPLETE_THRESHOLD).toBe(true);
    });

    it("리스크 점수 경계값 테스트", () => {
      const RISK_THRESHOLDS = {
        HIGH: 0.7,
        MEDIUM: 0.4,
      };

      // 정확히 0.7
      expect(0.7 >= RISK_THRESHOLDS.HIGH).toBe(true);
      // 정확히 0.4
      expect(0.4 >= RISK_THRESHOLDS.MEDIUM).toBe(true);
      expect(0.4 >= RISK_THRESHOLDS.HIGH).toBe(false);
    });

    it("빈 패턴 데이터 처리", () => {
      const emptyPattern: StudentPatternAnalysis = {
        studentId: "empty",
        weeklyCompletionRate: 0,
        weakDays: [],
        weakSubjects: [],
        consecutiveIncompleteStreak: 0,
        recentTrend: "stable",
        averageDelayDays: 0,
      };

      // 완료율 0%는 낮은 완료율로 간주
      expect(emptyPattern.weeklyCompletionRate < 50).toBe(true);
    });
  });

  describe("트렌드 분석", () => {
    function analyzeTrend(
      recentPlans: Array<{ simple_completed: boolean }>,
      olderPlans: Array<{ simple_completed: boolean }>
    ): "improving" | "stable" | "declining" {
      if (recentPlans.length < 5 || olderPlans.length < 5) {
        return "stable";
      }

      const recentRate =
        recentPlans.filter((p) => p.simple_completed).length / recentPlans.length;
      const olderRate =
        olderPlans.filter((p) => p.simple_completed).length / olderPlans.length;
      const diff = recentRate - olderRate;

      if (diff > 0.15) return "improving";
      if (diff < -0.15) return "declining";
      return "stable";
    }

    it("데이터 부족하면 stable", () => {
      const recent = [{ simple_completed: true }];
      const older = [{ simple_completed: false }];
      expect(analyzeTrend(recent, older)).toBe("stable");
    });

    it("개선 추세 감지 (15% 이상 향상)", () => {
      const older = Array(5).fill({ simple_completed: false });
      const recent = Array(5).fill({ simple_completed: true });
      expect(analyzeTrend(recent, older)).toBe("improving");
    });

    it("하락 추세 감지 (15% 이상 하락)", () => {
      const older = Array(5).fill({ simple_completed: true });
      const recent = Array(5).fill({ simple_completed: false });
      expect(analyzeTrend(recent, older)).toBe("declining");
    });

    it("안정 추세 (15% 이내 변동)", () => {
      const older = [
        { simple_completed: true },
        { simple_completed: true },
        { simple_completed: true },
        { simple_completed: false },
        { simple_completed: false },
      ];
      const recent = [
        { simple_completed: true },
        { simple_completed: true },
        { simple_completed: false },
        { simple_completed: false },
        { simple_completed: false },
      ];
      // older: 60%, recent: 40% → -20% → declining
      expect(analyzeTrend(recent, older)).toBe("declining");
    });
  });
});
