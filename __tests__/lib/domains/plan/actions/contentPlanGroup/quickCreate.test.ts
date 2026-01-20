/**
 * Quick Create Server Action 테스트
 *
 * createQuickPlan 및 createQuickPlanForStudent 액션의 인증 및 생성 로직 테스트
 *
 * @module __tests__/lib/domains/plan/actions/contentPlanGroup/quickCreate.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/strategies", () => ({
  resolveAuthContext: vi.fn(),
  isAdminContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionSuccess: vi.fn(),
  logActionWarn: vi.fn(),
  logActionDebug: vi.fn(),
}));

vi.mock("@/lib/domains/plan/actions/planners/autoCreate", () => ({
  getOrCreateDefaultPlannerAction: vi.fn(),
}));

vi.mock("@/lib/domains/admin-plan/utils/planGroupSelector", () => ({
  selectPlanGroupForPlanner: vi.fn(),
  createPlanGroupForPlanner: vi.fn(),
}));

vi.mock("@/lib/domains/admin-plan/actions/planEvent", () => ({
  logQuickPlanCreated: vi.fn().mockResolvedValue({}),
  logPlansBatchCreated: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/query/keys", () => ({
  buildPlanCreationHints: vi.fn().mockReturnValue({ invalidationHints: [] }),
}));

vi.mock("@/lib/domains/plan/utils/cacheInvalidation", () => ({
  revalidatePlanCache: vi.fn(),
}));

import { createQuickPlan, createQuickPlanForStudent } from "@/lib/domains/plan/actions/contentPlanGroup/quickCreate";
import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateDefaultPlannerAction } from "@/lib/domains/plan/actions/planners/autoCreate";
import { selectPlanGroupForPlanner, createPlanGroupForPlanner } from "@/lib/domains/admin-plan/utils/planGroupSelector";
import type { AdminAuthContext, StudentAuthContext } from "@/lib/auth/strategies/types";

describe("createQuickPlanForStudent", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as any);
  });

  describe("인증", () => {
    it("Admin 컨텍스트가 아니면 에러 반환", async () => {
      const studentContext: StudentAuthContext = {
        mode: "student",
        userId: "student-123",
        studentId: "student-123",
        tenantId: "tenant-456",
        actingOnBehalfOf: false,
      };

      vi.mocked(resolveAuthContext).mockResolvedValue(studentContext);
      vi.mocked(isAdminContext).mockReturnValue(false);

      const result = await createQuickPlanForStudent({
        studentId: "student-789",
        title: "테스트 플랜",
        planDate: "2024-01-15",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("관리자 권한이 필요합니다.");
    });

    it("tenantId가 없으면 에러 반환", async () => {
      const adminContext: AdminAuthContext = {
        mode: "admin",
        userId: "admin-123",
        studentId: "student-789",
        tenantId: "",
        actingOnBehalfOf: true,
        adminRole: "admin",
      };

      vi.mocked(resolveAuthContext).mockResolvedValue(adminContext);
      vi.mocked(isAdminContext).mockReturnValue(true);

      const result = await createQuickPlanForStudent({
        studentId: "student-789",
        title: "테스트 플랜",
        planDate: "2024-01-15",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("테넌트 정보가 필요합니다.");
    });
  });

  describe("자유 학습 생성", () => {
    const adminContext: AdminAuthContext = {
      mode: "admin",
      userId: "admin-123",
      studentId: "student-789",
      tenantId: "tenant-456",
      actingOnBehalfOf: true,
      adminRole: "admin",
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(adminContext);
      vi.mocked(isAdminContext).mockReturnValue(true);
    });

    it("자유 학습 플랜 생성 성공", async () => {
      // flexible_contents 생성 성공
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "flex-content-123" },
          error: null,
        })
        // plan_groups 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-group-456" },
          error: null,
        })
        // student_plan 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-789" },
          error: null,
        });

      const result = await createQuickPlanForStudent({
        studentId: "student-789",
        title: "수학 복습",
        planDate: "2024-01-15",
        isFreeLearning: true,
        freeLearningType: "review",
        estimatedMinutes: 60,
      });

      expect(result.success).toBe(true);
      expect(result.planGroupId).toBe("plan-group-456");
      expect(result.planId).toBe("plan-789");
      expect(result.flexibleContentId).toBe("flex-content-123");
      expect(result.studentId).toBe("student-789");
    });

    it("flexible_contents 생성 실패 시 에러 반환", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: "DB 에러" },
      });

      const result = await createQuickPlanForStudent({
        studentId: "student-789",
        title: "테스트",
        planDate: "2024-01-15",
        isFreeLearning: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB 에러");
    });
  });

  describe("기존 콘텐츠 사용", () => {
    const adminContext: AdminAuthContext = {
      mode: "admin",
      userId: "admin-123",
      studentId: "student-789",
      tenantId: "tenant-456",
      actingOnBehalfOf: true,
      adminRole: "admin",
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(adminContext);
      vi.mocked(isAdminContext).mockReturnValue(true);
    });

    it("유효하지 않은 UUID 형식의 contentId는 에러", async () => {
      const result = await createQuickPlanForStudent({
        studentId: "student-789",
        title: "테스트",
        planDate: "2024-01-15",
        contentId: "invalid-id",
        isFreeLearning: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("유효하지 않은 콘텐츠 ID입니다.");
    });

    it("유효한 UUID의 contentId는 처리", async () => {
      const validUUID = "550e8400-e29b-41d4-a716-446655440000";

      // plan_groups 생성 성공
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "plan-group-456" },
          error: null,
        })
        // student_plan 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-789" },
          error: null,
        });

      const result = await createQuickPlanForStudent({
        studentId: "student-789",
        title: "교재 학습",
        planDate: "2024-01-15",
        contentId: validUUID,
        contentType: "book",
        isFreeLearning: false,
      });

      expect(result.success).toBe(true);
      expect(result.flexibleContentId).toBeUndefined();
    });
  });

  describe("plan_groups 생성", () => {
    const adminContext: AdminAuthContext = {
      mode: "admin",
      userId: "admin-123",
      studentId: "student-789",
      tenantId: "tenant-456",
      actingOnBehalfOf: true,
      adminRole: "admin",
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(adminContext);
      vi.mocked(isAdminContext).mockReturnValue(true);
    });

    it("plan_groups에 last_admin_id 필드가 설정됨", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "flex-content-123" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "plan-group-456" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "plan-789" },
          error: null,
        });

      await createQuickPlanForStudent({
        studentId: "student-789",
        title: "테스트",
        planDate: "2024-01-15",
        isFreeLearning: true,
      });

      // insert 호출 확인 - plan_groups insert를 찾음
      const insertCalls = mockSupabase.insert.mock.calls;
      // plan_groups insert에 last_admin_id가 포함되어 있는지 확인
      const planGroupInsert = insertCalls.find(
        (call) => call[0]?.last_admin_id !== undefined
      )?.[0];

      expect(planGroupInsert).toBeDefined();
      if (planGroupInsert) {
        expect(planGroupInsert.last_admin_id).toBe("admin-123");
        expect(planGroupInsert.student_id).toBe("student-789");
      }
    });
  });

  describe("롤백", () => {
    const adminContext: AdminAuthContext = {
      mode: "admin",
      userId: "admin-123",
      studentId: "student-789",
      tenantId: "tenant-456",
      actingOnBehalfOf: true,
      adminRole: "admin",
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(adminContext);
      vi.mocked(isAdminContext).mockReturnValue(true);
    });

    it("student_plan 생성 실패 시 rollback 수행", async () => {
      mockSupabase.single
        // flexible_contents 성공
        .mockResolvedValueOnce({
          data: { id: "flex-content-123" },
          error: null,
        })
        // plan_groups 성공
        .mockResolvedValueOnce({
          data: { id: "plan-group-456" },
          error: null,
        })
        // student_plan 실패
        .mockResolvedValueOnce({
          data: null,
          error: { message: "플랜 생성 실패" },
        });

      // delete 성공 (rollback)
      mockSupabase.eq.mockReturnValue({
        ...mockSupabase,
        then: (resolve: any) => resolve({ error: null }),
      });

      const result = await createQuickPlanForStudent({
        studentId: "student-789",
        title: "테스트",
        planDate: "2024-01-15",
        isFreeLearning: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("플랜 생성 실패");
    });
  });
});

/**
 * createQuickPlan 통합 테스트 (Phase 3.1)
 *
 * 학생/관리자 모두 사용 가능한 통합 API
 * - Planner 자동 연동
 * - is_single_content: true 적용
 * - is_adhoc: true 마킹
 */
describe("createQuickPlan (통합 API)", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as any);
  });

  describe("학생이 직접 호출", () => {
    const studentContext: StudentAuthContext = {
      mode: "student",
      userId: "student-123",
      studentId: "student-123",
      tenantId: "tenant-456",
      actingOnBehalfOf: false,
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(studentContext);
      vi.mocked(isAdminContext).mockReturnValue(false);
    });

    it("학생이 빠른 플랜 생성 성공 (Planner 자동 연동)", async () => {
      // flexible_contents 생성 성공 (isFreeLearning일 때)
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "flex-content-123" },
          error: null,
        })
        // student_plan 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-new-789" },
          error: null,
        });

      // Planner 자동 생성
      vi.mocked(getOrCreateDefaultPlannerAction).mockResolvedValue({
        plannerId: "planner-auto-123",
        isNew: true,
        plannerName: "기본 플래너",
      });

      // 기존 Plan Group 없음 → 새로 생성
      vi.mocked(selectPlanGroupForPlanner).mockResolvedValue({
        status: "not-found",
      });

      vi.mocked(createPlanGroupForPlanner).mockResolvedValue({
        success: true,
        planGroupId: "plan-group-new-456",
      });

      const result = await createQuickPlan({
        title: "수학 복습",
        planDate: "2024-01-15",
        estimatedMinutes: 30,
        isFreeLearning: true,
      });

      expect(result.success).toBe(true);
      expect(result.planGroupId).toBe("plan-group-new-456");
      expect(result.planId).toBe("plan-new-789");

      // Planner 자동 생성 호출 확인
      expect(getOrCreateDefaultPlannerAction).toHaveBeenCalledWith({
        studentId: "student-123",
      });

      // Plan Group 생성 시 is_single_content: true 옵션 확인
      expect(createPlanGroupForPlanner).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            isSingleContent: true,
            planMode: "quick",
          }),
        })
      );
    });

    it("학생이 기존 Plan Group에 플랜 추가", async () => {
      // flexible_contents 생성 (기본적으로 isFreeLearning: true로 처리됨)
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "flex-content-456" },
          error: null,
        })
        // student_plan 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-new-789" },
          error: null,
        });

      vi.mocked(getOrCreateDefaultPlannerAction).mockResolvedValue({
        plannerId: "planner-existing-123",
        isNew: false,
        plannerName: "기존 플래너",
      });

      // 기존 Plan Group 있음
      vi.mocked(selectPlanGroupForPlanner).mockResolvedValue({
        status: "found",
        planGroupId: "plan-group-existing-456",
      });

      const result = await createQuickPlan({
        title: "영어 단어 암기",
        planDate: "2024-01-15",
        estimatedMinutes: 20,
      });

      expect(result.success).toBe(true);
      expect(result.planGroupId).toBe("plan-group-existing-456");

      // createPlanGroupForPlanner는 호출되지 않아야 함
      expect(createPlanGroupForPlanner).not.toHaveBeenCalled();
    });
  });

  describe("관리자가 학생 대신 호출", () => {
    const adminContext: AdminAuthContext = {
      mode: "admin",
      userId: "admin-123",
      studentId: "student-789",
      tenantId: "tenant-456",
      actingOnBehalfOf: true,
      adminRole: "admin",
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(adminContext);
      vi.mocked(isAdminContext).mockReturnValue(true);
    });

    it("관리자가 studentId 지정하여 플랜 생성", async () => {
      // flexible_contents 생성 (기본적으로 isFreeLearning: true로 처리됨)
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "flex-content-admin" },
          error: null,
        })
        // student_plan 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-admin-created" },
          error: null,
        });

      vi.mocked(getOrCreateDefaultPlannerAction).mockResolvedValue({
        plannerId: "planner-for-student-789",
        isNew: false,
        plannerName: "학생용 플래너",
      });

      vi.mocked(selectPlanGroupForPlanner).mockResolvedValue({
        status: "not-found",
      });

      vi.mocked(createPlanGroupForPlanner).mockResolvedValue({
        success: true,
        planGroupId: "plan-group-admin-created",
      });

      const result = await createQuickPlan({
        title: "관리자가 생성한 플랜",
        planDate: "2024-01-15",
        studentId: "student-789", // 대상 학생 지정
        estimatedMinutes: 45,
      });

      expect(result.success).toBe(true);
      expect(result.planGroupId).toBe("plan-group-admin-created");

      // resolveAuthContext가 studentId와 함께 호출됨
      expect(resolveAuthContext).toHaveBeenCalledWith({
        studentId: "student-789",
      });
    });
  });

  describe("is_adhoc 마킹", () => {
    const studentContext: StudentAuthContext = {
      mode: "student",
      userId: "student-123",
      studentId: "student-123",
      tenantId: "tenant-456",
      actingOnBehalfOf: false,
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(studentContext);
      vi.mocked(isAdminContext).mockReturnValue(false);
      vi.mocked(getOrCreateDefaultPlannerAction).mockResolvedValue({
        plannerId: "planner-123",
        isNew: false,
        plannerName: "기본 플래너",
      });
      vi.mocked(selectPlanGroupForPlanner).mockResolvedValue({
        status: "found",
        planGroupId: "plan-group-456",
      });
    });

    it("student_plan에 is_adhoc: true가 설정됨", async () => {
      // flexible_contents 생성 (contentId 없으면 free learning으로 처리)
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "flex-content-adhoc" },
          error: null,
        })
        // student_plan 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-789" },
          error: null,
        });

      await createQuickPlan({
        title: "빠른 학습",
        planDate: "2024-01-15",
      });

      // insert 호출 확인
      const insertCalls = mockSupabase.insert.mock.calls;
      const studentPlanInsert = insertCalls.find(
        (call) => call[0]?.is_adhoc !== undefined
      )?.[0];

      expect(studentPlanInsert).toBeDefined();
      expect(studentPlanInsert?.is_adhoc).toBe(true);
    });

    it("추가 필드들이 student_plan에 포함됨", async () => {
      // flexible_contents 생성
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "flex-content-detailed" },
          error: null,
        })
        // student_plan 생성 성공
        .mockResolvedValueOnce({
          data: { id: "plan-789" },
          error: null,
        });

      await createQuickPlan({
        title: "상세 플랜",
        planDate: "2024-01-15",
        estimatedMinutes: 60,
        startTime: "14:00",
        endTime: "15:00",
        description: "테스트 설명",
        tags: ["수학", "복습"],
        color: "#FF5733",
        priority: 1,
      });

      const insertCalls = mockSupabase.insert.mock.calls;
      const studentPlanInsert = insertCalls.find(
        (call) => call[0]?.is_adhoc !== undefined
      )?.[0];

      expect(studentPlanInsert).toMatchObject({
        estimated_minutes: 60,
        start_time: "14:00",
        end_time: "15:00",
        description: "테스트 설명",
        tags: ["수학", "복습"],
        color: "#FF5733",
        priority: 1,
      });
    });
  });

  describe("에러 처리", () => {
    const studentContext: StudentAuthContext = {
      mode: "student",
      userId: "student-123",
      studentId: "student-123",
      tenantId: "tenant-456",
      actingOnBehalfOf: false,
    };

    beforeEach(() => {
      vi.mocked(resolveAuthContext).mockResolvedValue(studentContext);
      vi.mocked(isAdminContext).mockReturnValue(false);
    });

    it("Planner 생성 실패 시 에러 반환", async () => {
      // flexible_contents 생성 성공
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "flex-content-test" },
        error: null,
      });

      vi.mocked(getOrCreateDefaultPlannerAction).mockResolvedValue({
        plannerId: undefined as any,
        isNew: false,
        plannerName: "",
      });

      const result = await createQuickPlan({
        title: "테스트",
        planDate: "2024-01-15",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("기본 플래너 생성에 실패했습니다.");
    });

    it("Plan Group 생성 실패 시 에러 반환", async () => {
      // flexible_contents 생성 성공
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "flex-content-test2" },
        error: null,
      });

      vi.mocked(getOrCreateDefaultPlannerAction).mockResolvedValue({
        plannerId: "planner-123",
        isNew: false,
        plannerName: "기본 플래너",
      });

      vi.mocked(selectPlanGroupForPlanner).mockResolvedValue({
        status: "not-found",
      });

      vi.mocked(createPlanGroupForPlanner).mockResolvedValue({
        success: false,
        error: "Plan Group 생성 실패",
      });

      const result = await createQuickPlan({
        title: "테스트",
        planDate: "2024-01-15",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Plan Group 생성 실패");
    });
  });
});
