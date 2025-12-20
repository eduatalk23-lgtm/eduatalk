import { describe, it, expect } from "vitest";
import {
  calculateGoalProgress,
  getGoalStatusLabel,
  getGoalTypeLabel,
  getGoalTypeColor,
  type Goal,
  type GoalProgress,
} from "@/lib/goals/calc";

describe("calculateGoalProgress", () => {
  const baseGoal: Goal = {
    id: "goal-1",
    student_id: "student-123",
    goal_type: "weekly",
    title: "주간 목표",
    description: null,
    subject: null,
    content_id: null,
    start_date: "2025-01-01",
    end_date: "2025-01-15",
    expected_amount: 100,
    target_score: null,
    created_at: "2025-01-01T00:00:00Z",
  };

  describe("진행률(%) 계산 검증", () => {
    it("진행률을 올바르게 계산해야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
        {
          id: "progress-2",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 30,
          recorded_at: "2025-01-08T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      // 50 + 30 = 80 / 100 = 80%
      expect(result.currentAmount).toBe(80);
      expect(result.expectedAmount).toBe(100);
      expect(result.progressPercentage).toBe(80);
    });

    it("진행률이 100%를 초과하면 100%로 제한해야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 120, // 100 초과
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      // 120 / 100 = 120% -> 100%로 제한
      expect(result.currentAmount).toBe(120);
      expect(result.progressPercentage).toBe(100);
    });

    it("expected_amount가 0이면 진행률은 0%여야 함", () => {
      const goal: Goal = {
        ...baseGoal,
        expected_amount: 0,
      };

      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(goal, progressRows, today);

      expect(result.progressPercentage).toBe(0);
    });

    it("expected_amount가 null이면 진행률은 0%여야 함", () => {
      const goal: Goal = {
        ...baseGoal,
        expected_amount: null,
      };

      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(goal, progressRows, today);

      expect(result.expectedAmount).toBe(0);
      expect(result.progressPercentage).toBe(0);
    });

    it("progress_amount가 null이면 0으로 처리해야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: null,
          recorded_at: "2025-01-05T00:00:00Z",
        },
        {
          id: "progress-2",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 30,
          recorded_at: "2025-01-08T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      // null은 0으로 처리: 0 + 30 = 30
      expect(result.currentAmount).toBe(30);
    });

    it("진행률은 반올림되어야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 33, // 33/100 = 33%
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      // 33/100 = 33% (반올림)
      expect(result.progressPercentage).toBe(33);
    });
  });

  describe("상태 판별 로직 검증", () => {
    it("시작일 이전이면 'scheduled' 상태여야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2024-12-31"); // 시작일 이전

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.status).toBe("scheduled");
    });

    it("진행률 100% 이상이면 'completed' 상태여야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 100,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.status).toBe("completed");
    });

    it("마감일 지났고 진행률 100% 미만이면 'failed' 상태여야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-16"); // 마감일 지남
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.status).toBe("failed");
    });

    it("진행 중이면 'in_progress' 상태여야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.status).toBe("in_progress");
    });

    it("상태 우선순위: completed > failed > scheduled > in_progress", () => {
      // completed 우선
      const progressRows1: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 100,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];
      const today1 = new Date("2025-01-16"); // 마감일 지남이지만 완료
      const result1 = calculateGoalProgress(baseGoal, progressRows1, today1);
      expect(result1.status).toBe("completed");

      // failed (마감일 지남 + 미완료)
      const progressRows2: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];
      const today2 = new Date("2025-01-16");
      const result2 = calculateGoalProgress(baseGoal, progressRows2, today2);
      expect(result2.status).toBe("failed");

      // scheduled (시작일 이전)
      const progressRows3: GoalProgress[] = [];
      const today3 = new Date("2024-12-31");
      const result3 = calculateGoalProgress(baseGoal, progressRows3, today3);
      expect(result3.status).toBe("scheduled");
    });
  });

  describe("daysRemaining (D-Day) 계산 검증", () => {
    it("오늘 날짜 기준으로 남은 일수를 올바르게 계산해야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2025-01-10");
      // end_date: 2025-01-15, today: 2025-01-10
      // 남은 일수: 5일

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.daysRemaining).toBe(5);
    });

    it("마감일 당일이면 daysRemaining은 0이어야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2025-01-15"); // 마감일 당일

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.daysRemaining).toBe(0);
    });

    it("마감일이 지났으면 daysRemaining은 null이어야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2025-01-16"); // 마감일 지남

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.daysRemaining).toBeNull();
    });

    it("daysRemaining은 올림 처리되어야 함", () => {
      const goal: Goal = {
        ...baseGoal,
        end_date: "2025-01-11", // 내일
      };
      const progressRows: GoalProgress[] = [];
      const today = new Date("2025-01-10"); // 오늘

      const result = calculateGoalProgress(goal, progressRows, today);

      // 내일까지 1일 남음
      expect(result.daysRemaining).toBe(1);
    });
  });

  describe("daysUntilStart 계산 검증", () => {
    it("시작일 이전이면 시작까지 남은 일수를 계산해야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2024-12-28");
      // start_date: 2025-01-01, today: 2024-12-28
      // 시작까지: 4일

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.daysUntilStart).toBe(4);
    });

    it("시작일 이후면 daysUntilStart는 null이어야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2025-01-10");

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.daysUntilStart).toBeNull();
    });

    it("시작일 당일이면 daysUntilStart는 null이어야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2025-01-01"); // 시작일 당일

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.daysUntilStart).toBeNull();
    });
  });

  describe("dailyRequiredAmount (일일 권장 학습량) 계산 검증", () => {
    it("진행 중이고 남은 일수가 있으면 일일 권장량을 계산해야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      // 남은 일수: 5일, 남은 양: 50
      // 일일 권장량: 50 / 5 = 10 (올림)

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.dailyRequiredAmount).toBe(10);
    });

    it("일일 권장량은 올림 처리되어야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-13");
      // 남은 일수: 2일, 남은 양: 50
      // 일일 권장량: 50 / 2 = 25

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.dailyRequiredAmount).toBe(25);
    });

    it("완료된 목표는 일일 권장량이 null이어야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 100,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-10");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.status).toBe("completed");
      expect(result.dailyRequiredAmount).toBeNull();
    });

    it("마감일이 지난 목표는 일일 권장량이 null이어야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-16");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.status).toBe("failed");
      expect(result.dailyRequiredAmount).toBeNull();
    });

    it("시작일 이전 목표는 일일 권장량이 null이어야 함", () => {
      const progressRows: GoalProgress[] = [];
      const today = new Date("2024-12-31");

      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.status).toBe("scheduled");
      expect(result.dailyRequiredAmount).toBeNull();
    });
  });

  describe("recent3DaysAmount (최근 3일 학습량) 계산 검증", () => {
    it("최근 3일 내의 진행률만 합산해야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 20,
          recorded_at: "2025-01-08T00:00:00Z", // 3일 전
        },
        {
          id: "progress-2",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 30,
          recorded_at: "2025-01-09T00:00:00Z", // 2일 전
        },
        {
          id: "progress-3",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 10,
          recorded_at: "2025-01-10T00:00:00Z", // 1일 전
        },
        {
          id: "progress-4",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z", // 5일 전 (제외)
        },
      ];

      const today = new Date("2025-01-11");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      // 최근 3일: 20 + 30 + 10 = 60
      expect(result.recent3DaysAmount).toBe(60);
    });

    it("최근 3일 내 진행률이 없으면 0이어야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z", // 5일 전
        },
      ];

      const today = new Date("2025-01-11");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      expect(result.recent3DaysAmount).toBe(0);
    });

    it("progress_amount가 null이면 0으로 처리해야 함", () => {
      const progressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: null,
          recorded_at: "2025-01-10T00:00:00Z",
        },
        {
          id: "progress-2",
          goal_id: "goal-1",
          student_id: "student-123",
          plan_id: null,
          session_id: null,
          progress_amount: 30,
          recorded_at: "2025-01-09T00:00:00Z",
        },
      ];

      const today = new Date("2025-01-11");
      const result = calculateGoalProgress(baseGoal, progressRows, today);

      // null은 0으로 처리: 0 + 30 = 30
      expect(result.recent3DaysAmount).toBe(30);
    });
  });

  describe("유틸리티 함수 검증", () => {
    it("getGoalStatusLabel이 올바른 라벨을 반환해야 함", () => {
      expect(getGoalStatusLabel("scheduled")).toBe("예정");
      expect(getGoalStatusLabel("in_progress")).toBe("진행중");
      expect(getGoalStatusLabel("completed")).toBe("완료");
      expect(getGoalStatusLabel("failed")).toBe("미달성");
    });

    it("getGoalTypeLabel이 올바른 라벨을 반환해야 함", () => {
      expect(getGoalTypeLabel("range")).toBe("단원/범위");
      expect(getGoalTypeLabel("exam")).toBe("시험 대비");
      expect(getGoalTypeLabel("weekly")).toBe("주간 목표");
      expect(getGoalTypeLabel("monthly")).toBe("월간 목표");
    });

    it("getGoalTypeColor이 올바른 색상을 반환해야 함", () => {
      expect(getGoalTypeColor("range")).toBe("bg-blue-100 text-blue-800");
      expect(getGoalTypeColor("exam")).toBe("bg-red-100 text-red-800");
      expect(getGoalTypeColor("weekly")).toBe("bg-green-100 text-green-800");
      expect(getGoalTypeColor("monthly")).toBe("bg-purple-100 text-purple-800");
    });
  });
});

