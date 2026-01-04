/**
 * Admin Auth Strategy 테스트
 *
 * 관리자/컨설턴트 인증 전략의 canHandle 및 authenticate 메서드 테스트
 *
 * @module __tests__/lib/auth/strategies/adminAuthStrategy.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminAuthStrategy } from "@/lib/auth/strategies/adminAuthStrategy";

// Mock dependencies
vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

describe("AdminAuthStrategy", () => {
  let strategy: AdminAuthStrategy;

  beforeEach(() => {
    strategy = new AdminAuthStrategy();
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("admin 역할이고 studentId가 있으면 true", () => {
      expect(strategy.canHandle("admin", { studentId: "student-123" })).toBe(true);
    });

    it("consultant 역할이고 studentId가 있으면 true", () => {
      expect(strategy.canHandle("consultant", { studentId: "student-123" })).toBe(true);
    });

    it("admin 역할이지만 studentId가 없으면 false", () => {
      expect(strategy.canHandle("admin", undefined)).toBe(false);
      expect(strategy.canHandle("admin", {})).toBe(false);
    });

    it("consultant 역할이지만 studentId가 없으면 false", () => {
      expect(strategy.canHandle("consultant", undefined)).toBe(false);
    });

    it("student 역할이면 studentId가 있어도 false", () => {
      expect(strategy.canHandle("student", { studentId: "student-123" })).toBe(false);
    });

    it("parent 역할이면 studentId가 있어도 false", () => {
      expect(strategy.canHandle("parent", { studentId: "student-123" })).toBe(false);
    });

    it("null 역할이면 false", () => {
      expect(strategy.canHandle(null, { studentId: "student-123" })).toBe(false);
    });
  });

  describe("authenticate", () => {
    it("admin 역할로 인증 성공", async () => {
      vi.mocked(requireAdminOrConsultant).mockResolvedValue({
        userId: "admin-123",
        tenantId: "tenant-456",
      });
      vi.mocked(getCurrentUser).mockResolvedValue({
        userId: "admin-123",
        role: "admin",
        tenantId: "tenant-456",
      } as any);

      const result = await strategy.authenticate({ studentId: "student-789" });

      expect(result).toEqual({
        mode: "admin",
        userId: "admin-123",
        studentId: "student-789",
        tenantId: "tenant-456",
        actingOnBehalfOf: true,
        adminRole: "admin",
      });
    });

    it("consultant 역할로 인증 성공", async () => {
      vi.mocked(requireAdminOrConsultant).mockResolvedValue({
        userId: "consultant-123",
        tenantId: "tenant-456",
      });
      vi.mocked(getCurrentUser).mockResolvedValue({
        userId: "consultant-123",
        role: "consultant",
        tenantId: "tenant-456",
      } as any);

      const result = await strategy.authenticate({ studentId: "student-789" });

      expect(result).toEqual({
        mode: "admin",
        userId: "consultant-123",
        studentId: "student-789",
        tenantId: "tenant-456",
        actingOnBehalfOf: true,
        adminRole: "consultant",
      });
    });

    it("studentId가 없으면 에러", async () => {
      await expect(strategy.authenticate()).rejects.toThrow(
        "관리자 모드에서는 대상 학생 ID가 필요합니다."
      );
    });

    it("tenantId는 result에서 우선, 없으면 options에서 사용", async () => {
      vi.mocked(requireAdminOrConsultant).mockResolvedValue({
        userId: "admin-123",
        tenantId: null,
      });
      vi.mocked(getCurrentUser).mockResolvedValue({
        userId: "admin-123",
        role: "admin",
        tenantId: null,
      } as any);

      const result = await strategy.authenticate({
        studentId: "student-789",
        tenantId: "fallback-tenant",
      });

      expect(result.tenantId).toBe("fallback-tenant");
    });

    it("requireAdminOrConsultant 실패 시 에러 전파", async () => {
      vi.mocked(requireAdminOrConsultant).mockRejectedValue(new Error("권한 없음"));

      await expect(
        strategy.authenticate({ studentId: "student-123" })
      ).rejects.toThrow("관리자 인증에 실패했습니다.");
    });
  });

  describe("mode", () => {
    it("mode가 'admin'", () => {
      expect(strategy.mode).toBe("admin");
    });
  });
});
