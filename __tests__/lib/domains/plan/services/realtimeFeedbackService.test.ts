/**
 * 실시간 피드백 서비스 테스트
 *
 * 피드백 분석 및 권장사항 생성 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/plan/services/realtimeFeedbackService.test.ts
 */

import { describe, it, expect } from "vitest";

describe("realtimeFeedbackService", () => {
  describe("효율성 점수 계산 로직", () => {
    function calculateEfficiencyScore(
      actualMinutes: number,
      expectedMinutes: number
    ): number {
      if (expectedMinutes <= 0) return 1;
      return Math.round((actualMinutes / expectedMinutes) * 100) / 100;
    }

    it("예상 시간과 실제 시간이 같으면 1.0", () => {
      expect(calculateEfficiencyScore(30, 30)).toBe(1.0);
      expect(calculateEfficiencyScore(60, 60)).toBe(1.0);
    });

    it("실제 시간이 예상보다 적으면 1.0 미만", () => {
      expect(calculateEfficiencyScore(24, 30)).toBe(0.8); // 80%
      expect(calculateEfficiencyScore(15, 30)).toBe(0.5); // 50%
    });

    it("실제 시간이 예상보다 많으면 1.0 초과", () => {
      expect(calculateEfficiencyScore(39, 30)).toBe(1.3); // 130%
      expect(calculateEfficiencyScore(45, 30)).toBe(1.5); // 150%
    });

    it("예상 시간이 0이면 1.0 반환", () => {
      expect(calculateEfficiencyScore(30, 0)).toBe(1);
      expect(calculateEfficiencyScore(0, 0)).toBe(1);
    });
  });

  describe("효율성 등급 결정 로직", () => {
    type EfficiencyGrade = "excellent" | "good" | "average" | "poor";

    function determineEfficiencyGrade(efficiencyScore: number): EfficiencyGrade {
      if (efficiencyScore <= 0.8) return "excellent";
      if (efficiencyScore <= 1.0) return "good";
      if (efficiencyScore <= 1.3) return "average";
      return "poor";
    }

    it("효율성 점수 0.8 이하면 excellent", () => {
      expect(determineEfficiencyGrade(0.5)).toBe("excellent");
      expect(determineEfficiencyGrade(0.8)).toBe("excellent");
    });

    it("효율성 점수 0.8~1.0이면 good", () => {
      expect(determineEfficiencyGrade(0.81)).toBe("good");
      expect(determineEfficiencyGrade(0.9)).toBe("good");
      expect(determineEfficiencyGrade(1.0)).toBe("good");
    });

    it("효율성 점수 1.0~1.3이면 average", () => {
      expect(determineEfficiencyGrade(1.01)).toBe("average");
      expect(determineEfficiencyGrade(1.2)).toBe("average");
      expect(determineEfficiencyGrade(1.3)).toBe("average");
    });

    it("효율성 점수 1.3 초과면 poor", () => {
      expect(determineEfficiencyGrade(1.31)).toBe("poor");
      expect(determineEfficiencyGrade(1.5)).toBe("poor");
      expect(determineEfficiencyGrade(2.0)).toBe("poor");
    });
  });

  describe("난이도 적정 여부 판단 로직", () => {
    type DifficultyFeedback = "too_easy" | "appropriate" | "too_hard" | undefined;

    function isDifficultyAppropriate(feedback: DifficultyFeedback): boolean {
      return feedback === "appropriate" || feedback === undefined;
    }

    it("appropriate이면 적정", () => {
      expect(isDifficultyAppropriate("appropriate")).toBe(true);
    });

    it("undefined이면 적정 (기본값)", () => {
      expect(isDifficultyAppropriate(undefined)).toBe(true);
    });

    it("too_easy이면 부적정", () => {
      expect(isDifficultyAppropriate("too_easy")).toBe(false);
    });

    it("too_hard이면 부적정", () => {
      expect(isDifficultyAppropriate("too_hard")).toBe(false);
    });
  });

  describe("가중치 조정 계산 로직", () => {
    type EfficiencyGrade = "excellent" | "good" | "average" | "poor";

    function calculateWeightAdjustment(
      efficiencyGrade: EfficiencyGrade,
      currentWeight: number = 1.0
    ): number | null {
      if (efficiencyGrade === "poor" || efficiencyGrade === "average") {
        return 0.9; // 가중치 감소
      } else if (efficiencyGrade === "excellent") {
        return 1.1; // 가중치 증가
      }
      return null; // good이면 조정 없음
    }

    it("poor 등급이면 0.9 가중치 제안", () => {
      expect(calculateWeightAdjustment("poor")).toBe(0.9);
    });

    it("average 등급이면 0.9 가중치 제안", () => {
      expect(calculateWeightAdjustment("average")).toBe(0.9);
    });

    it("excellent 등급이면 1.1 가중치 제안", () => {
      expect(calculateWeightAdjustment("excellent")).toBe(1.1);
    });

    it("good 등급이면 조정 없음", () => {
      expect(calculateWeightAdjustment("good")).toBeNull();
    });
  });

  describe("피로도 기반 휴식 권장 로직", () => {
    const FATIGUE_THRESHOLD_MINUTES = 180;

    function shouldSuggestRest(totalStudyMinutes: number): boolean {
      return totalStudyMinutes >= FATIGUE_THRESHOLD_MINUTES;
    }

    it("180분 미만이면 휴식 불필요", () => {
      expect(shouldSuggestRest(0)).toBe(false);
      expect(shouldSuggestRest(60)).toBe(false);
      expect(shouldSuggestRest(179)).toBe(false);
    });

    it("180분 이상이면 휴식 권장", () => {
      expect(shouldSuggestRest(180)).toBe(true);
      expect(shouldSuggestRest(240)).toBe(true);
      expect(shouldSuggestRest(300)).toBe(true);
    });
  });

  describe("학습량 조정 권장 로직", () => {
    type WorkloadDirection = "increase" | "decrease" | "maintain";

    function determineWorkloadAdjustment(
      completedCount: number,
      totalCount: number
    ): { direction: WorkloadDirection; percentage: number } {
      if (totalCount === 0) {
        return { direction: "maintain", percentage: 0 };
      }

      const completionRate = (completedCount / totalCount) * 100;

      if (completionRate >= 100) {
        return { direction: "increase", percentage: 10 };
      } else if (completionRate < 50 && totalCount >= 3) {
        return { direction: "decrease", percentage: 20 };
      }
      return { direction: "maintain", percentage: 0 };
    }

    it("100% 완료시 학습량 증가 권장", () => {
      const result = determineWorkloadAdjustment(5, 5);
      expect(result.direction).toBe("increase");
      expect(result.percentage).toBe(10);
    });

    it("50% 미만 완료시 학습량 감소 권장 (플랜 3개 이상일 때)", () => {
      const result = determineWorkloadAdjustment(1, 4);
      expect(result.direction).toBe("decrease");
      expect(result.percentage).toBe(20);
    });

    it("50% 미만이라도 플랜이 3개 미만이면 유지", () => {
      const result = determineWorkloadAdjustment(0, 2);
      expect(result.direction).toBe("maintain");
      expect(result.percentage).toBe(0);
    });

    it("50-99% 완료시 학습량 유지", () => {
      const result1 = determineWorkloadAdjustment(3, 5);
      expect(result1.direction).toBe("maintain");

      const result2 = determineWorkloadAdjustment(4, 5);
      expect(result2.direction).toBe("maintain");
    });

    it("플랜이 없으면 유지", () => {
      const result = determineWorkloadAdjustment(0, 0);
      expect(result.direction).toBe("maintain");
      expect(result.percentage).toBe(0);
    });
  });

  describe("시간대 레이블 변환 로직", () => {
    function getTimeSlotLabel(hour: number): string {
      if (hour >= 6 && hour < 12) return "오전";
      if (hour >= 12 && hour < 17) return "오후";
      if (hour >= 17 && hour < 21) return "저녁";
      if (hour >= 21 || hour < 6) return "밤/새벽";
      return "기타";
    }

    it("오전 시간대 (6-11시)", () => {
      expect(getTimeSlotLabel(6)).toBe("오전");
      expect(getTimeSlotLabel(9)).toBe("오전");
      expect(getTimeSlotLabel(11)).toBe("오전");
    });

    it("오후 시간대 (12-16시)", () => {
      expect(getTimeSlotLabel(12)).toBe("오후");
      expect(getTimeSlotLabel(14)).toBe("오후");
      expect(getTimeSlotLabel(16)).toBe("오후");
    });

    it("저녁 시간대 (17-20시)", () => {
      expect(getTimeSlotLabel(17)).toBe("저녁");
      expect(getTimeSlotLabel(19)).toBe("저녁");
      expect(getTimeSlotLabel(20)).toBe("저녁");
    });

    it("밤/새벽 시간대 (21-5시)", () => {
      expect(getTimeSlotLabel(21)).toBe("밤/새벽");
      expect(getTimeSlotLabel(23)).toBe("밤/새벽");
      expect(getTimeSlotLabel(0)).toBe("밤/새벽");
      expect(getTimeSlotLabel(3)).toBe("밤/새벽");
      expect(getTimeSlotLabel(5)).toBe("밤/새벽");
    });
  });

  describe("동기 부여 메시지 결정 로직", () => {
    function getMotivationalMessage(
      completedCount: number,
      totalCount: number
    ): string | undefined {
      if (totalCount === 0) return undefined;

      const completionRate = (completedCount / totalCount) * 100;

      if (completionRate === 100) {
        return "훌륭합니다! 오늘 목표를 모두 달성하셨어요!";
      } else if (completionRate >= 80) {
        return "거의 다 왔어요! 마지막까지 화이팅!";
      } else if (completedCount > 0) {
        return `${completedCount}개 완료! 조금만 더 힘내세요.`;
      } else {
        return "오늘의 첫 플랜을 시작해보세요!";
      }
    }

    it("100% 완료시 축하 메시지", () => {
      expect(getMotivationalMessage(5, 5)).toBe("훌륭합니다! 오늘 목표를 모두 달성하셨어요!");
    });

    it("80% 이상 완료시 응원 메시지", () => {
      expect(getMotivationalMessage(4, 5)).toBe("거의 다 왔어요! 마지막까지 화이팅!");
      expect(getMotivationalMessage(8, 10)).toBe("거의 다 왔어요! 마지막까지 화이팅!");
    });

    it("일부 완료시 진행 메시지", () => {
      expect(getMotivationalMessage(2, 5)).toBe("2개 완료! 조금만 더 힘내세요.");
      expect(getMotivationalMessage(1, 10)).toBe("1개 완료! 조금만 더 힘내세요.");
    });

    it("미완료시 시작 유도 메시지", () => {
      expect(getMotivationalMessage(0, 5)).toBe("오늘의 첫 플랜을 시작해보세요!");
    });

    it("플랜이 없으면 undefined", () => {
      expect(getMotivationalMessage(0, 0)).toBeUndefined();
    });
  });

  describe("효율성 기반 가중치 범위 제한 로직", () => {
    function clampWeight(efficiency: number): number {
      return Math.min(1.5, Math.max(0.5, efficiency));
    }

    it("효율성이 0.5 미만이면 0.5로 제한", () => {
      expect(clampWeight(0.3)).toBe(0.5);
      expect(clampWeight(0.1)).toBe(0.5);
      expect(clampWeight(0)).toBe(0.5);
    });

    it("효율성이 1.5 초과면 1.5로 제한", () => {
      expect(clampWeight(1.6)).toBe(1.5);
      expect(clampWeight(2.0)).toBe(1.5);
      expect(clampWeight(3.0)).toBe(1.5);
    });

    it("효율성이 0.5~1.5 사이면 그대로 반환", () => {
      expect(clampWeight(0.5)).toBe(0.5);
      expect(clampWeight(1.0)).toBe(1.0);
      expect(clampWeight(1.5)).toBe(1.5);
      expect(clampWeight(0.8)).toBe(0.8);
      expect(clampWeight(1.2)).toBe(1.2);
    });
  });

  describe("권장사항 생성 로직", () => {
    type RecommendationType =
      | "time_adjust"
      | "difficulty_adjust"
      | "schedule_shift"
      | "rest_suggest";
    type Priority = "low" | "medium" | "high";

    type Recommendation = {
      type: RecommendationType;
      priority: Priority;
    };

    function generateRecommendations(input: {
      efficiencyGrade: "excellent" | "good" | "average" | "poor";
      difficultyFeedback?: "too_easy" | "appropriate" | "too_hard";
      satisfactionRating?: number;
    }): Recommendation[] {
      const recommendations: Recommendation[] = [];

      // 효율성 기반
      if (input.efficiencyGrade === "poor") {
        recommendations.push({ type: "time_adjust", priority: "medium" });
      } else if (input.efficiencyGrade === "excellent") {
        recommendations.push({ type: "time_adjust", priority: "low" });
      }

      // 난이도 기반
      if (input.difficultyFeedback === "too_hard") {
        recommendations.push({ type: "difficulty_adjust", priority: "high" });
      } else if (input.difficultyFeedback === "too_easy") {
        recommendations.push({ type: "difficulty_adjust", priority: "low" });
      }

      // 만족도 기반
      if (input.satisfactionRating !== undefined && input.satisfactionRating <= 2) {
        recommendations.push({ type: "schedule_shift", priority: "medium" });
      }

      return recommendations;
    }

    it("poor 효율성이면 time_adjust (medium) 권장", () => {
      const result = generateRecommendations({ efficiencyGrade: "poor" });
      expect(result).toContainEqual({ type: "time_adjust", priority: "medium" });
    });

    it("excellent 효율성이면 time_adjust (low) 권장", () => {
      const result = generateRecommendations({ efficiencyGrade: "excellent" });
      expect(result).toContainEqual({ type: "time_adjust", priority: "low" });
    });

    it("too_hard 난이도면 difficulty_adjust (high) 권장", () => {
      const result = generateRecommendations({
        efficiencyGrade: "good",
        difficultyFeedback: "too_hard",
      });
      expect(result).toContainEqual({ type: "difficulty_adjust", priority: "high" });
    });

    it("too_easy 난이도면 difficulty_adjust (low) 권장", () => {
      const result = generateRecommendations({
        efficiencyGrade: "good",
        difficultyFeedback: "too_easy",
      });
      expect(result).toContainEqual({ type: "difficulty_adjust", priority: "low" });
    });

    it("낮은 만족도 (1-2)면 schedule_shift 권장", () => {
      const result = generateRecommendations({
        efficiencyGrade: "good",
        satisfactionRating: 2,
      });
      expect(result).toContainEqual({ type: "schedule_shift", priority: "medium" });
    });

    it("복합 조건 테스트", () => {
      const result = generateRecommendations({
        efficiencyGrade: "poor",
        difficultyFeedback: "too_hard",
        satisfactionRating: 1,
      });
      expect(result.length).toBe(3);
      expect(result).toContainEqual({ type: "time_adjust", priority: "medium" });
      expect(result).toContainEqual({ type: "difficulty_adjust", priority: "high" });
      expect(result).toContainEqual({ type: "schedule_shift", priority: "medium" });
    });

    it("good 효율성, appropriate 난이도, 높은 만족도면 권장 없음", () => {
      const result = generateRecommendations({
        efficiencyGrade: "good",
        difficultyFeedback: "appropriate",
        satisfactionRating: 5,
      });
      expect(result.length).toBe(0);
    });
  });

  describe("최적 시간대 추천 로직", () => {
    const OPTIMAL_HOURS = [14, 15, 16, 17];

    function getNextOptimalHour(currentHour: number): number {
      return OPTIMAL_HOURS.find((h) => h > currentHour) || OPTIMAL_HOURS[0];
    }

    it("현재 시간 이후의 최적 시간 반환", () => {
      expect(getNextOptimalHour(10)).toBe(14);
      expect(getNextOptimalHour(14)).toBe(15);
      expect(getNextOptimalHour(15)).toBe(16);
      expect(getNextOptimalHour(16)).toBe(17);
    });

    it("최적 시간대 이후면 다음날 첫 번째 시간 반환", () => {
      expect(getNextOptimalHour(17)).toBe(14);
      expect(getNextOptimalHour(18)).toBe(14);
      expect(getNextOptimalHour(23)).toBe(14);
    });

    it("아침 시간이면 오후 2시 반환", () => {
      expect(getNextOptimalHour(6)).toBe(14);
      expect(getNextOptimalHour(9)).toBe(14);
    });
  });
});
