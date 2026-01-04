/**
 * Student Auth Strategy 테스트
 *
 * 학생 인증 전략의 canHandle 및 authenticate 메서드 테스트
 *
 * @module __tests__/lib/auth/strategies/studentAuthStrategy.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudentAuthStrategy } from "@/lib/auth/strategies/studentAuthStrategy";

// Mock dependencies
vi.mock("@/lib/auth/requireStudentAuth", () => ({
  requireStudentAuth: vi.fn(),
}));

import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";

describe("StudentAuthStrategy", () => {
  let strategy: StudentAuthStrategy;

  beforeEach(() => {
    strategy = new StudentAuthStrategy();
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("studentId가 없으면 true 반환 (자기 자신 접근)", () => {
      expect(strategy.canHandle("student", undefined)).toBe(true);
      expect(strategy.canHandle("student", {})).toBe(true);
    });

    it("학생 역할이고 studentId가 있어도 true 반환", () => {
      expect(strategy.canHandle("student", { studentId: "student-123" })).toBe(true);
    });

    it("admin 역할이고 studentId가 없으면 true 반환 (폴백)", () => {
      expect(strategy.canHandle("admin", undefined)).toBe(true);
      expect(strategy.canHandle("admin", {})).toBe(true);
    });

    it("admin 역할이고 studentId가 있으면 false 반환 (AdminStrategy가 처리)", () => {
      expect(strategy.canHandle("admin", { studentId: "student-123" })).toBe(false);
    });

    it("consultant 역할이고 studentId가 있으면 false 반환", () => {
      expect(strategy.canHandle("consultant", { studentId: "student-123" })).toBe(false);
    });

    it("parent 역할이고 studentId가 있으면 false 반환 (ParentStrategy가 처리)", () => {
      expect(strategy.canHandle("parent", { studentId: "student-123" })).toBe(false);
    });

    it("null 역할이고 studentId가 없으면 true 반환", () => {
      expect(strategy.canHandle(null, undefined)).toBe(true);
    });
  });

  describe("authenticate", () => {
    it("학생 인증 성공 시 StudentAuthContext 반환", async () => {
      vi.mocked(requireStudentAuth).mockResolvedValue({
        userId: "user-123",
        tenantId: "tenant-456",
      });

      const result = await strategy.authenticate();

      expect(result).toEqual({
        mode: "student",
        userId: "user-123",
        studentId: "user-123", // userId === studentId
        tenantId: "tenant-456",
        actingOnBehalfOf: false,
      });
    });

    it("tenantId가 없어도 빈 문자열로 처리", async () => {
      vi.mocked(requireStudentAuth).mockResolvedValue({
        userId: "user-123",
        tenantId: null,
      });

      const result = await strategy.authenticate();

      expect(result.tenantId).toBe("");
    });

    it("requireTenant 옵션이 있고 tenantId가 없으면 에러", async () => {
      vi.mocked(requireStudentAuth).mockResolvedValue({
        userId: "user-123",
        tenantId: null,
      });

      await expect(
        strategy.authenticate({ requireTenant: true })
      ).rejects.toThrow("테넌트 정보가 필요합니다.");
    });

    it("requireStudentAuth 실패 시 에러 전파", async () => {
      vi.mocked(requireStudentAuth).mockRejectedValue(new Error("인증 실패"));

      await expect(strategy.authenticate()).rejects.toThrow("학생 인증에 실패했습니다.");
    });
  });

  describe("mode", () => {
    it("mode가 'student'", () => {
      expect(strategy.mode).toBe("student");
    });
  });
});
