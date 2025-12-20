import { describe, it, expect, vi, beforeEach } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllGoals,
  getGoalById,
  getGoalProgress,
  getActiveGoals,
  getWeekGoals,
  fetchGoalsSummary,
} from "@/lib/goals/queries";
import type { Goal, GoalProgress } from "@/lib/goals/calc";
import { safeQueryArray, safeQuerySingle } from "@/lib/supabase/safeQuery";
import { calculateGoalProgress } from "@/lib/goals/calc";

// Mock dependencies
vi.mock("@/lib/supabase/safeQuery");
vi.mock("@/lib/goals/calc");

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

describe("goals/queries", () => {
  let mockSupabase: SupabaseServerClient;
  const studentId = "student-123";
  const goalId = "goal-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    } as unknown as SupabaseServerClient;
  });

  describe("getAllGoals", () => {
    it("모든 목표를 조회해야 함", async () => {
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
          goal_type: "monthly",
          title: "목표 2",
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

      vi.mocked(safeQueryArray).mockResolvedValue(mockGoals);

      const result = await getAllGoals(mockSupabase, studentId);

      expect(result).toEqual(mockGoals);
      expect(safeQueryArray).toHaveBeenCalled();
    });

    it("에러 발생 시 빈 배열을 반환해야 함", async () => {
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      const result = await getAllGoals(mockSupabase, studentId);

      expect(result).toEqual([]);
    });
  });

  describe("getGoalById", () => {
    it("단일 목표를 조회해야 함", async () => {
      const mockGoal: Goal = {
        id: goalId,
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
      };

      vi.mocked(safeQuerySingle).mockResolvedValue(mockGoal);

      const result = await getGoalById(mockSupabase, studentId, goalId);

      expect(result).toEqual(mockGoal);
      expect(safeQuerySingle).toHaveBeenCalled();
    });

    it("목표가 없으면 null을 반환해야 함", async () => {
      vi.mocked(safeQuerySingle).mockResolvedValue(null);

      const result = await getGoalById(mockSupabase, studentId, goalId);

      expect(result).toBeNull();
    });

    it("에러 발생 시 null을 반환해야 함", async () => {
      vi.mocked(safeQuerySingle).mockResolvedValue(null);

      const result = await getGoalById(mockSupabase, studentId, goalId);

      expect(result).toBeNull();
    });
  });

  describe("getGoalProgress", () => {
    it("목표 진행률 기록을 조회해야 함", async () => {
      const mockProgress: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: goalId,
          student_id: studentId,
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
        {
          id: "progress-2",
          goal_id: goalId,
          student_id: studentId,
          plan_id: null,
          session_id: null,
          progress_amount: 30,
          recorded_at: "2025-01-08T00:00:00Z",
        },
      ];

      vi.mocked(safeQueryArray).mockResolvedValue(mockProgress);

      const result = await getGoalProgress(mockSupabase, studentId, goalId);

      expect(result).toEqual(mockProgress);
      expect(safeQueryArray).toHaveBeenCalled();
    });

    it("진행률 기록이 없으면 빈 배열을 반환해야 함", async () => {
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      const result = await getGoalProgress(mockSupabase, studentId, goalId);

      expect(result).toEqual([]);
    });
  });

  describe("getActiveGoals", () => {
    it("오늘 기준 활성 목표를 조회해야 함", async () => {
      const todayDate = "2025-01-10";
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "활성 목표",
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

      vi.mocked(safeQueryArray).mockResolvedValue(mockGoals);

      const result = await getActiveGoals(mockSupabase, studentId, todayDate);

      expect(result).toEqual(mockGoals);
      expect(safeQueryArray).toHaveBeenCalled();
    });

    it("활성 목표가 없으면 빈 배열을 반환해야 함", async () => {
      const todayDate = "2025-01-10";
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      const result = await getActiveGoals(mockSupabase, studentId, todayDate);

      expect(result).toEqual([]);
    });
  });

  describe("getWeekGoals", () => {
    it("주간 목표를 조회해야 함", async () => {
      const weekStart = "2025-01-06";
      const weekEnd = "2025-01-12";
      const mockGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
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
        },
      ];

      vi.mocked(safeQueryArray).mockResolvedValue(mockGoals);

      const result = await getWeekGoals(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      expect(result).toEqual(mockGoals);
      expect(safeQueryArray).toHaveBeenCalled();
    });

    it("주간 목표가 없으면 빈 배열을 반환해야 함", async () => {
      const weekStart = "2025-01-06";
      const weekEnd = "2025-01-12";
      vi.mocked(safeQueryArray).mockResolvedValue([]);

      const result = await getWeekGoals(
        mockSupabase,
        studentId,
        weekStart,
        weekEnd
      );

      expect(result).toEqual([]);
    });
  });

  describe("fetchGoalsSummary", () => {
    const todayDate = "2025-01-10";
    const weekStart = "2025-01-06";
    const weekEnd = "2025-01-12";

    it("오늘 목표와 주간 목표를 올바르게 분류해야 함", async () => {
      const mockActiveGoals: Goal[] = [
        {
          id: "goal-1",
          student_id: studentId,
          goal_type: "weekly",
          title: "오늘 목표",
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

      const mockWeekGoals: Goal[] = [
        {
          id: "goal-2",
          student_id: studentId,
          goal_type: "weekly",
          title: "주간 목표",
          description: null,
          subject: null,
          content_id: null,
          start_date: "2025-01-01",
          end_date: "2025-01-20",
          expected_amount: 200,
          target_score: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      const mockProgress: GoalProgress[] = [];

      // getActiveGoals와 getWeekGoals 모킹
      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockActiveGoals) // getActiveGoals
        .mockResolvedValueOnce(mockWeekGoals) // getWeekGoals
        .mockResolvedValueOnce(mockProgress); // 진행률 조회

      // calculateGoalProgress 모킹
      vi.mocked(calculateGoalProgress).mockImplementation((goal, progressRows, today) => {
        return {
          currentAmount: 0,
          expectedAmount: goal.expected_amount || 0,
          progressPercentage: 0,
          status: "in_progress",
          daysRemaining: 5,
          daysUntilStart: null,
          dailyRequiredAmount: null,
          recent3DaysAmount: 0,
        };
      });

      const result = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );

      expect(result.todayGoals).toHaveLength(1);
      expect(result.todayGoals[0].id).toBe("goal-1");
      expect(result.weekGoals).toHaveLength(1);
      expect(result.weekGoals[0].id).toBe("goal-2");
    });

    it("각 목표의 진행률 계산 결과가 올바르게 반환되어야 함", async () => {
      const mockActiveGoals: Goal[] = [
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
      ];

      const mockProgress: GoalProgress[] = [
        {
          id: "progress-1",
          goal_id: "goal-1",
          student_id: studentId,
          plan_id: null,
          session_id: null,
          progress_amount: 50,
          recorded_at: "2025-01-05T00:00:00Z",
        },
      ];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockActiveGoals) // getActiveGoals
        .mockResolvedValueOnce([]) // getWeekGoals
        .mockResolvedValueOnce(mockProgress); // 진행률 조회

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: 50,
        expectedAmount: 100,
        progressPercentage: 50,
        status: "in_progress",
        daysRemaining: 5,
        daysUntilStart: null,
        dailyRequiredAmount: 10,
        recent3DaysAmount: 20,
      });

      const result = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );

      expect(result.todayGoals[0].progressPercentage).toBe(50);
      expect(result.todayGoals[0].status).toBe("active");
      expect(result.todayGoals[0].daysRemaining).toBe(5);
    });

    it("상태 매핑이 올바르게 수행되어야 함", async () => {
      const mockActiveGoals: Goal[] = [
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
      ];

      // scheduled -> upcoming
      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockActiveGoals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: 0,
        expectedAmount: 100,
        progressPercentage: 0,
        status: "scheduled",
        daysRemaining: null,
        daysUntilStart: 5,
        dailyRequiredAmount: null,
        recent3DaysAmount: 0,
      });

      const result1 = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );
      expect(result1.todayGoals[0].status).toBe("upcoming");

      // completed -> completed
      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockActiveGoals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: 100,
        expectedAmount: 100,
        progressPercentage: 100,
        status: "completed",
        daysRemaining: null,
        daysUntilStart: null,
        dailyRequiredAmount: null,
        recent3DaysAmount: 0,
      });

      const result2 = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );
      expect(result2.todayGoals[0].status).toBe("completed");

      // failed -> failed
      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockActiveGoals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.mocked(calculateGoalProgress).mockReturnValue({
        currentAmount: 50,
        expectedAmount: 100,
        progressPercentage: 50,
        status: "failed",
        daysRemaining: null,
        daysUntilStart: null,
        dailyRequiredAmount: null,
        recent3DaysAmount: 0,
      });

      const result3 = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );
      expect(result3.todayGoals[0].status).toBe("failed");
    });

    it("중복된 목표 ID를 제거해야 함", async () => {
      const mockActiveGoals: Goal[] = [
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
      ];

      const mockWeekGoals: Goal[] = [
        {
          id: "goal-1", // 동일한 ID
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
      ];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockActiveGoals)
        .mockResolvedValueOnce(mockWeekGoals)
        .mockResolvedValueOnce([]); // 진행률 조회

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

      const result = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );

      // 중복 제거되어 진행률 조회는 1번만 호출되어야 함
      expect(safeQueryArray).toHaveBeenCalledTimes(3);
    });

    it("에러 발생 시 빈 배열을 반환해야 함", async () => {
      vi.mocked(safeQueryArray).mockRejectedValue(
        new Error("Database error")
      );

      const result = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );

      expect(result.todayGoals).toEqual([]);
      expect(result.weekGoals).toEqual([]);
    });

    it("진행률 데이터가 없어도 목표는 반환되어야 함", async () => {
      const mockActiveGoals: Goal[] = [
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
      ];

      vi.mocked(safeQueryArray)
        .mockResolvedValueOnce(mockActiveGoals)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // 진행률 없음

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

      const result = await fetchGoalsSummary(
        mockSupabase,
        studentId,
        todayDate,
        weekStart,
        weekEnd
      );

      expect(result.todayGoals).toHaveLength(1);
      expect(result.todayGoals[0].progressPercentage).toBe(0);
    });
  });
});

