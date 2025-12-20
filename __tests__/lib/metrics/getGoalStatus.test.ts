import { describe, it, expect, vi, beforeEach } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGoalStatus } from "@/lib/metrics/getGoalStatus";
import { getActiveGoals } from "@/lib/goals/queries";
import { calculateGoalProgress, type Goal, type GoalProgress } from "@/lib/goals/calc";
import { GOAL_CONSTANTS } from "@/lib/metrics/constants";

// Mock dependencies
vi.mock("@/lib/goals/queries");
vi.mock("@/lib/goals/calc");
vi.mock("@/lib/supabase/safeQuery");

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

describe("getGoalStatus", () => {
  let mockSupabase: SupabaseServerClient;
  const studentId = "student-123";
  const todayDate = "2025-01-10";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    } as unknown as SupabaseServerClient;
  });

  describe("데이터 그룹화 로직 검증", () => {
    it("모든 목표의 진행률 데이터를 goal_id별로 올바르게 그룹화해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "주간 목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-2",
          student_id: studentId,
          goal_type: "monthly",
          title: "월간 목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-31",
          expected_amount: 200,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      const mockProgressRows: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: studentId,
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
        {
          id: "progress-2",
          goal_id: "goal-1",
          student_id: studentId,
          plan_id: null,
          session_id: null,
          progress_amount: 30,
          recorded_at: "2025-01-08T00:00:00Z",
        },
        {
          id: "progress-3",
          goal_id: "goal-2",
          student_id: studentId,
          plan_id: null,
          session_id: null,
          progress_amount: 100,
          recorded_at: "2025-01-09T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue(mockProgressRows as any);

      // Mock calculateGoalProgress
      vi.mocked(calculateGoalProgress).mockImplementation((goal, progressRows, today) => {
        const totalProgress = progressRows.reduce(
          (sum, p) => sum + (p.progress_amount || 0),
          0
        );
        const progressPercentage =
          goal.expected_amount && goal.expected_amount > 0
            ? Math.min(100, Math.round((totalProgress / goal.expected_amount) * 100))
            : 0;

        const endDate = new Date(goal.end_date);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
          currentAmount: totalProgress,
          expectedAmount: goal.expected_amount || 0,
          progressPercentage,
          status: progressPercentage >= 100 ? "completed" : "in_progress",
          daysRemaining: daysRemaining > 0 ? daysRemaining : null,
          daysUntilStart: null,
          dailyRequiredAmount: null,
          recent3DaysAmount: 0,
        };
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      // goal-1: 50 + 30 = 80 / 100 = 80%
      // goal-2: 100 / 200 = 50%
      expect(result.totalActiveGoals).toBe(2);
      expect(result.goals).toHaveLength(2);
      expect(result.goals.find((g) => g.id === "goal-1")?.progressPercentage).toBe(80);
      expect(result.goals.find((g) => g.id === "goal-2")?.progressPercentage).toBe(50);
    });

    it("진행률 데이터가 없는 목표도 처리해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "주간 목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]); // 진행률 데이터 없음

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: 0,
        expectedAmount: 100,
        progressPercentage: 0,
        status: "in_progress",
        daysRemaining: 5,
        daysUntilStart: null,
        dailyRequiredAmount: null,
        recent3DaysAmount: 0,
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      expect(result.totalActiveGoals).toBe(1);
      expect(result.goals[0].progressPercentage).toBe(0);
    });
  });

  describe("기준값에 따른 분류 검증", () => {
    it("D-7 이내 목표를 올바르게 카운트해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-17", // D-7 (7일 남음)
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-2",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 2",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-20", // D-10 (10일 남음)
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockImplementation((goal, _, today) => {
        const endDate = new Date(goal.end_date);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
          currentAmount: 0,
          expectedAmount: 100,
          progressPercentage: 0,
          status: "in_progress",
          daysRemaining: daysRemaining > 0 ? daysRemaining : null,
          daysUntilStart: null,
          dailyRequiredAmount: null,
          recent3DaysAmount: 0,
        };
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      // goal-1: 7일 남음 (D-7 이내), goal-2: 10일 남음 (D-7 초과)
      expect(result.goalsNearDeadline).toBe(1);
    });

    it("D-3 이내 목표를 올바르게 카운트해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-13", // D-3 (3일 남음)
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-2",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 2",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15", // D-5 (5일 남음)
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockImplementation((goal, _, today) => {
        const endDate = new Date(goal.end_date);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
          currentAmount: 0,
          expectedAmount: 100,
          progressPercentage: 0,
          status: "in_progress",
          daysRemaining: daysRemaining > 0 ? daysRemaining : null,
          daysUntilStart: null,
          dailyRequiredAmount: null,
          recent3DaysAmount: 0,
        };
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      // goal-1: 3일 남음 (D-3 이내), goal-2: 5일 남음 (D-3 초과)
      expect(result.goalsVeryNearDeadline).toBe(1);
    });

    it("진행률 30% 미만 목표를 올바르게 카운트해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-2",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 2",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-3",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 3",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockImplementation((goal) => {
        const progressMap: Record<string, number> = {
          "goal-1": 20, // 20% < 30%
          "goal-2": 30, // 30% = 30% (경계값, 미만이 아님)
          "goal-3": 40, // 40% >= 30%
        };

        return {
          currentAmount: 0,
          expectedAmount: 100,
          progressPercentage: progressMap[goal.id] || 0,
          status: "in_progress",
          daysRemaining: 5,
          daysUntilStart: null,
          dailyRequiredAmount: null,
          recent3DaysAmount: 0,
        };
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      // goal-1만 30% 미만
      expect(result.lowProgressGoals).toBe(1);
    });

    it("진행률 50% 미만 목표를 올바르게 카운트해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-2",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 2",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockImplementation((goal) => {
        const progressMap: Record<string, number> = {
          "goal-1": 40, // 40% < 50%
          "goal-2": 60, // 60% >= 50%
        };

        return {
          currentAmount: 0,
          expectedAmount: 100,
          progressPercentage: progressMap[goal.id] || 0,
          status: "in_progress",
          daysRemaining: 5,
          daysUntilStart: null,
          dailyRequiredAmount: null,
          recent3DaysAmount: 0,
        };
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      // goal-1만 50% 미만
      expect(result.veryLowProgressGoals).toBe(1);
    });

    it("constants.ts의 기준값을 사용해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-17", // D-7
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: GOAL_CONSTANTS.LOW_PROGRESS_THRESHOLD - 1,
        expectedAmount: 100,
        progressPercentage: GOAL_CONSTANTS.LOW_PROGRESS_THRESHOLD - 1,
        status: "in_progress",
        daysRemaining: GOAL_CONSTANTS.NEAR_DEADLINE_DAYS,
        daysUntilStart: null,
        dailyRequiredAmount: null,
        recent3DaysAmount: 0,
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      // LOW_PROGRESS_THRESHOLD(30) 미만
      expect(result.lowProgressGoals).toBe(1);
      // NEAR_DEADLINE_DAYS(7) 이내
      expect(result.goalsNearDeadline).toBe(1);
    });
  });

  describe("평균 진행률 계산", () => {
    it("여러 목표의 평균 진행률을 올바르게 계산해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-2",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 2",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "goal-3",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 3",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockImplementation((goal) => {
        const progressMap: Record<string, number> = {
          "goal-1": 30,
          "goal-2": 50,
          "goal-3": 70,
        };

        return {
          currentAmount: 0,
          expectedAmount: 100,
          progressPercentage: progressMap[goal.id] || 0,
          status: "in_progress",
          daysRemaining: 5,
          daysUntilStart: null,
          dailyRequiredAmount: null,
          recent3DaysAmount: 0,
        };
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      // (30 + 50 + 70) / 3 = 50
      expect(result.averageProgress).toBe(50);
    });

    it("목표가 없으면 평균 진행률은 0이어야 함", async () => {
      vi.mocked(getActiveGoals).mockResolvedValue([]);

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      expect(result.averageProgress).toBe(0);
      expect(result.totalActiveGoals).toBe(0);
    });
  });

  describe("방어 로직 검증", () => {
    it("빈 목표 배열에 대해 빈 결과를 반환해야 함", async () => {
      vi.mocked(getActiveGoals).mockResolvedValue([]);

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      expect(result.totalActiveGoals).toBe(0);
      expect(result.goalsNearDeadline).toBe(0);
      expect(result.goalsVeryNearDeadline).toBe(0);
      expect(result.averageProgress).toBe(0);
      expect(result.lowProgressGoals).toBe(0);
      expect(result.veryLowProgressGoals).toBe(0);
      expect(result.goals).toEqual([]);
    });

    it("진행률 데이터가 null이거나 undefined인 경우 처리해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-15",
          expected_amount: null, // null
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: 0,
        expectedAmount: 0,
        progressPercentage: 0,
        status: "in_progress",
        daysRemaining: 5,
        daysUntilStart: null,
        dailyRequiredAmount: null,
        recent3DaysAmount: 0,
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      expect(result.totalActiveGoals).toBe(1);
      expect(result.goals[0].progressPercentage).toBe(0);
    });

    it("daysRemaining이 null인 경우 처리해야 함", async () => {
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "목표 1",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-05", // 이미 지난 날짜
          expected_amount: 100,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      vi.mocked(getActiveGoals).mockResolvedValue(mockGoals);

      const { safeQueryArray } = await import("@/lib/supabase/safeQuery");
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: 0,
        expectedAmount: 100,
        progressPercentage: 0,
        status: "failed",
        daysRemaining: null, // null
        daysUntilStart: null,
        dailyRequiredAmount: null,
        recent3DaysAmount: 0,
      });

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      expect(result.goals[0].daysRemaining).toBeNull();
      expect(result.goalsNearDeadline).toBe(0); // null은 카운트되지 않음
      expect(result.goalsVeryNearDeadline).toBe(0);
    });
  });

  describe("에러 처리", () => {
    it("에러 발생 시 빈 결과를 반환해야 함", async () => {
      vi.mocked(getActiveGoals).mockRejectedValue(new Error("Database error"));

      const result = await getGoalStatus(mockSupabase, studentId, todayDate);

      expect(result.totalActiveGoals).toBe(0);
      expect(result.goalsNearDeadline).toBe(0);
      expect(result.goalsVeryNearDeadline).toBe(0);
      expect(result.averageProgress).toBe(0);
      expect(result.lowProgressGoals).toBe(0);
      expect(result.veryLowProgressGoals).toBe(0);
      expect(result.goals).toEqual([]);
    });
  });
});

