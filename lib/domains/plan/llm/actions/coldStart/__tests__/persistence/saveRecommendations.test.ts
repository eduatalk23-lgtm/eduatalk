/**
 * saveRecommendationsToMasterContent 테스트
 *
 * 추천 결과를 DB에 저장하는 함수를 테스트합니다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RecommendationItem } from "../../types";

// ============================================================================
// Supabase Mock 설정
// ============================================================================

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// duplicateCheck Mock
vi.mock("../../persistence/duplicateCheck", () => ({
  checkBookDuplicate: vi.fn(),
  checkLectureDuplicate: vi.fn(),
}));

// 테스트 대상 import (mock 이후에 import)
import { saveRecommendationsToMasterContent } from "../../persistence/saveRecommendations";
import {
  checkBookDuplicate,
  checkLectureDuplicate,
} from "../../persistence/duplicateCheck";

// ============================================================================
// 테스트용 Mock 데이터
// ============================================================================

function createMockRecommendation(
  overrides: Partial<RecommendationItem> = {}
): RecommendationItem {
  return {
    title: "개념원리 미적분",
    author: "이홍섭",
    publisher: "개념원리",
    contentType: "book",
    totalRange: 320,
    chapters: [
      { title: "1. 수열의 극한", startRange: 1, endRange: 45 },
      { title: "2. 미분법", startRange: 46, endRange: 150 },
    ],
    description: "개념 설명이 자세한 기본서",
    rank: 1,
    matchScore: 95,
    reason: "미적분 개념 학습에 최적화된 교재",
    ...overrides,
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe("saveRecommendationsToMasterContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 기본: 중복 없음
    vi.mocked(checkBookDuplicate).mockResolvedValue({
      isDuplicate: false,
      existingId: null,
    });
    vi.mocked(checkLectureDuplicate).mockResolvedValue({
      isDuplicate: false,
      existingId: null,
    });

    // 기본: 저장 성공
    mockSingle.mockResolvedValue({
      data: { id: "new-id-123" },
      error: null,
    });
  });

  describe("빈 배열 처리", () => {
    it("빈 배열이면 성공 + 빈 결과 반환", async () => {
      const result = await saveRecommendationsToMasterContent([]);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(0);
      expect(result.skippedDuplicates).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("교재 저장", () => {
    it("새 교재를 master_books에 저장", async () => {
      const recommendations = [createMockRecommendation()];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(1);
      expect(result.savedItems[0].isNew).toBe(true);
      expect(result.savedItems[0].contentType).toBe("book");
      expect(mockFrom).toHaveBeenCalledWith("master_books");
    });

    it("중복 교재는 스킵하고 기존 ID 반환", async () => {
      vi.mocked(checkBookDuplicate).mockResolvedValue({
        isDuplicate: true,
        existingId: "existing-book-456",
      });

      const recommendations = [createMockRecommendation()];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(1);
      expect(result.savedItems[0].isNew).toBe(false);
      expect(result.savedItems[0].id).toBe("existing-book-456");
      expect(result.skippedDuplicates).toBe(1);
      // insert는 호출되지 않아야 함
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("강의 저장", () => {
    it("새 강의를 master_lectures에 저장", async () => {
      const recommendations = [
        createMockRecommendation({
          title: "현우진 미적분",
          contentType: "lecture",
          totalRange: 50,
        }),
      ];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(1);
      expect(result.savedItems[0].contentType).toBe("lecture");
      expect(mockFrom).toHaveBeenCalledWith("master_lectures");
    });

    it("중복 강의는 스킵하고 기존 ID 반환", async () => {
      vi.mocked(checkLectureDuplicate).mockResolvedValue({
        isDuplicate: true,
        existingId: "existing-lecture-789",
      });

      const recommendations = [
        createMockRecommendation({ contentType: "lecture" }),
      ];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.savedItems[0].isNew).toBe(false);
      expect(result.savedItems[0].id).toBe("existing-lecture-789");
      expect(result.skippedDuplicates).toBe(1);
    });
  });

  describe("옵션 전달", () => {
    it("tenantId, subjectCategory가 전달됨", async () => {
      const recommendations = [createMockRecommendation()];

      await saveRecommendationsToMasterContent(recommendations, {
        tenantId: "tenant-abc",
        subjectCategory: "수학",
      });

      expect(checkBookDuplicate).toHaveBeenCalledWith(
        "개념원리 미적분",
        "수학",
        "tenant-abc"
      );
    });

    it("tenantId가 없으면 null로 전달", async () => {
      const recommendations = [createMockRecommendation()];

      await saveRecommendationsToMasterContent(recommendations, {
        subjectCategory: "수학",
      });

      expect(checkBookDuplicate).toHaveBeenCalledWith(
        "개념원리 미적분",
        "수학",
        null
      );
    });
  });

  describe("여러 항목 처리", () => {
    it("교재와 강의 혼합 저장", async () => {
      const recommendations = [
        createMockRecommendation({ title: "교재1", contentType: "book" }),
        createMockRecommendation({ title: "강의1", contentType: "lecture" }),
        createMockRecommendation({ title: "교재2", contentType: "book" }),
      ];

      // 각 호출마다 다른 ID 반환
      mockSingle
        .mockResolvedValueOnce({ data: { id: "book-1" }, error: null })
        .mockResolvedValueOnce({ data: { id: "lecture-1" }, error: null })
        .mockResolvedValueOnce({ data: { id: "book-2" }, error: null });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(3);
      expect(result.savedItems.map((i) => i.id)).toEqual([
        "book-1",
        "lecture-1",
        "book-2",
      ]);
    });

    it("일부만 중복인 경우 혼합 처리", async () => {
      // 첫 번째 교재: 중복
      vi.mocked(checkBookDuplicate)
        .mockResolvedValueOnce({
          isDuplicate: true,
          existingId: "existing-1",
        })
        // 세 번째 교재: 새로운
        .mockResolvedValueOnce({
          isDuplicate: false,
          existingId: null,
        });

      const recommendations = [
        createMockRecommendation({ title: "중복교재", contentType: "book" }),
        createMockRecommendation({ title: "새강의", contentType: "lecture" }),
        createMockRecommendation({ title: "새교재", contentType: "book" }),
      ];

      mockSingle
        .mockResolvedValueOnce({ data: { id: "new-lecture" }, error: null })
        .mockResolvedValueOnce({ data: { id: "new-book" }, error: null });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(3);
      expect(result.skippedDuplicates).toBe(1);

      // 중복 항목
      expect(result.savedItems[0].isNew).toBe(false);
      expect(result.savedItems[0].id).toBe("existing-1");

      // 새 항목들
      expect(result.savedItems[1].isNew).toBe(true);
      expect(result.savedItems[2].isNew).toBe(true);
    });
  });

  describe("에러 처리", () => {
    it("insert 에러 시 errors 배열에 추가", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Insert failed" },
      });

      const recommendations = [createMockRecommendation()];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].title).toBe("개념원리 미적분");
      expect(result.errors[0].error).toBe("Insert failed");
    });

    it("일부 항목만 실패해도 나머지는 처리", async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: "success-1" }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: "Failed" } })
        .mockResolvedValueOnce({ data: { id: "success-2" }, error: null });

      const recommendations = [
        createMockRecommendation({ title: "성공1", contentType: "book" }),
        createMockRecommendation({ title: "실패", contentType: "lecture" }),
        createMockRecommendation({ title: "성공2", contentType: "book" }),
      ];

      // 강의 중복체크도 mock
      vi.mocked(checkLectureDuplicate).mockResolvedValue({
        isDuplicate: false,
        existingId: null,
      });
      vi.mocked(checkBookDuplicate).mockResolvedValue({
        isDuplicate: false,
        existingId: null,
      });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(false); // 에러가 있으므로 false
      expect(result.savedItems).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].title).toBe("실패");
    });

    it("중복 검사 에러 시 errors에 추가", async () => {
      vi.mocked(checkBookDuplicate).mockRejectedValue(
        new Error("DB connection failed")
      );

      const recommendations = [createMockRecommendation()];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe("DB connection failed");
    });
  });

  describe("결과 통계", () => {
    it("정확한 저장 통계 반환", async () => {
      // 3개 중 1개 중복
      vi.mocked(checkBookDuplicate)
        .mockResolvedValueOnce({ isDuplicate: true, existingId: "dup-1" })
        .mockResolvedValueOnce({ isDuplicate: false, existingId: null })
        .mockResolvedValueOnce({ isDuplicate: false, existingId: null });

      mockSingle
        .mockResolvedValueOnce({ data: { id: "new-1" }, error: null })
        .mockResolvedValueOnce({ data: { id: "new-2" }, error: null });

      const recommendations = [
        createMockRecommendation({ title: "교재1" }),
        createMockRecommendation({ title: "교재2" }),
        createMockRecommendation({ title: "교재3" }),
      ];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(3);
      expect(result.skippedDuplicates).toBe(1);
      expect(result.savedItems.filter((i) => i.isNew)).toHaveLength(2);
      expect(result.savedItems.filter((i) => !i.isNew)).toHaveLength(1);
    });
  });
});
