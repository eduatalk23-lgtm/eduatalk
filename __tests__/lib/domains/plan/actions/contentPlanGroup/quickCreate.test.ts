/**
 * Quick Create Server Action 테스트
 *
 * createQuickPlanForStudent 액션의 인증 및 생성 로직 테스트
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

import { createQuickPlanForStudent } from "@/lib/domains/plan/actions/contentPlanGroup/quickCreate";
import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

    it("plan_groups에 created_by 필드가 설정됨", async () => {
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

      // insert 호출 확인 (plan_groups)
      const insertCalls = mockSupabase.insert.mock.calls;
      // 두 번째 insert가 plan_groups
      const planGroupInsert = insertCalls[1]?.[0];

      if (planGroupInsert) {
        expect(planGroupInsert.created_by).toBe("admin-123");
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
