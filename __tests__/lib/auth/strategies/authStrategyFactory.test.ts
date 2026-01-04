/**
 * Auth Strategy Factory 테스트
 *
 * resolveAuthContext 및 관련 유틸리티 함수 테스트
 *
 * @module __tests__/lib/auth/strategies/authStrategyFactory.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveAuthContext,
  canUseAuthMode,
  getRegisteredStrategies,
} from "@/lib/auth/strategies/authStrategyFactory";
import { isAdminContext, isStudentContext } from "@/lib/auth/strategies";

// Mock dependencies
vi.mock("@/lib/auth/getCurrentUserRole", () => ({
  getCurrentUserRole: vi.fn(),
}));

vi.mock("@/lib/auth/requireStudentAuth", () => ({
  requireStudentAuth: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
  requireParent: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

describe("authStrategyFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveAuthContext", () => {
    describe("Student 모드 선택", () => {
      it("student 역할이고 studentId가 없으면 StudentStrategy 사용", async () => {
        vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "student" });
        vi.mocked(requireStudentAuth).mockResolvedValue({
          userId: "student-123",
          tenantId: "tenant-456",
        });

        const result = await resolveAuthContext();

        expect(result.mode).toBe("student");
        expect(result.studentId).toBe("student-123");
        expect(result.actingOnBehalfOf).toBe(false);
      });

      it("admin 역할이지만 studentId가 없으면 StudentStrategy 사용 (폴백)", async () => {
        vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "admin" });
        vi.mocked(requireStudentAuth).mockResolvedValue({
          userId: "admin-123",
          tenantId: "tenant-456",
        });

        const result = await resolveAuthContext();

        expect(result.mode).toBe("student");
      });
    });

    describe("Admin 모드 선택", () => {
      it("admin 역할이고 studentId가 있으면 AdminStrategy 사용", async () => {
        vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "admin" });
        vi.mocked(requireAdminOrConsultant).mockResolvedValue({
          userId: "admin-123",
          tenantId: "tenant-456",
        });
        vi.mocked(getCurrentUser).mockResolvedValue({
          userId: "admin-123",
          role: "admin",
          tenantId: "tenant-456",
        } as any);

        const result = await resolveAuthContext({ studentId: "student-789" });

        expect(result.mode).toBe("admin");
        expect(result.studentId).toBe("student-789");
        expect(result.actingOnBehalfOf).toBe(true);
        expect(isAdminContext(result)).toBe(true);
      });

      it("consultant 역할이고 studentId가 있으면 AdminStrategy 사용", async () => {
        vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "consultant" });
        vi.mocked(requireAdminOrConsultant).mockResolvedValue({
          userId: "consultant-123",
          tenantId: "tenant-456",
        });
        vi.mocked(getCurrentUser).mockResolvedValue({
          userId: "consultant-123",
          role: "consultant",
          tenantId: "tenant-456",
        } as any);

        const result = await resolveAuthContext({ studentId: "student-789" });

        expect(result.mode).toBe("admin");
        if (isAdminContext(result)) {
          expect(result.adminRole).toBe("consultant");
        }
      });
    });

    describe("전략 우선순위", () => {
      it("admin > parent > student 순서로 체크", async () => {
        // admin이 studentId와 함께 호출되면 AdminStrategy 선택
        vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "admin" });
        vi.mocked(requireAdminOrConsultant).mockResolvedValue({
          userId: "admin-123",
          tenantId: "tenant-456",
        });
        vi.mocked(getCurrentUser).mockResolvedValue({
          userId: "admin-123",
          role: "admin",
          tenantId: "tenant-456",
        } as any);

        const result = await resolveAuthContext({ studentId: "student-789" });
        expect(result.mode).toBe("admin");
      });
    });
  });

  describe("canUseAuthMode", () => {
    it("admin 역할이 admin 모드 사용 가능 (studentId 필요)", async () => {
      vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "admin" });

      const canUse = await canUseAuthMode("admin", { studentId: "student-123" });
      expect(canUse).toBe(true);
    });

    it("admin 역할이지만 studentId 없으면 admin 모드 불가", async () => {
      vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "admin" });

      const canUse = await canUseAuthMode("admin", {});
      expect(canUse).toBe(false);
    });

    it("student 역할은 student 모드 사용 가능", async () => {
      vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "student" });

      const canUse = await canUseAuthMode("student", {});
      expect(canUse).toBe(true);
    });

    it("student 역할은 admin 모드 사용 불가", async () => {
      vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "student" });

      const canUse = await canUseAuthMode("admin", { studentId: "student-123" });
      expect(canUse).toBe(false);
    });
  });

  describe("getRegisteredStrategies", () => {
    it("등록된 전략 모드 목록 반환", () => {
      const strategies = getRegisteredStrategies();

      expect(strategies).toContain("admin");
      expect(strategies).toContain("parent");
      expect(strategies).toContain("student");
    });
  });

  describe("Type Guards", () => {
    it("isAdminContext - admin 모드 확인", async () => {
      vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "admin" });
      vi.mocked(requireAdminOrConsultant).mockResolvedValue({
        userId: "admin-123",
        tenantId: "tenant-456",
      });
      vi.mocked(getCurrentUser).mockResolvedValue({
        userId: "admin-123",
        role: "admin",
        tenantId: "tenant-456",
      } as any);

      const result = await resolveAuthContext({ studentId: "student-789" });

      expect(isAdminContext(result)).toBe(true);
      expect(isStudentContext(result)).toBe(false);
    });

    it("isStudentContext - student 모드 확인", async () => {
      vi.mocked(getCurrentUserRole).mockResolvedValue({ role: "student" });
      vi.mocked(requireStudentAuth).mockResolvedValue({
        userId: "student-123",
        tenantId: "tenant-456",
      });

      const result = await resolveAuthContext();

      expect(isStudentContext(result)).toBe(true);
      expect(isAdminContext(result)).toBe(false);
    });
  });
});
