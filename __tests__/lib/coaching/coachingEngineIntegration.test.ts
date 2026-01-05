/**
 * Coaching Engine Integration 테스트
 *
 * 코칭 엔진과 Phase 2-3 기능 통합 테스트
 */

import { describe, it, expect } from "vitest";
import { coachingEngine, type WeeklyCoaching } from "@/lib/coaching/engine";
import type { WeeklyMetricsData } from "@/lib/coaching/getWeeklyMetrics";

describe("Coaching Engine Integration", () => {
  const createBaseMetrics = (): WeeklyMetricsData => ({
    weeklyStudyMinutes: 300,
    weeklyStudyTrend: 10,
    weeklyPlanCompletion: 70,
    weeklyGoalsProgress: 60,
    weakSubjects: [],
    riskLevel: "low",
    recommendations: [],
    consistencyScore: 70,
    focusScore: 70,
    // Phase 2-3 확장 필드
    milestoneAchievements: 5,
    streakDays: 4,
    incompleteCount: 3,
    delayedPlansCount: 1,
  });

  describe("Phase 2: Milestone Highlights", () => {
    it("마일스톤 10개 이상 달성 시 highlights에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.milestoneAchievements = 12;

      const result = coachingEngine(metrics);

      const hasMilestoneHighlight = result.highlights.some(
        (h) => h.includes("마일스톤") && h.includes("12")
      );
      expect(hasMilestoneHighlight).toBe(true);
    });

    it("마일스톤 5개 이상 달성 시 highlights에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.milestoneAchievements = 7;

      const result = coachingEngine(metrics);

      const hasMilestoneHighlight = result.highlights.some(
        (h) => h.includes("마일스톤") && h.includes("7")
      );
      expect(hasMilestoneHighlight).toBe(true);
    });

    it("마일스톤 5개 미만은 highlights에 미포함", () => {
      const metrics = createBaseMetrics();
      metrics.milestoneAchievements = 3;

      const result = coachingEngine(metrics);

      const hasMilestoneHighlight = result.highlights.some((h) =>
        h.includes("마일스톤")
      );
      expect(hasMilestoneHighlight).toBe(false);
    });
  });

  describe("Phase 2: Streak Highlights", () => {
    it("7일 연속 학습 시 highlights에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.streakDays = 7;

      const result = coachingEngine(metrics);

      const hasStreakHighlight = result.highlights.some(
        (h) => h.includes("연속") && h.includes("7")
      );
      expect(hasStreakHighlight).toBe(true);
    });

    it("3일 이상 연속 학습 시 highlights에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.streakDays = 4;

      const result = coachingEngine(metrics);

      const hasStreakHighlight = result.highlights.some(
        (h) => h.includes("연속") && h.includes("4")
      );
      expect(hasStreakHighlight).toBe(true);
    });

    it("3일 미만 연속 학습은 streakDays 기반 highlights에 미포함", () => {
      const metrics = createBaseMetrics();
      metrics.streakDays = 2;
      metrics.consistencyScore = 30; // 연속성 점수 낮춤

      const result = coachingEngine(metrics);

      // streakDays 기반 메시지는 "X일 연속 학습 중" 형태
      const hasStreakDaysHighlight = result.highlights.some(
        (h) => h.includes("일 연속 학습 중")
      );
      expect(hasStreakDaysHighlight).toBe(false);
    });
  });

  describe("Phase 3: Delayed Plans Warnings", () => {
    it("5개 이상 지연 플랜 시 warnings에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.delayedPlansCount = 6;

      const result = coachingEngine(metrics);

      const hasDelayedWarning = result.warnings.some(
        (w) => w.includes("밀려") && w.includes("6")
      );
      expect(hasDelayedWarning).toBe(true);
    });

    it("3개 이상 지연 플랜 시 warnings에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.delayedPlansCount = 4;

      const result = coachingEngine(metrics);

      const hasDelayedWarning = result.warnings.some(
        (w) => w.includes("밀린") && w.includes("4")
      );
      expect(hasDelayedWarning).toBe(true);
    });

    it("3개 미만 지연 플랜은 warnings에 미포함", () => {
      const metrics = createBaseMetrics();
      metrics.delayedPlansCount = 2;

      const result = coachingEngine(metrics);

      const hasDelayedWarning = result.warnings.some((w) =>
        w.includes("밀린")
      );
      expect(hasDelayedWarning).toBe(false);
    });
  });

  describe("Phase 3: Incomplete Plans Warnings", () => {
    it("10개 이상 미완료 플랜 시 warnings에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.incompleteCount = 12;

      const result = coachingEngine(metrics);

      const hasIncompleteWarning = result.warnings.some(
        (w) => w.includes("미완료") && w.includes("12")
      );
      expect(hasIncompleteWarning).toBe(true);
    });

    it("7개 이상 미완료 플랜 시 warnings에 포함", () => {
      const metrics = createBaseMetrics();
      metrics.incompleteCount = 8;

      const result = coachingEngine(metrics);

      const hasIncompleteWarning = result.warnings.some(
        (w) => w.includes("미완료") && w.includes("8")
      );
      expect(hasIncompleteWarning).toBe(true);
    });

    it("7개 미만 미완료 플랜은 warnings에 미포함", () => {
      const metrics = createBaseMetrics();
      metrics.incompleteCount = 5;

      const result = coachingEngine(metrics);

      const hasIncompleteWarning = result.warnings.some((w) =>
        w.includes("미완료")
      );
      expect(hasIncompleteWarning).toBe(false);
    });
  });

  describe("Next Week Guide Integration", () => {
    it("연속 3-6일 학습 시 7일 도전 가이드 제공", () => {
      const metrics = createBaseMetrics();
      metrics.streakDays = 5;

      const result = coachingEngine(metrics);

      const hasStreakGuide = result.nextWeekGuide.some(
        (g) => g.includes("7일") && g.includes("도전")
      );
      expect(hasStreakGuide).toBe(true);
    });

    it("연속 0일일 때 학습 습관 가이드 제공", () => {
      const metrics = createBaseMetrics();
      metrics.streakDays = 0;

      const result = coachingEngine(metrics);

      const hasHabitGuide = result.nextWeekGuide.some(
        (g) => g.includes("매일") && g.includes("습관")
      );
      expect(hasHabitGuide).toBe(true);
    });

    it("밀린 플랜 있을 때 해소 가이드 제공", () => {
      const metrics = createBaseMetrics();
      metrics.delayedPlansCount = 3;

      const result = coachingEngine(metrics);

      const hasDelayedGuide = result.nextWeekGuide.some(
        (g) => g.includes("밀린") && g.includes("3")
      );
      expect(hasDelayedGuide).toBe(true);
    });
  });

  describe("Combined Scenarios", () => {
    it("우수한 학습자: 높은 마일스톤, 긴 연속일, 낮은 미완료", () => {
      const metrics = createBaseMetrics();
      metrics.milestoneAchievements = 15;
      metrics.streakDays = 7;
      metrics.incompleteCount = 1;
      metrics.delayedPlansCount = 0;
      metrics.weeklyPlanCompletion = 90;
      metrics.consistencyScore = 90;

      const result = coachingEngine(metrics);

      // 많은 highlights, 적은 warnings
      expect(result.highlights.length).toBeGreaterThan(3);
      expect(result.warnings.length).toBeLessThanOrEqual(2);
    });

    it("개선 필요 학습자: 낮은 마일스톤, 짧은 연속일, 높은 미완료", () => {
      const metrics = createBaseMetrics();
      metrics.milestoneAchievements = 2;
      metrics.streakDays = 1;
      metrics.incompleteCount = 12;
      metrics.delayedPlansCount = 6;
      metrics.weeklyPlanCompletion = 30;
      metrics.consistencyScore = 30;

      const result = coachingEngine(metrics);

      // 적은 highlights, 많은 warnings
      expect(result.warnings.length).toBeGreaterThan(2);
    });

    it("평균 학습자: 중간 수준의 모든 지표", () => {
      const metrics = createBaseMetrics();
      metrics.milestoneAchievements = 5;
      metrics.streakDays = 3;
      metrics.incompleteCount = 5;
      metrics.delayedPlansCount = 2;
      metrics.weeklyPlanCompletion = 60;

      const result = coachingEngine(metrics);

      // 균형 잡힌 highlights와 nextWeekGuide
      expect(result.highlights.length).toBeGreaterThanOrEqual(1);
      expect(result.nextWeekGuide.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Output Structure", () => {
    it("결과 구조 검증", () => {
      const metrics = createBaseMetrics();
      const result = coachingEngine(metrics);

      expect(result).toHaveProperty("highlights");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("nextWeekGuide");
      expect(result).toHaveProperty("summary");

      expect(Array.isArray(result.highlights)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.nextWeekGuide)).toBe(true);
      expect(typeof result.summary).toBe("string");
    });

    it("최소 1개의 highlight 또는 기본 메시지", () => {
      const metrics = createBaseMetrics();
      metrics.milestoneAchievements = 0;
      metrics.streakDays = 0;
      metrics.weeklyPlanCompletion = 20;
      metrics.consistencyScore = 20;
      metrics.focusScore = 20;
      metrics.weeklyStudyTrend = 0;
      metrics.weeklyGoalsProgress = 0;

      const result = coachingEngine(metrics);

      expect(result.highlights.length).toBeGreaterThanOrEqual(1);
    });

    it("summary는 비어있지 않음", () => {
      const metrics = createBaseMetrics();
      const result = coachingEngine(metrics);

      expect(result.summary.length).toBeGreaterThan(0);
    });
  });
});
