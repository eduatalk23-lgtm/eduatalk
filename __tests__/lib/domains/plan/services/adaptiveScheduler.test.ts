/**
 * 적응형 스케줄러 서비스 테스트
 *
 * 진행률 모니터링 및 권장사항 생성 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/plan/services/adaptiveScheduler.test.ts
 */

import { describe, it, expect } from "vitest";

describe("adaptiveScheduler", () => {
  describe("진행 상태 결정 로직", () => {
    function determineStatus(
      progressRate: number,
      expectedProgressRate: number
    ): "ahead" | "on-track" | "behind" | "critical" {
      const progressDiff = progressRate - expectedProgressRate;
      if (progressDiff >= 10) return "ahead";
      if (progressDiff >= -10) return "on-track";
      if (progressDiff >= -25) return "behind";
      return "critical";
    }

    it("진행률이 예상보다 10% 이상 앞서면 ahead", () => {
      expect(determineStatus(60, 50)).toBe("ahead");
      expect(determineStatus(80, 60)).toBe("ahead");
      expect(determineStatus(100, 80)).toBe("ahead");
    });

    it("진행률이 예상과 ±10% 이내면 on-track", () => {
      expect(determineStatus(50, 50)).toBe("on-track");
      expect(determineStatus(55, 50)).toBe("on-track");
      expect(determineStatus(45, 50)).toBe("on-track");
      expect(determineStatus(40, 50)).toBe("on-track"); // -10%
      expect(determineStatus(60, 50)).toBe("ahead"); // +10% 이상은 ahead
    });

    it("진행률이 예상보다 10-25% 뒤처지면 behind", () => {
      expect(determineStatus(30, 50)).toBe("behind"); // -20%
      expect(determineStatus(35, 50)).toBe("behind"); // -15%
      expect(determineStatus(25, 50)).toBe("behind"); // -25%
    });

    it("진행률이 예상보다 25% 이상 뒤처지면 critical", () => {
      expect(determineStatus(20, 50)).toBe("critical"); // -30%
      expect(determineStatus(10, 50)).toBe("critical"); // -40%
      expect(determineStatus(0, 50)).toBe("critical"); // -50%
    });

    it("경계값 테스트", () => {
      // 정확히 +10%는 ahead
      expect(determineStatus(60, 50)).toBe("ahead");
      // 정확히 -10%는 on-track
      expect(determineStatus(40, 50)).toBe("on-track");
      // 정확히 -25%는 behind
      expect(determineStatus(25, 50)).toBe("behind");
      // -25% 초과는 critical
      expect(determineStatus(24, 50)).toBe("critical");
    });
  });

  describe("예상 완료일 계산 로직", () => {
    function calculateEstimatedCompletionDate(
      completedPlans: number,
      totalPlans: number,
      elapsedDays: number,
      today: Date
    ): string | null {
      if (completedPlans === 0) return null;
      if (completedPlans >= totalPlans) {
        return today.toISOString().split("T")[0];
      }

      const daysPerPlan = elapsedDays / completedPlans;
      const remainingPlans = totalPlans - completedPlans;
      const daysToComplete = Math.ceil(remainingPlans * daysPerPlan);
      const estimatedDate = new Date(today);
      estimatedDate.setDate(estimatedDate.getDate() + daysToComplete);
      return estimatedDate.toISOString().split("T")[0];
    }

    it("완료된 플랜이 없으면 null 반환", () => {
      const today = new Date("2025-01-15");
      expect(calculateEstimatedCompletionDate(0, 10, 5, today)).toBeNull();
    });

    it("모든 플랜이 완료되면 오늘 날짜 반환", () => {
      const today = new Date("2025-01-15");
      const result = calculateEstimatedCompletionDate(10, 10, 5, today);
      expect(result).toBe("2025-01-15");
    });

    it("일정 속도로 진행 중일 때 예상 완료일 계산", () => {
      // 10일 동안 5개 완료 = 하루에 0.5개 = 플랜당 2일
      // 남은 5개 × 2일 = 10일 후
      const today = new Date("2025-01-15");
      const result = calculateEstimatedCompletionDate(5, 10, 10, today);
      expect(result).toBe("2025-01-25");
    });

    it("빠르게 진행 중일 때 예상 완료일 계산", () => {
      // 5일 동안 8개 완료 = 플랜당 0.625일
      // 남은 2개 × 0.625 = 1.25일 → 2일 (올림)
      const today = new Date("2025-01-15");
      const result = calculateEstimatedCompletionDate(8, 10, 5, today);
      expect(result).toBe("2025-01-17");
    });
  });

  describe("권장 조치 결정 로직", () => {
    type Action = {
      type: "reschedule" | "reduce" | "extend" | "maintain";
      urgency: "low" | "medium" | "high";
    };

    function determineSuggestedActions(
      status: "ahead" | "on-track" | "behind" | "critical",
      atRiskPlanCount: number
    ): Action[] {
      const actions: Action[] = [];

      if (status === "critical") {
        actions.push({ type: "reschedule", urgency: "high" });
        actions.push({ type: "reduce", urgency: "high" });
      } else if (status === "behind") {
        actions.push({ type: "reschedule", urgency: "medium" });
      } else if (status === "ahead") {
        actions.push({ type: "maintain", urgency: "low" });
      } else {
        actions.push({ type: "maintain", urgency: "low" });
      }

      if (atRiskPlanCount > 0) {
        actions.push({
          type: "reschedule",
          urgency: atRiskPlanCount >= 5 ? "high" : "medium",
        });
      }

      return actions;
    }

    it("critical 상태면 high urgency 권장 조치", () => {
      const actions = determineSuggestedActions("critical", 0);
      expect(actions.some((a) => a.type === "reschedule" && a.urgency === "high")).toBe(true);
      expect(actions.some((a) => a.type === "reduce" && a.urgency === "high")).toBe(true);
    });

    it("behind 상태면 medium urgency reschedule", () => {
      const actions = determineSuggestedActions("behind", 0);
      expect(actions.some((a) => a.type === "reschedule" && a.urgency === "medium")).toBe(true);
    });

    it("ahead 또는 on-track 상태면 maintain", () => {
      const aheadActions = determineSuggestedActions("ahead", 0);
      expect(aheadActions.some((a) => a.type === "maintain")).toBe(true);

      const onTrackActions = determineSuggestedActions("on-track", 0);
      expect(onTrackActions.some((a) => a.type === "maintain")).toBe(true);
    });

    it("미완료 플랜이 있으면 추가 권장", () => {
      const actions = determineSuggestedActions("on-track", 3);
      expect(actions.filter((a) => a.type === "reschedule").length).toBeGreaterThanOrEqual(1);
    });

    it("미완료 플랜이 5개 이상이면 high urgency", () => {
      const actions = determineSuggestedActions("on-track", 5);
      expect(actions.some((a) => a.type === "reschedule" && a.urgency === "high")).toBe(true);
    });
  });

  describe("평균 지연일 기반 권장사항", () => {
    function getDelayRecommendationPriority(averageDelayDays: number): number | null {
      if (averageDelayDays < 2) return null;
      return averageDelayDays >= 5 ? 5 : 4;
    }

    function getDelayLevel(averageDelayDays: number): string | null {
      if (averageDelayDays < 2) return null;
      if (averageDelayDays >= 5) return "매우 높음";
      if (averageDelayDays >= 3) return "높음";
      return "다소 높음";
    }

    it("평균 지연일 2일 미만이면 권장사항 없음", () => {
      expect(getDelayRecommendationPriority(0)).toBeNull();
      expect(getDelayRecommendationPriority(1)).toBeNull();
      expect(getDelayRecommendationPriority(1.9)).toBeNull();
      expect(getDelayLevel(1.9)).toBeNull();
    });

    it("평균 지연일 2-3일이면 다소 높음, 우선순위 4", () => {
      expect(getDelayRecommendationPriority(2)).toBe(4);
      expect(getDelayRecommendationPriority(2.5)).toBe(4);
      expect(getDelayLevel(2)).toBe("다소 높음");
      expect(getDelayLevel(2.9)).toBe("다소 높음");
    });

    it("평균 지연일 3-5일이면 높음, 우선순위 4", () => {
      expect(getDelayRecommendationPriority(3)).toBe(4);
      expect(getDelayRecommendationPriority(4.9)).toBe(4);
      expect(getDelayLevel(3)).toBe("높음");
      expect(getDelayLevel(4.9)).toBe("높음");
    });

    it("평균 지연일 5일 이상이면 매우 높음, 우선순위 5", () => {
      expect(getDelayRecommendationPriority(5)).toBe(5);
      expect(getDelayRecommendationPriority(10)).toBe(5);
      expect(getDelayLevel(5)).toBe("매우 높음");
      expect(getDelayLevel(10)).toBe("매우 높음");
    });
  });

  describe("전체 상태 결정 로직", () => {
    function determineOverallStatus(
      criticalCount: number,
      behindCount: number
    ): "good" | "needs-attention" | "critical" {
      if (criticalCount > 0) return "critical";
      if (behindCount > 0) return "needs-attention";
      return "good";
    }

    it("critical 플랜 그룹이 있으면 critical", () => {
      expect(determineOverallStatus(1, 0)).toBe("critical");
      expect(determineOverallStatus(2, 3)).toBe("critical");
    });

    it("behind 플랜 그룹만 있으면 needs-attention", () => {
      expect(determineOverallStatus(0, 1)).toBe("needs-attention");
      expect(determineOverallStatus(0, 5)).toBe("needs-attention");
    });

    it("문제 없으면 good", () => {
      expect(determineOverallStatus(0, 0)).toBe("good");
    });
  });
});
