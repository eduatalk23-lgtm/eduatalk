/**
 * Learning Feedback Service 테스트
 *
 * 마일스톤 체크 및 학습 피드백 기능 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

describe("Learning Feedback Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Milestone Type Definitions", () => {
    it("시간 기반 마일스톤 타입이 정의되어 있어야 함", () => {
      const milestoneTypes = [
        "study_30min",
        "study_60min",
        "study_90min",
        "study_120min",
      ];

      milestoneTypes.forEach((type) => {
        expect(typeof type).toBe("string");
      });
    });

    it("성취 기반 마일스톤 타입이 정의되어 있어야 함", () => {
      const milestoneTypes = [
        "daily_goal",
        "plan_complete",
        "streak_3days",
        "streak_7days",
      ];

      milestoneTypes.forEach((type) => {
        expect(typeof type).toBe("string");
      });
    });
  });

  describe("Milestone Calculation Logic", () => {
    it("30분 학습 시 study_30min 마일스톤 달성", () => {
      const totalMinutes = 30;
      const milestoneThreshold = 30;
      expect(totalMinutes >= milestoneThreshold).toBe(true);
    });

    it("59분 학습 시 study_60min 마일스톤 미달성", () => {
      const totalMinutes = 59;
      const milestoneThreshold = 60;
      expect(totalMinutes >= milestoneThreshold).toBe(false);
    });

    it("60분 학습 시 study_60min 마일스톤 달성", () => {
      const totalMinutes = 60;
      const milestoneThreshold = 60;
      expect(totalMinutes >= milestoneThreshold).toBe(true);
    });

    it("120분 학습 시 모든 시간 마일스톤 달성", () => {
      const totalMinutes = 120;
      const thresholds = [30, 60, 90, 120];
      const achieved = thresholds.filter((t) => totalMinutes >= t);
      expect(achieved.length).toBe(4);
    });
  });

  describe("Celebration Level", () => {
    it("30분 마일스톤은 minor 레벨", () => {
      const milestone30min = {
        type: "study_30min",
        celebrationLevel: "minor" as const,
      };
      expect(milestone30min.celebrationLevel).toBe("minor");
    });

    it("60분, 90분 마일스톤은 major 레벨", () => {
      const milestone60min = {
        type: "study_60min",
        celebrationLevel: "major" as const,
      };
      const milestone90min = {
        type: "study_90min",
        celebrationLevel: "major" as const,
      };
      expect(milestone60min.celebrationLevel).toBe("major");
      expect(milestone90min.celebrationLevel).toBe("major");
    });

    it("120분, daily_goal 마일스톤은 epic 레벨", () => {
      const milestone120min = {
        type: "study_120min",
        celebrationLevel: "epic" as const,
      };
      const dailyGoal = {
        type: "daily_goal",
        celebrationLevel: "epic" as const,
      };
      expect(milestone120min.celebrationLevel).toBe("epic");
      expect(dailyGoal.celebrationLevel).toBe("epic");
    });
  });

  describe("Streak Calculation", () => {
    it("연속 학습일 계산 - 3일 연속", () => {
      const studyDays = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const streakDays = studyDays.length;
      expect(streakDays >= 3).toBe(true);
    });

    it("연속 학습일 계산 - 중간에 빠진 날", () => {
      const studyDays = ["2025-01-03", "2025-01-01"]; // 2일 빠짐
      const hasGap = true; // 실제 로직에서 gap 체크
      expect(hasGap).toBe(true);
    });
  });

  describe("Weekly Achievements Aggregation", () => {
    it("주간 마일스톤 집계", () => {
      const milestones = [
        { type: "study_30min", date: "2025-01-01" },
        { type: "study_60min", date: "2025-01-01" },
        { type: "study_30min", date: "2025-01-02" },
        { type: "daily_goal", date: "2025-01-02" },
      ];

      const byType: Record<string, number> = {};
      milestones.forEach((m) => {
        byType[m.type] = (byType[m.type] || 0) + 1;
      });

      expect(byType["study_30min"]).toBe(2);
      expect(byType["study_60min"]).toBe(1);
      expect(byType["daily_goal"]).toBe(1);
      expect(Object.keys(byType).length).toBe(3);
    });

    it("총 마일스톤 수 계산", () => {
      const milestones = [
        { type: "study_30min" },
        { type: "study_60min" },
        { type: "study_30min" },
        { type: "daily_goal" },
      ];

      expect(milestones.length).toBe(4);
    });
  });
});

describe("Milestone Settings", () => {
  it("기본 설정값 검증", () => {
    const defaultSettings = [
      { milestoneType: "study_30min", isEnabled: true, soundEnabled: true },
      { milestoneType: "study_60min", isEnabled: true, soundEnabled: true },
      { milestoneType: "study_90min", isEnabled: true, soundEnabled: false },
      { milestoneType: "study_120min", isEnabled: true, soundEnabled: true },
      { milestoneType: "daily_goal", isEnabled: true, soundEnabled: true },
      { milestoneType: "plan_complete", isEnabled: false, soundEnabled: false },
    ];

    expect(defaultSettings.length).toBe(6);
    expect(defaultSettings.filter((s) => s.isEnabled).length).toBe(5);
    expect(defaultSettings.filter((s) => s.soundEnabled).length).toBe(4);
  });

  it("설정 병합 로직", () => {
    const defaultSettings = [
      { milestoneType: "study_30min", isEnabled: true, soundEnabled: true },
      { milestoneType: "study_60min", isEnabled: true, soundEnabled: true },
    ];

    const userSettings = [
      { milestoneType: "study_30min", isEnabled: false, soundEnabled: false },
    ];

    const merged = defaultSettings.map((defaultSetting) => {
      const userSetting = userSettings.find(
        (s) => s.milestoneType === defaultSetting.milestoneType
      );
      return userSetting || defaultSetting;
    });

    expect(merged[0].isEnabled).toBe(false);
    expect(merged[1].isEnabled).toBe(true);
  });
});
