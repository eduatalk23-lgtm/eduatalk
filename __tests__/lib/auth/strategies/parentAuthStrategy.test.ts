/**
 * Parent Auth Strategy 테스트
 *
 * 학부모 인증 전략의 canHandle 및 authenticate 메서드 테스트
 *
 * @module __tests__/lib/auth/strategies/parentAuthStrategy.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ParentAuthStrategy } from "@/lib/auth/strategies/parentAuthStrategy";
import { AppError, ErrorCode } from "@/lib/errors";

// Mock dependencies
vi.mock("@/lib/auth/guards", () => ({
  requireParent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { requireParent } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("ParentAuthStrategy", () => {
  let strategy: ParentAuthStrategy;

  beforeEach(() => {
    strategy = new ParentAuthStrategy();
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("parent 역할이고 studentId가 있으면 true", () => {
      expect(strategy.canHandle("parent", { studentId: "student-123" })).toBe(true);
    });

    it("parent 역할이지만 studentId가 없으면 false", () => {
      expect(strategy.canHandle("parent", undefined)).toBe(false);
      expect(strategy.canHandle("parent", {})).toBe(false);
    });

    it("student 역할이면 studentId가 있어도 false", () => {
      expect(strategy.canHandle("student", { studentId: "student-123" })).toBe(false);
    });

    it("admin 역할이면 studentId가 있어도 false", () => {
      expect(strategy.canHandle("admin", { studentId: "student-123" })).toBe(false);
    });

    it("consultant 역할이면 studentId가 있어도 false", () => {
      expect(strategy.canHandle("consultant", { studentId: "student-123" })).toBe(false);
    });

    it("null 역할이면 false", () => {
      expect(strategy.canHandle(null, { studentId: "student-123" })).toBe(false);
    });
  });

  describe("authenticate", () => {
    let mockQueryResult: { data: any; error: any };

    const createMockChain = () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          // 두 번째 eq() 호출 시 Promise 반환
          return Promise.resolve(mockQueryResult);
        }),
      };
      // 첫 번째 eq()는 체인 반환
      chain.select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult)),
        }),
      });
      return chain;
    };

    beforeEach(() => {
      mockQueryResult = { data: [], error: null };

      const mockChain = createMockChain();
      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        from: vi.fn().mockReturnValue(mockChain),
      } as any);
    });

    const setupMockWithChildren = (children: { student_id: string }[]) => {
      mockQueryResult = { data: children, error: null };
      const chain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: children, error: null }),
          }),
        }),
      };
      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        from: vi.fn().mockReturnValue(chain),
      } as any);
    };

    const setupMockWithError = (error: any) => {
      mockQueryResult = { data: null, error };
      const chain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error }),
          }),
        }),
      };
      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        from: vi.fn().mockReturnValue(chain),
      } as any);
    };

    it("연결된 자녀에 대해 인증 성공", async () => {
      vi.mocked(requireParent).mockResolvedValue({
        userId: "parent-123",
        role: "parent",
      });

      // Mock: 자녀 연결 데이터
      setupMockWithChildren([
        { student_id: "child-1" },
        { student_id: "child-2" },
      ]);

      const result = await strategy.authenticate({
        studentId: "child-1",
        tenantId: "tenant-456",
      });

      expect(result).toEqual({
        mode: "parent",
        userId: "parent-123",
        studentId: "child-1",
        tenantId: "tenant-456",
        actingOnBehalfOf: true,
        childIds: ["child-1", "child-2"],
      });
    });

    it("studentId가 없으면 에러", async () => {
      await expect(strategy.authenticate()).rejects.toThrow(
        "학부모 모드에서는 자녀 학생 ID가 필요합니다."
      );
    });

    it("studentId가 빈 객체로 전달되면 에러", async () => {
      await expect(strategy.authenticate({})).rejects.toThrow(
        "학부모 모드에서는 자녀 학생 ID가 필요합니다."
      );
    });

    it("연결되지 않은 자녀에 대해 접근 시 에러", async () => {
      vi.mocked(requireParent).mockResolvedValue({
        userId: "parent-123",
        role: "parent",
      });

      // Mock: 자녀 연결 데이터 (요청한 studentId 미포함)
      setupMockWithChildren([{ student_id: "other-child" }]);

      await expect(
        strategy.authenticate({ studentId: "unauthorized-child" })
      ).rejects.toThrow("해당 학생에 대한 접근 권한이 없습니다.");
    });

    it("자녀가 없는 학부모가 접근 시 에러", async () => {
      vi.mocked(requireParent).mockResolvedValue({
        userId: "parent-123",
        role: "parent",
      });

      // Mock: 자녀 없음
      setupMockWithChildren([]);

      await expect(
        strategy.authenticate({ studentId: "some-child" })
      ).rejects.toThrow("해당 학생에 대한 접근 권한이 없습니다.");
    });

    it("자녀 조회 DB 에러 시 에러 전파", async () => {
      vi.mocked(requireParent).mockResolvedValue({
        userId: "parent-123",
        role: "parent",
      });

      // Mock: DB 에러
      setupMockWithError({ message: "DB connection failed" });

      await expect(
        strategy.authenticate({ studentId: "child-1" })
      ).rejects.toThrow("자녀 정보를 조회하는데 실패했습니다.");
    });

    it("requireParent 실패 시 에러 전파", async () => {
      vi.mocked(requireParent).mockRejectedValue(new Error("학부모 권한 없음"));

      await expect(
        strategy.authenticate({ studentId: "child-1" })
      ).rejects.toThrow("학부모 인증에 실패했습니다.");
    });

    it("AppError는 그대로 전파", async () => {
      const appError = new AppError(
        "커스텀 에러",
        ErrorCode.FORBIDDEN,
        403
      );
      vi.mocked(requireParent).mockRejectedValue(appError);

      await expect(
        strategy.authenticate({ studentId: "child-1" })
      ).rejects.toThrow("커스텀 에러");
    });

    it("tenantId가 없으면 빈 문자열로 설정", async () => {
      vi.mocked(requireParent).mockResolvedValue({
        userId: "parent-123",
        role: "parent",
      });

      setupMockWithChildren([{ student_id: "child-1" }]);

      const result = await strategy.authenticate({ studentId: "child-1" });

      expect(result.tenantId).toBe("");
    });
  });

  describe("mode", () => {
    it("mode가 'parent'", () => {
      expect(strategy.mode).toBe("parent");
    });
  });
});
