import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { TODAY_PROGRESS_CONSTANTS } from "@/lib/metrics/constants";

// Mock dependencies - 동적 import로 모킹
vi.mock("@/lib/data/studentPlans", async () => {
  const actual = await vi.importActual("@/lib/data/studentPlans");
  return {
    ...actual,
    getPlansForStudent: vi.fn(),
  };
});

vi.mock("@/lib/data/studentSessions", async () => {
  const actual = await vi.importActual("@/lib/data/studentSessions");
  return {
    ...actual,
    getSessionsInRange: vi.fn(),
  };
});

vi.mock("@/lib/data/planGroups", async () => {
  const actual = await vi.importActual("@/lib/data/planGroups");
  return {
    ...actual,
    getPlanGroupsForStudent: vi.fn(),
  };
});

vi.mock("@/lib/metrics/studyTime", async () => {
  const actual = await vi.importActual("@/lib/metrics/studyTime");
  return {
    ...actual,
    calculatePlanStudySeconds: vi.fn(),
    buildActiveSessionMap: vi.fn(),
  };
});

vi.mock("@/lib/utils/planUtils", async () => {
  return {
    isCompletedPlan: vi.fn((plan: any) => {
      // actual_end_time이 있으면 완료로 간주
      return !!plan.actual_end_time;
    }),
    filterLearningPlans: vi.fn((plans: any[]) => {
      // 더미 콘텐츠 제외 (content_id가 "dummy"로 시작하지 않는 것만)
      return plans.filter((p) => !p.content_id?.startsWith("dummy"));
    }),
  };
});

describe("calculateTodayProgress", () => {
  const studentId = "student-123";
  const tenantId = "tenant-123";
  const targetDate = "2025-01-15";

  beforeEach(async () => {
    vi.clearAllMocks();
    // 동적 import로 모킹된 함수 가져오기
    const { getPlansForStudent } = await import("@/lib/data/studentPlans");
    const { getSessionsInRange } = await import("@/lib/data/studentSessions");
    const { getPlanGroupsForStudent } = await import("@/lib/data/planGroups");
    const { calculatePlanStudySeconds, buildActiveSessionMap } = await import("@/lib/metrics/studyTime");
    
    vi.mocked(getPlansForStudent).mockResolvedValue([]);
    vi.mocked(getSessionsInRange).mockResolvedValue([]);
    vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
    vi.mocked(calculatePlanStudySeconds).mockReturnValue(0);
    vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());
  });

  describe("학습시간 합산 검증", () => {
    it("여러 플랜의 학습시간을 올바르게 합산해야 함", async () => {
      const { getPlansForStudent } = await import("@/lib/data/studentPlans");
      const { getSessionsInRange } = await import("@/lib/data/studentSessions");
      const { getPlanGroupsForStudent } = await import("@/lib/data/planGroups");
      const { calculatePlanStudySeconds, buildActiveSessionMap } = await import("@/lib/metrics/studyTime");

      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z",
          total_duration_seconds: 3600, // 60분
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
        {
          id: "plan-2",
          actual_start_time: "2025-01-15T14:00:00Z",
          actual_end_time: "2025-01-15T15:30:00Z",
          total_duration_seconds: 5400, // 90분
          paused_duration_seconds: 0,
          content_id: "book-2",
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds)
        .mockReturnValueOnce(3600) // plan-1: 60분
        .mockReturnValueOnce(5400); // plan-2: 90분
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // 60분 + 90분 = 150분
      expect(result.todayStudyMinutes).toBe(150);
    });

    it("calculatePlanStudySeconds와 올바르게 연동되어야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: null, // 진행 중
          total_duration_seconds: null,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
      ];

      const mockSessions = [
        {
          id: "session-1",
          plan_id: "plan-1",
          started_at: "2025-01-15T10:00:00Z",
          ended_at: null,
        },
      ];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions as any);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(buildActiveSessionMap).mockReturnValue(
        new Map([["plan-1", mockSessions[0] as any]])
      );
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(1800); // 30분

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // calculatePlanStudySeconds가 호출되었는지 확인
      expect(calculatePlanStudySeconds).toHaveBeenCalled();
      expect(result.todayStudyMinutes).toBe(30);
    });

    it("일시정지 시간을 제외한 순수 학습시간을 계산해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z",
          total_duration_seconds: 3600, // 60분
          paused_duration_seconds: 600, // 10분 일시정지
          content_id: "book-1",
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(3000); // 50분 (60분 - 10분)
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // 일시정지 제외: 50분
      expect(result.todayStudyMinutes).toBe(50);
    });
  });

  describe("achievementScore 계산 검증", () => {
    it("실행률과 집중 타이머 비율로 achievementScore를 계산해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z", // 완료
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
        {
          id: "plan-2",
          actual_start_time: "2025-01-15T14:00:00Z",
          actual_end_time: null, // 미완료
          total_duration_seconds: null,
          paused_duration_seconds: 0,
          content_id: "book-2",
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds)
        .mockReturnValueOnce(3600) // plan-1: 60분
        .mockReturnValueOnce(0); // plan-2: 0분
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // 실행률: 1/2 = 50%
      // 예상 시간: 2개 * 60분 = 120분
      // 집중 타이머 비율: 60/120 = 50%
      // achievementScore: (50 * 0.7) + (50 * 0.3) = 35 + 15 = 50
      expect(result.planTotalCount).toBe(2);
      expect(result.planCompletedCount).toBe(1);
      expect(result.achievementScore).toBe(50);
    });

    it("실행률 가중치(0.7)와 집중 타이머 가중치(0.3)를 올바르게 적용해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z", // 완료
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(3600); // 60분
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // 실행률: 1/1 = 100%
      // 예상 시간: 1개 * 60분 = 60분
      // 집중 타이머 비율: 60/60 = 100%
      // achievementScore: (100 * 0.7) + (100 * 0.3) = 70 + 30 = 100
      expect(result.achievementScore).toBe(100);
    });

    it("constants.ts의 가중치 값을 사용해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(3600);
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // constants.ts의 가중치 사용 확인
      const expectedScore = Math.round(
        100 * TODAY_PROGRESS_CONSTANTS.EXECUTION_RATE_WEIGHT +
          100 * TODAY_PROGRESS_CONSTANTS.FOCUS_TIMER_WEIGHT
      );
      expect(result.achievementScore).toBe(expectedScore);
    });

    it("집중 타이머 비율이 100%를 초과하면 100%로 제한해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(7200); // 120분 (예상 60분의 2배)
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // 집중 타이머 비율: 120/60 = 200% -> 100%로 제한
      // achievementScore: (100 * 0.7) + (100 * 0.3) = 100
      expect(result.achievementScore).toBe(100);
    });

    it("플랜이 없으면 achievementScore는 0이어야 함", async () => {
      vi.mocked(getPlansForStudent).mockResolvedValue([]);
      vi.mocked(getSessionsInRange).mockResolvedValue([]);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      expect(result.planTotalCount).toBe(0);
      expect(result.achievementScore).toBe(0);
    });
  });

  describe("캠프 모드 제외 검증", () => {
    it("excludeCampMode가 true이면 캠프 플랜 그룹을 제외해야 함", async () => {
      const mockPlanGroups = [
        {
          id: "group-1",
          plan_type: "camp",
          camp_template_id: "template-1",
          camp_invitation_id: null,
        },
        {
          id: "group-2",
          plan_type: "normal",
          camp_template_id: null,
          camp_invitation_id: null,
        },
      ];

      const mockPlans = [
        {
          id: "plan-1",
          plan_group_id: "group-1", // 캠프 그룹
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
        {
          id: "plan-2",
          plan_group_id: "group-2", // 일반 그룹
          actual_start_time: "2025-01-15T14:00:00Z",
          actual_end_time: "2025-01-15T15:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-2",
        },
      ];

      vi.mocked(getPlanGroupsForStudent).mockResolvedValue(
        mockPlanGroups as any
      );
      vi.mocked(getPlansForStudent).mockResolvedValue([mockPlans[1]] as any); // 캠프 제외된 결과
      vi.mocked(getSessionsInRange).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(3600);
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate,
        true // excludeCampMode = true
      );

      // 캠프 플랜이 제외되어야 함
      expect(result.planTotalCount).toBe(1);
      expect(result.planCompletedCount).toBe(1);
    });

    it("excludeCampMode가 false이면 모든 플랜을 포함해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          plan_group_id: "group-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
        {
          id: "plan-2",
          plan_group_id: "group-2",
          actual_start_time: "2025-01-15T14:00:00Z",
          actual_end_time: "2025-01-15T15:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-2",
        },
      ];

      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(3600);
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate,
        false // excludeCampMode = false
      );

      // 모든 플랜 포함
      expect(result.planTotalCount).toBe(2);
    });

    it("캠프 플랜 그룹 필터링 조건을 올바르게 적용해야 함", async () => {
      const mockPlanGroups = [
        {
          id: "group-1",
          plan_type: "camp",
          camp_template_id: "template-1",
          camp_invitation_id: null,
        },
        {
          id: "group-2",
          plan_type: "camp",
          camp_template_id: null,
          camp_invitation_id: "invitation-1",
        },
        {
          id: "group-3",
          plan_type: "normal",
          camp_template_id: null,
          camp_invitation_id: null,
        },
      ];

      vi.mocked(getPlanGroupsForStudent).mockResolvedValue(
        mockPlanGroups as any
      );

      await calculateTodayProgress(studentId, tenantId, targetDate, true);

      // getPlansForStudent가 planGroupIds로 필터링되어 호출되어야 함
      expect(getPlansForStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          planGroupIds: ["group-3"], // 캠프 그룹 제외
        })
      );
    });
  });

  describe("플랜 완료 수 계산 검증", () => {
    it("actual_end_time이 있는 플랜만 완료로 카운트해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z", // 완료
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1",
        },
        {
          id: "plan-2",
          actual_start_time: "2025-01-15T14:00:00Z",
          actual_end_time: null, // 미완료
          total_duration_seconds: null,
          paused_duration_seconds: 0,
          content_id: "book-2",
        },
        {
          id: "plan-3",
          actual_start_time: "2025-01-15T16:00:00Z",
          actual_end_time: "2025-01-15T17:00:00Z", // 완료
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-3",
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(3600);
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // 완료: plan-1, plan-3 (2개)
      expect(result.planTotalCount).toBe(3);
      expect(result.planCompletedCount).toBe(2);
    });
  });

  describe("방어 로직 검증", () => {
    it("더미 콘텐츠는 학습 플랜에서 제외해야 함", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          actual_start_time: "2025-01-15T10:00:00Z",
          actual_end_time: "2025-01-15T11:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "dummy-rest", // 더미 콘텐츠
        },
        {
          id: "plan-2",
          actual_start_time: "2025-01-15T14:00:00Z",
          actual_end_time: "2025-01-15T15:00:00Z",
          total_duration_seconds: 3600,
          paused_duration_seconds: 0,
          content_id: "book-1", // 일반 콘텐츠
        },
      ];

      const mockSessions: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans as any);
      vi.mocked(getSessionsInRange).mockResolvedValue(mockSessions);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);
      vi.mocked(calculatePlanStudySeconds).mockReturnValue(3600);
      vi.mocked(buildActiveSessionMap).mockReturnValue(new Map());

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      // 더미 콘텐츠 제외: 1개만
      expect(result.planTotalCount).toBe(1);
    });

    it("targetDate가 없으면 오늘 날짜를 사용해야 함", async () => {
      const mockPlans: any[] = [];

      vi.mocked(getPlansForStudent).mockResolvedValue(mockPlans);
      vi.mocked(getSessionsInRange).mockResolvedValue([]);
      vi.mocked(getPlanGroupsForStudent).mockResolvedValue([]);

      await calculateTodayProgress(studentId, tenantId);

      // getPlansForStudent가 호출되었는지 확인 (오늘 날짜로)
      expect(getPlansForStudent).toHaveBeenCalled();
    });

    it("에러 발생 시 빈 결과를 반환해야 함", async () => {
      vi.mocked(getPlansForStudent).mockRejectedValue(
        new Error("Database error")
      );

      const result = await calculateTodayProgress(
        studentId,
        tenantId,
        targetDate
      );

      expect(result.todayStudyMinutes).toBe(0);
      expect(result.planCompletedCount).toBe(0);
      expect(result.planTotalCount).toBe(0);
      expect(result.achievementScore).toBe(0);
    });
  });
});

