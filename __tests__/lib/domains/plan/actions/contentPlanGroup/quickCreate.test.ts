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

vi.mock("@/lib/domains/calendar/helpers", () => ({
  ensureStudentPrimaryCalendar: vi.fn(),
}));

vi.mock("@/lib/domains/admin-plan/utils/planGroupSelector", () => ({
  selectPlanGroupForCalendar: vi.fn(),
  createPlanGroupForCalendar: vi.fn(),
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

vi.mock("@/lib/domains/plan/transactions", () => ({
  createQuickPlanAtomic: vi.fn(),
}));

import { createQuickPlan, createQuickPlanForStudent } from "@/lib/domains/plan/actions/contentPlanGroup/quickCreate";
import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureStudentPrimaryCalendar } from "@/lib/domains/calendar/helpers";
import { selectPlanGroupForCalendar, createPlanGroupForCalendar } from "@/lib/domains/admin-plan/utils/planGroupSelector";
import { createQuickPlanAtomic } from "@/lib/domains/plan/transactions";
import type { AdminAuthContext, StudentAuthContext } from "@/lib/auth/strategies/types";

const mockCreateQuickPlanAtomic = vi.mocked(createQuickPlanAtomic);

/** RPC 트랜잭션 happy path 기본 응답 */
function setRpcSuccess(overrides?: Partial<{ plan_group_id: string; plan_id: string; flexible_content_id: string }>) {
  mockCreateQuickPlanAtomic.mockResolvedValue({
    success: true,
    plan_group_id: overrides?.plan_group_id ?? "plan-group-456",
    plan_id: overrides?.plan_id ?? "plan-789",
    flexible_content_id: overrides?.flexible_content_id ?? "flex-content-123",
  });
}

/** RPC 트랜잭션 실패 응답 */
function setRpcFailure(error: string) {
  mockCreateQuickPlanAtomic.mockResolvedValue({
    success: false,
    error,
  });
}

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
      setRpcSuccess({
        plan_group_id: "plan-group-456",
        plan_id: "plan-789",
        flexible_content_id: "flex-content-123",
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
      setRpcFailure("DB 에러");

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

      mockCreateQuickPlanAtomic.mockResolvedValue({
        success: true,
        plan_group_id: "plan-group-456",
        plan_id: "plan-789",
        // 일반 콘텐츠는 flexible_content_id 없음
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

    it("legacy 그룹 생성 시 RPC options.planGroup에 last_admin_id 포함", async () => {
      // calendarId 없는 호출 = legacy path → RPC가 planGroup 생성
      setRpcSuccess();

      await createQuickPlanForStudent({
        studentId: "student-789",
        title: "테스트",
        planDate: "2024-01-15",
        isFreeLearning: true,
        // calendarId 미지정 → needsLegacyGroup = true
      });

      // RPC 호출 args 검증: options.planGroup에 last_admin_id가 admin-123
      expect(mockCreateQuickPlanAtomic).toHaveBeenCalled();
      const [, options] = mockCreateQuickPlanAtomic.mock.calls[0];
      expect(options.planGroup).toBeDefined();
      expect(options.planGroup?.last_admin_id).toBe("admin-123");
      expect(options.planGroup?.student_id).toBe("student-789");
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

    it("RPC 트랜잭션 실패 시 에러 반환 (롤백은 RPC 내부에서 자동)", async () => {
      // RPC 트랜잭션이 단일 PostgreSQL 트랜잭션이므로
      // 부분 실패 시 PostgreSQL이 자동 롤백. 외부에서는 success: false만 확인.
      setRpcFailure("플랜 생성 실패");

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

    it("학생이 빠른 플랜 생성 성공 (Calendar 자동 연동)", async () => {
      mockCreateQuickPlanAtomic.mockResolvedValue({
        success: true,
        plan_group_id: "plan-group-new-456",
        plan_id: "plan-new-789",
        flexible_content_id: "flex-content-123",
      });

      vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValue("calendar-auto-123");

      vi.mocked(selectPlanGroupForCalendar).mockResolvedValue({
        status: "not-found",
      });

      vi.mocked(createPlanGroupForCalendar).mockResolvedValue({
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

      expect(ensureStudentPrimaryCalendar).toHaveBeenCalledWith(
        "student-123",
        "tenant-456"
      );

      expect(createPlanGroupForCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            isSingleContent: true,
            planMode: "quick",
          }),
        })
      );
    });

    it("학생이 기존 Plan Group에 플랜 추가", async () => {
      mockCreateQuickPlanAtomic.mockResolvedValue({
        success: true,
        plan_group_id: "plan-group-existing-456",
        plan_id: "plan-new-789",
        flexible_content_id: "flex-content-456",
      });

      vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValue("calendar-existing-123");

      vi.mocked(selectPlanGroupForCalendar).mockResolvedValue({
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

      expect(createPlanGroupForCalendar).not.toHaveBeenCalled();
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
      mockCreateQuickPlanAtomic.mockResolvedValue({
        success: true,
        plan_group_id: "plan-group-admin-created",
        plan_id: "plan-admin-created",
        flexible_content_id: "flex-content-admin",
      });

      vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValue("calendar-for-student-789");

      vi.mocked(selectPlanGroupForCalendar).mockResolvedValue({
        status: "not-found",
      });

      vi.mocked(createPlanGroupForCalendar).mockResolvedValue({
        success: true,
        planGroupId: "plan-group-admin-created",
      });

      const result = await createQuickPlan({
        title: "관리자가 생성한 플랜",
        planDate: "2024-01-15",
        studentId: "student-789",
        estimatedMinutes: 45,
      });

      expect(result.success).toBe(true);
      expect(result.planGroupId).toBe("plan-group-admin-created");

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
      vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValue("calendar-123");
      vi.mocked(selectPlanGroupForCalendar).mockResolvedValue({
        status: "found",
        planGroupId: "plan-group-456",
      });
    });

    it("student_plan에 is_adhoc: true가 설정됨", async () => {
      setRpcSuccess({ flexible_content_id: "flex-content-adhoc" });

      await createQuickPlan({
        title: "빠른 학습",
        planDate: "2024-01-15",
      });

      // RPC 호출 args 검증: 첫 번째 인자(studentPlan)에 is_adhoc: true
      expect(mockCreateQuickPlanAtomic).toHaveBeenCalled();
      const [studentPlan] = mockCreateQuickPlanAtomic.mock.calls[0];
      expect(studentPlan.is_adhoc).toBe(true);
    });

    it("추가 필드들이 student_plan에 포함됨", async () => {
      setRpcSuccess({ flexible_content_id: "flex-content-detailed" });

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

      const [studentPlan] = mockCreateQuickPlanAtomic.mock.calls[0];
      expect(studentPlan).toMatchObject({
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

    it("Calendar 확보 실패 시 에러 반환", async () => {
      // flexible_contents 생성 성공
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "flex-content-test" },
        error: null,
      });

      vi.mocked(ensureStudentPrimaryCalendar).mockRejectedValue(
        new Error("캘린더 확보 실패")
      );

      const result = await createQuickPlan({
        title: "테스트",
        planDate: "2024-01-15",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("기본 캘린더 생성에 실패했습니다.");
    });

    it("Plan Group 생성 실패 시 에러 반환", async () => {
      // flexible_contents 생성 성공
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "flex-content-test2" },
        error: null,
      });

      vi.mocked(ensureStudentPrimaryCalendar).mockResolvedValue("calendar-123");

      vi.mocked(selectPlanGroupForCalendar).mockResolvedValue({
        status: "not-found",
      });

      vi.mocked(createPlanGroupForCalendar).mockResolvedValue({
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
