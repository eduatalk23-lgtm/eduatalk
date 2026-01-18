/**
 * Persistence duplicateCheck 테스트
 *
 * 중복 검사 함수를 테스트합니다.
 * Supabase Admin 클라이언트를 Mock합니다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Supabase Mock 설정
// ============================================================================

const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn(() => ({ limit: mockLimit, eq: mockEq, is: mockIs }));
const mockIs = vi.fn(() => ({ limit: mockLimit, eq: mockEq, is: mockIs }));
const mockIlike = vi.fn(() => ({ eq: mockEq, is: mockIs }));
const mockSelect = vi.fn(() => ({ ilike: mockIlike }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// 테스트 대상 import (mock 이후에 import)
import {
  checkBookDuplicate,
  checkLectureDuplicate,
} from "../../persistence/duplicateCheck";

// ============================================================================
// 테스트
// ============================================================================

describe("checkBookDuplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본 체인 설정
    mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
  });

  describe("중복이 없는 경우", () => {
    it("중복이 없으면 isDuplicate: false 반환", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" }, // no rows returned
      });

      const result = await checkBookDuplicate("개념원리 미적분", "수학", null);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingId).toBeNull();
    });

    it("올바른 테이블에서 조회", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkBookDuplicate("테스트 교재", "수학", null);

      expect(mockFrom).toHaveBeenCalledWith("master_books");
    });

    it("제목으로 ilike 검색 수행", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkBookDuplicate("  개념원리 미적분  ", "수학", null);

      expect(mockIlike).toHaveBeenCalledWith("title", "개념원리 미적분");
    });
  });

  describe("중복이 있는 경우", () => {
    it("중복이 있으면 isDuplicate: true와 기존 ID 반환", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "existing-book-123" },
        error: null,
      });

      const result = await checkBookDuplicate("개념원리 미적분", "수학", null);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe("existing-book-123");
    });
  });

  describe("테넌트 조건", () => {
    it("tenantId가 null이면 is('tenant_id', null) 조건", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkBookDuplicate("테스트", "수학", null);

      expect(mockIs).toHaveBeenCalledWith("tenant_id", null);
    });

    it("tenantId가 있으면 eq('tenant_id', tenantId) 조건", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkBookDuplicate("테스트", "수학", "tenant-abc");

      expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-abc");
    });
  });

  describe("교과 조건", () => {
    it("subjectCategory가 있으면 eq 조건 추가", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkBookDuplicate("테스트", "수학", null);

      expect(mockEq).toHaveBeenCalledWith("subject_category", "수학");
    });

    it("subjectCategory가 null이면 교과 조건 없음", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkBookDuplicate("테스트", null, null);

      // subject_category로 eq가 호출되지 않아야 함
      // (tenant_id 관련 eq만 호출됨)
      const subjectCategoryCalls = mockEq.mock.calls.filter(
        (call) => call[0] === "subject_category"
      );
      expect(subjectCategoryCalls).toHaveLength(0);
    });
  });

  describe("에러 처리", () => {
    it("PGRST116(no rows)가 아닌 에러는 throw", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST500", message: "Internal error" },
      });

      await expect(
        checkBookDuplicate("테스트", "수학", null)
      ).rejects.toThrow("교재 중복 검사 실패");
    });
  });
});

describe("checkLectureDuplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
  });

  describe("중복이 없는 경우", () => {
    it("중복이 없으면 isDuplicate: false 반환", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const result = await checkLectureDuplicate("현우진 미적분", "수학", null);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingId).toBeNull();
    });

    it("올바른 테이블에서 조회", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkLectureDuplicate("테스트 강의", "수학", null);

      expect(mockFrom).toHaveBeenCalledWith("master_lectures");
    });
  });

  describe("중복이 있는 경우", () => {
    it("중복이 있으면 isDuplicate: true와 기존 ID 반환", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "existing-lecture-456" },
        error: null,
      });

      const result = await checkLectureDuplicate("현우진 미적분", "수학", null);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe("existing-lecture-456");
    });
  });

  describe("테넌트 및 교과 조건", () => {
    it("모든 조건이 올바르게 적용됨", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      await checkLectureDuplicate("테스트 강의", "영어", "tenant-xyz");

      expect(mockFrom).toHaveBeenCalledWith("master_lectures");
      expect(mockIlike).toHaveBeenCalledWith("title", "테스트 강의");
      expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-xyz");
      expect(mockEq).toHaveBeenCalledWith("subject_category", "영어");
    });
  });

  describe("에러 처리", () => {
    it("DB 에러 시 throw", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST500", message: "Connection failed" },
      });

      await expect(
        checkLectureDuplicate("테스트", "수학", null)
      ).rejects.toThrow("강의 중복 검사 실패");
    });
  });
});
