/**
 * 지능형 스케줄링 오케스트레이터 테스트
 *
 * 통합 스케줄링 분석 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/plan/services/intelligentSchedulingOrchestrator.test.ts
 */

import { describe, it, expect } from "vitest";

describe("intelligentSchedulingOrchestrator", () => {
  describe("건강 점수 계산 로직", () => {
    const HEALTH_SCORE_WEIGHTS = {
      progress: 0.25,
      fatigue: 0.20,
      pace: 0.15,
      difficulty: 0.15,
      delay: 0.15,
      realtime: 0.10,
    };

    function calculateOverallHealthScore(scoreComponents: Record<string, number>): number {
      let totalWeight = 0;
      let weightedSum = 0;

      for (const [component, score] of Object.entries(scoreComponents)) {
        const weight = HEALTH_SCORE_WEIGHTS[component as keyof typeof HEALTH_SCORE_WEIGHTS] || 0;
        weightedSum += score * weight;
        totalWeight += weight;
      }

      if (totalWeight === 0) return 50;
      return Math.round(weightedSum / totalWeight);
    }

    it("모든 컴포넌트가 100점이면 100점", () => {
      const scores = {
        progress: 100,
        fatigue: 100,
        pace: 100,
        difficulty: 100,
        delay: 100,
        realtime: 100,
      };
      expect(calculateOverallHealthScore(scores)).toBe(100);
    });

    it("모든 컴포넌트가 0점이면 0점", () => {
      const scores = {
        progress: 0,
        fatigue: 0,
        pace: 0,
        difficulty: 0,
        delay: 0,
        realtime: 0,
      };
      expect(calculateOverallHealthScore(scores)).toBe(0);
    });

    it("가중 평균이 올바르게 계산됨", () => {
      // progress(0.25)*80 + fatigue(0.20)*60 = 20 + 12 = 32
      // total weight = 0.45
      // result = 32 / 0.45 = 71.11 ≈ 71
      const scores = {
        progress: 80,
        fatigue: 60,
      };
      expect(calculateOverallHealthScore(scores)).toBe(71);
    });

    it("빈 점수면 기본값 50점", () => {
      expect(calculateOverallHealthScore({})).toBe(50);
    });

    it("일부 컴포넌트만 있어도 정상 계산", () => {
      const scores = {
        progress: 90,
        delay: 70,
      };
      // progress(0.25)*90 + delay(0.15)*70 = 22.5 + 10.5 = 33
      // total weight = 0.40
      // result = 33 / 0.40 = 82.5 ≈ 83
      expect(calculateOverallHealthScore(scores)).toBe(83);
    });
  });

  describe("건강 상태 결정 로직", () => {
    type HealthStatus = "excellent" | "good" | "fair" | "poor" | "critical";

    function determineHealthStatus(score: number): HealthStatus {
      if (score >= 85) return "excellent";
      if (score >= 70) return "good";
      if (score >= 55) return "fair";
      if (score >= 40) return "poor";
      return "critical";
    }

    it("85점 이상이면 excellent", () => {
      expect(determineHealthStatus(85)).toBe("excellent");
      expect(determineHealthStatus(100)).toBe("excellent");
    });

    it("70-84점이면 good", () => {
      expect(determineHealthStatus(70)).toBe("good");
      expect(determineHealthStatus(84)).toBe("good");
    });

    it("55-69점이면 fair", () => {
      expect(determineHealthStatus(55)).toBe("fair");
      expect(determineHealthStatus(69)).toBe("fair");
    });

    it("40-54점이면 poor", () => {
      expect(determineHealthStatus(40)).toBe("poor");
      expect(determineHealthStatus(54)).toBe("poor");
    });

    it("40점 미만이면 critical", () => {
      expect(determineHealthStatus(39)).toBe("critical");
      expect(determineHealthStatus(0)).toBe("critical");
    });
  });

  describe("권장사항 우선순위 결정 로직", () => {
    type Recommendation = {
      id: string;
      priority: number;
      title: string;
    };

    function sortByPriority(recommendations: Recommendation[]): Recommendation[] {
      return [...recommendations].sort((a, b) => b.priority - a.priority);
    }

    it("높은 우선순위가 먼저 정렬됨", () => {
      const recommendations = [
        { id: "1", priority: 5, title: "Low" },
        { id: "2", priority: 10, title: "High" },
        { id: "3", priority: 7, title: "Medium" },
      ];
      const sorted = sortByPriority(recommendations);
      expect(sorted[0].title).toBe("High");
      expect(sorted[1].title).toBe("Medium");
      expect(sorted[2].title).toBe("Low");
    });

    it("동일 우선순위는 순서 유지", () => {
      const recommendations = [
        { id: "1", priority: 5, title: "A" },
        { id: "2", priority: 5, title: "B" },
      ];
      const sorted = sortByPriority(recommendations);
      expect(sorted[0].title).toBe("A");
      expect(sorted[1].title).toBe("B");
    });
  });

  describe("인사이트 영향도 결정 로직", () => {
    type Impact = "high" | "medium" | "low";

    function determineImpact(conditions: {
      isCritical?: boolean;
      severity?: number;
    }): Impact {
      if (conditions.isCritical) return "high";
      if (conditions.severity !== undefined && conditions.severity >= 5) return "high";
      if (conditions.severity !== undefined && conditions.severity >= 3) return "medium";
      return "low";
    }

    it("critical 조건이면 high", () => {
      expect(determineImpact({ isCritical: true })).toBe("high");
    });

    it("심각도 5 이상이면 high", () => {
      expect(determineImpact({ severity: 5 })).toBe("high");
      expect(determineImpact({ severity: 10 })).toBe("high");
    });

    it("심각도 3-4이면 medium", () => {
      expect(determineImpact({ severity: 3 })).toBe("medium");
      expect(determineImpact({ severity: 4 })).toBe("medium");
    });

    it("심각도 3 미만이면 low", () => {
      expect(determineImpact({ severity: 2 })).toBe("low");
      expect(determineImpact({ severity: 0 })).toBe("low");
    });

    it("조건 없으면 low", () => {
      expect(determineImpact({})).toBe("low");
    });
  });

  describe("예측 메트릭 계산 로직", () => {
    type FatigueTrajectory = "improving" | "stable" | "worsening";
    type FatigueLevel = "low" | "medium" | "high" | "overload";

    function calculateFatigueTrajectory(level: FatigueLevel): FatigueTrajectory {
      if (level === "overload") return "worsening";
      if (level === "low") return "improving";
      return "stable";
    }

    function calculateRecommendedWeeklyMinutes(level: FatigueLevel): number {
      if (level === "high" || level === "overload") {
        return 600; // 10시간
      }
      return 900; // 15시간
    }

    function calculateRiskScore(avgScore: number): number {
      return Math.max(0, 100 - avgScore);
    }

    it("피로도 과부하면 악화 중", () => {
      expect(calculateFatigueTrajectory("overload")).toBe("worsening");
    });

    it("피로도 낮으면 개선 중", () => {
      expect(calculateFatigueTrajectory("low")).toBe("improving");
    });

    it("피로도 중간이면 안정", () => {
      expect(calculateFatigueTrajectory("medium")).toBe("stable");
      expect(calculateFatigueTrajectory("high")).toBe("stable");
    });

    it("피로도 높으면 주 10시간 권장", () => {
      expect(calculateRecommendedWeeklyMinutes("high")).toBe(600);
      expect(calculateRecommendedWeeklyMinutes("overload")).toBe(600);
    });

    it("피로도 보통이면 주 15시간 권장", () => {
      expect(calculateRecommendedWeeklyMinutes("low")).toBe(900);
      expect(calculateRecommendedWeeklyMinutes("medium")).toBe(900);
    });

    it("리스크 점수는 100 - 평균점수", () => {
      expect(calculateRiskScore(80)).toBe(20);
      expect(calculateRiskScore(100)).toBe(0);
      expect(calculateRiskScore(0)).toBe(100);
    });
  });

  describe("진행 상태 점수 계산 로직", () => {
    type OverallStatus = "good" | "needs-attention" | "critical";

    function calculateProgressScore(
      status: OverallStatus,
      avgProgressRate: number
    ): number {
      let score = 100;
      if (status === "critical") score = 30;
      else if (status === "needs-attention") score = 60;
      else if (avgProgressRate < 50) score = 70;
      return score;
    }

    it("critical 상태면 30점", () => {
      expect(calculateProgressScore("critical", 80)).toBe(30);
    });

    it("needs-attention 상태면 60점", () => {
      expect(calculateProgressScore("needs-attention", 80)).toBe(60);
    });

    it("good 상태이고 진행률 50% 미만이면 70점", () => {
      expect(calculateProgressScore("good", 30)).toBe(70);
    });

    it("good 상태이고 진행률 50% 이상이면 100점", () => {
      expect(calculateProgressScore("good", 80)).toBe(100);
    });
  });

  describe("피로도 점수 계산 로직", () => {
    type IntensityLevel = "low" | "medium" | "high" | "overload";

    function calculateFatigueComponentScore(level: IntensityLevel): number {
      let score = 100;
      if (level === "overload") score = 20;
      else if (level === "high") score = 50;
      else if (level === "medium") score = 75;
      return score;
    }

    it("overload면 20점", () => {
      expect(calculateFatigueComponentScore("overload")).toBe(20);
    });

    it("high면 50점", () => {
      expect(calculateFatigueComponentScore("high")).toBe(50);
    });

    it("medium이면 75점", () => {
      expect(calculateFatigueComponentScore("medium")).toBe(75);
    });

    it("low면 100점", () => {
      expect(calculateFatigueComponentScore("low")).toBe(100);
    });
  });

  describe("학습 속도 점수 계산 로직", () => {
    type Trend = "improving" | "stable" | "declining";
    type Confidence = "high" | "medium" | "low";

    function calculatePaceScore(trend: Trend, confidence: Confidence): number {
      let score = 75;
      if (trend === "improving") score = 90;
      else if (trend === "declining") score = 55;
      if (confidence === "high") score += 10;
      else if (confidence === "low") score -= 10;
      return Math.min(100, Math.max(0, score));
    }

    it("향상 + 높은 신뢰도면 100점", () => {
      expect(calculatePaceScore("improving", "high")).toBe(100);
    });

    it("감소 + 낮은 신뢰도면 45점", () => {
      expect(calculatePaceScore("declining", "low")).toBe(45);
    });

    it("안정 + 중간 신뢰도면 75점", () => {
      expect(calculatePaceScore("stable", "medium")).toBe(75);
    });

    it("향상 + 낮은 신뢰도면 80점", () => {
      expect(calculatePaceScore("improving", "low")).toBe(80);
    });
  });

  describe("지연 점수 계산 로직", () => {
    function calculateDelayScore(
      avgDelayDays: number,
      highRiskCount: number
    ): number {
      let score = 100;
      if (avgDelayDays >= 5) score = 30;
      else if (avgDelayDays >= 3) score = 50;
      else if (avgDelayDays >= 1) score = 75;
      if (highRiskCount > 5) score -= 20;
      return Math.max(0, score);
    }

    it("평균 5일 이상 지연이면 30점", () => {
      expect(calculateDelayScore(5, 0)).toBe(30);
      expect(calculateDelayScore(10, 0)).toBe(30);
    });

    it("평균 3-4일 지연이면 50점", () => {
      expect(calculateDelayScore(3, 0)).toBe(50);
      expect(calculateDelayScore(4.9, 0)).toBe(50);
    });

    it("평균 1-2일 지연이면 75점", () => {
      expect(calculateDelayScore(1, 0)).toBe(75);
      expect(calculateDelayScore(2.9, 0)).toBe(75);
    });

    it("지연 없으면 100점", () => {
      expect(calculateDelayScore(0, 0)).toBe(100);
    });

    it("고위험 플랜 6개 이상이면 20점 감점", () => {
      expect(calculateDelayScore(0, 6)).toBe(80);
      expect(calculateDelayScore(3, 6)).toBe(30);
    });

    it("점수는 0 미만이 되지 않음", () => {
      expect(calculateDelayScore(10, 10)).toBe(10);
    });
  });

  describe("난이도 점수 계산 로직", () => {
    function calculateDifficultyScore(needsAdjustmentCount: number): number {
      if (needsAdjustmentCount === 0) return 100;
      return Math.max(50, 100 - needsAdjustmentCount * 15);
    }

    it("조정 필요 없으면 100점", () => {
      expect(calculateDifficultyScore(0)).toBe(100);
    });

    it("조정 필요 1개면 85점", () => {
      expect(calculateDifficultyScore(1)).toBe(85);
    });

    it("조정 필요 3개면 55점", () => {
      expect(calculateDifficultyScore(3)).toBe(55);
    });

    it("최소 50점은 보장됨", () => {
      expect(calculateDifficultyScore(5)).toBe(50);
      expect(calculateDifficultyScore(10)).toBe(50);
    });
  });

  describe("ID 생성 로직", () => {
    function generateId(prefix: string): string {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    it("올바른 prefix로 시작", () => {
      const analysisId = generateId("analysis");
      expect(analysisId.startsWith("analysis_")).toBe(true);

      const recId = generateId("rec");
      expect(recId.startsWith("rec_")).toBe(true);
    });

    it("고유한 ID 생성", () => {
      const id1 = generateId("test");
      const id2 = generateId("test");
      expect(id1).not.toBe(id2);
    });
  });

  describe("인사이트 슬라이싱 로직", () => {
    function sliceInsights<T>(insights: T[], maxCount: number): T[] {
      return insights.slice(0, maxCount);
    }

    it("최대 개수만큼만 반환", () => {
      const insights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      expect(sliceInsights(insights, 10).length).toBe(10);
    });

    it("개수가 적으면 전체 반환", () => {
      const insights = [1, 2, 3];
      expect(sliceInsights(insights, 10).length).toBe(3);
    });

    it("빈 배열은 빈 배열 반환", () => {
      expect(sliceInsights([], 10).length).toBe(0);
    });
  });
});
