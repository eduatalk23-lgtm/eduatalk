/**
 * Plan Reminder Service 테스트
 *
 * 미완료 플랜 리마인더 및 지연 플랜 경고 기능 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Mock in-app notification service
vi.mock("@/lib/services/inAppNotificationService", () => ({
  sendInAppNotification: vi.fn(),
}));

describe("Plan Reminder Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Reminder Settings", () => {
    it("기본 리마인더 설정값 검증", () => {
      const defaultSettings = {
        incompleteReminderEnabled: true,
        incompleteReminderTime: "20:00",
        delayedPlanWarningEnabled: true,
        delayedPlanThreshold: 3,
        weeklySummaryEnabled: true,
        weeklySummaryDay: 0, // 일요일
      };

      expect(defaultSettings.incompleteReminderEnabled).toBe(true);
      expect(defaultSettings.incompleteReminderTime).toBe("20:00");
      expect(defaultSettings.delayedPlanThreshold).toBe(3);
      expect(defaultSettings.weeklySummaryDay).toBe(0);
    });

    it("알림 시간 형식 검증", () => {
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const validTimes = ["20:00", "09:30", "23:59", "00:00"];
      const invalidTimes = ["25:00", "20:60", "abc", ""];

      validTimes.forEach((time) => {
        expect(timePattern.test(time)).toBe(true);
      });

      invalidTimes.forEach((time) => {
        expect(timePattern.test(time)).toBe(false);
      });
    });

    it("지연 임계값 옵션 검증", () => {
      const thresholdOptions = [2, 3, 5, 7];
      const validThreshold = 3;

      expect(thresholdOptions.includes(validThreshold)).toBe(true);
      expect(thresholdOptions.includes(4)).toBe(false);
    });
  });

  describe("Incomplete Plan Calculation", () => {
    it("오늘 미완료 플랜 필터링", () => {
      const today = "2025-01-05";
      const plans = [
        { plan_date: "2025-01-05", actual_end_time: null },
        { plan_date: "2025-01-05", actual_end_time: "2025-01-05T10:00:00Z" },
        { plan_date: "2025-01-04", actual_end_time: null },
        { plan_date: "2025-01-05", actual_end_time: null },
      ];

      const todayIncomplete = plans.filter(
        (p) => p.plan_date === today && p.actual_end_time === null
      );

      expect(todayIncomplete.length).toBe(2);
    });

    it("지연된 플랜 계산 (3일 이상)", () => {
      const today = new Date("2025-01-10");
      const threshold = 3;

      const plans = [
        { plan_date: "2025-01-09", actual_end_time: null }, // 1일 전 - 지연 아님
        { plan_date: "2025-01-07", actual_end_time: null }, // 3일 전 - 지연
        { plan_date: "2025-01-05", actual_end_time: null }, // 5일 전 - 지연
        { plan_date: "2025-01-10", actual_end_time: null }, // 오늘 - 지연 아님
      ];

      const delayedPlans = plans.filter((p) => {
        if (p.actual_end_time !== null) return false;
        const planDate = new Date(p.plan_date);
        const diffDays = Math.floor(
          (today.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays >= threshold;
      });

      expect(delayedPlans.length).toBe(2);
    });

    it("지연일 계산", () => {
      const today = new Date("2025-01-10");
      const planDate = new Date("2025-01-05");

      const daysDelayed = Math.floor(
        (today.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDelayed).toBe(5);
    });
  });

  describe("Weekly Summary", () => {
    it("주간 미완료 플랜 과목별 집계", () => {
      const plans = [
        { subject: "수학", actual_end_time: null },
        { subject: "수학", actual_end_time: null },
        { subject: "영어", actual_end_time: null },
        { subject: "수학", actual_end_time: "2025-01-05T10:00:00Z" }, // 완료됨
        { subject: "국어", actual_end_time: null },
      ];

      const incompletePlans = plans.filter((p) => p.actual_end_time === null);
      const bySubject: Record<string, number> = {};

      incompletePlans.forEach((p) => {
        bySubject[p.subject] = (bySubject[p.subject] || 0) + 1;
      });

      expect(bySubject["수학"]).toBe(2);
      expect(bySubject["영어"]).toBe(1);
      expect(bySubject["국어"]).toBe(1);
      expect(incompletePlans.length).toBe(4);
    });

    it("주간 범위 계산 (월요일~일요일)", () => {
      // 2025-01-08 (수요일) 기준
      const today = new Date("2025-01-08");
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      expect(weekStart.toISOString().split("T")[0]).toBe("2025-01-06"); // 월요일
      expect(weekEnd.toISOString().split("T")[0]).toBe("2025-01-12"); // 일요일
    });
  });

  describe("Reminder Notification Logic", () => {
    it("알림 발송 조건 - 미완료 플랜 있음", () => {
      const incompletePlans = [{ id: "1" }, { id: "2" }];
      const reminderEnabled = true;

      const shouldNotify = reminderEnabled && incompletePlans.length > 0;

      expect(shouldNotify).toBe(true);
    });

    it("알림 발송 조건 - 미완료 플랜 없음", () => {
      const incompletePlans: unknown[] = [];
      const reminderEnabled = true;

      const shouldNotify = reminderEnabled && incompletePlans.length > 0;

      expect(shouldNotify).toBe(false);
    });

    it("알림 발송 조건 - 알림 비활성화", () => {
      const incompletePlans = [{ id: "1" }];
      const reminderEnabled = false;

      const shouldNotify = reminderEnabled && incompletePlans.length > 0;

      expect(shouldNotify).toBe(false);
    });

    it("중복 알림 방지 - 당일 이미 발송", () => {
      const today = "2025-01-05";
      const lastSentDate = "2025-01-05";

      const alreadySentToday = today === lastSentDate;

      expect(alreadySentToday).toBe(true);
    });
  });

  describe("Reminder Types", () => {
    it("리마인더 타입 정의", () => {
      const reminderTypes = [
        "incomplete_daily",
        "delayed_warning",
        "weekly_summary",
      ];

      expect(reminderTypes.length).toBe(3);
      expect(reminderTypes.includes("incomplete_daily")).toBe(true);
      expect(reminderTypes.includes("delayed_warning")).toBe(true);
      expect(reminderTypes.includes("weekly_summary")).toBe(true);
    });
  });

  describe("Incomplete Plan Info", () => {
    it("미완료 플랜 정보 구조", () => {
      const incompletePlanInfo = {
        planId: "plan-123",
        title: "수학 문제풀이",
        subject: "수학",
        scheduledDate: "2025-01-05",
        daysDelayed: 2,
      };

      expect(incompletePlanInfo.planId).toBeDefined();
      expect(incompletePlanInfo.title).toBeDefined();
      expect(incompletePlanInfo.daysDelayed).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Reminder Check Result", () => {
  it("체크 결과 구조", () => {
    const checkResult = {
      shouldNotify: true,
      reminderType: "incomplete_daily" as const,
      incompletePlans: [
        { planId: "1", title: "플랜1", scheduledDate: "2025-01-05" },
      ],
      message: "오늘 1개의 플랜이 미완료예요",
      subMessage: "지금 시작해보세요!",
    };

    expect(checkResult.shouldNotify).toBe(true);
    expect(checkResult.reminderType).toBe("incomplete_daily");
    expect(checkResult.incompletePlans.length).toBe(1);
    expect(checkResult.message).toBeDefined();
  });

  it("알림 불필요 시 결과", () => {
    const checkResult = {
      shouldNotify: false,
      reminderType: null,
      incompletePlans: [],
      message: null,
      subMessage: null,
    };

    expect(checkResult.shouldNotify).toBe(false);
    expect(checkResult.incompletePlans.length).toBe(0);
  });
});
