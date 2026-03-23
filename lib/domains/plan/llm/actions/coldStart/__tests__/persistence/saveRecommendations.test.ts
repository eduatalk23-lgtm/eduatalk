/**
 * saveRecommendationsToMasterContent 테스트
 *
 * 추천 결과를 DB에 저장하는 함수를 테스트합니다.
 * 현재 프로덕션 코드는 배치 중복 검사 + 배치 INSERT를 사용합니다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RecommendationItem } from "../../types";
import type { ExistingContentInfo } from "../../persistence/types";

// ============================================================================
// Supabase Mock 설정
// ============================================================================

const mockEq = vi.fn().mockReturnValue({ data: null, error: null });
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// duplicateCheck Mock — 배치 API
const mockCheckBookBatch = vi.fn();
const mockCheckLectureBatch = vi.fn();

vi.mock("../../persistence/duplicateCheck", () => ({
  checkBookDuplicate: vi.fn(),
  checkLectureDuplicate: vi.fn(),
  checkBookDuplicatesBatch: vi.fn(),
  checkLectureDuplicatesBatch: vi.fn(),
  checkBookDuplicatesBatchWithDetails: (...args: unknown[]) => mockCheckBookBatch(...args),
  checkLectureDuplicatesBatchWithDetails: (...args: unknown[]) => mockCheckLectureBatch(...args),
}));

// instructorPersistence Mock
vi.mock("../../persistence/instructorPersistence", () => ({
  saveInstructorsAndLinkLectures: vi.fn().mockResolvedValue({
    savedInstructors: [],
    skippedDuplicates: 0,
    linkedLectures: 0,
    errors: [],
  }),
}));

// 테스트 대상 import
import { saveRecommendationsToMasterContent } from "../../persistence/saveRecommendations";

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

function emptyBatchResult() {
  return {
    existingMap: new Map<string, ExistingContentInfo>(),
    duplicateTitles: [],
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe("saveRecommendationsToMasterContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 기본: 중복 없음 (배치)
    mockCheckBookBatch.mockResolvedValue(emptyBatchResult());
    mockCheckLectureBatch.mockResolvedValue(emptyBatchResult());

    // 기본: 배치 INSERT 성공
    mockSelect.mockReturnValue({
      single: mockSingle,
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
    it("새 교재를 master_books에 배치 저장", async () => {
      const recommendations = [createMockRecommendation()];

      // 배치 INSERT 성공
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [{ id: "new-id-123", title: "개념원리 미적분" }],
          error: null,
        }),
      });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(1);
      expect(result.savedItems[0].isNew).toBe(true);
      expect(result.savedItems[0].contentType).toBe("book");
      expect(mockFrom).toHaveBeenCalledWith("master_books");
    });

    it("중복 교재는 스킵하고 기존 ID 반환", async () => {
      const existingMap = new Map<string, ExistingContentInfo>();
      existingMap.set("개념원리 미적분", {
        id: "existing-book-456",
        source: "cold_start",
        hasRecommendationMetadata: true,
        qualityScore: 80,
        coldStartUpdateCount: 0,
      });
      mockCheckBookBatch.mockResolvedValue({
        existingMap,
        duplicateTitles: ["개념원리 미적분"],
      });

      const recommendations = [createMockRecommendation()];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(1);
      expect(result.savedItems[0].isNew).toBe(false);
      expect(result.savedItems[0].id).toBe("existing-book-456");
      expect(result.skippedDuplicates).toBe(1);
      // INSERT는 호출되지 않아야 함
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("강의 저장", () => {
    it("새 강의를 master_lectures에 배치 저장", async () => {
      const recommendations = [
        createMockRecommendation({
          title: "현우진 미적분",
          contentType: "lecture",
          totalRange: 50,
        }),
      ];

      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [{ id: "new-lecture-1", title: "현우진 미적분" }],
          error: null,
        }),
      });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(1);
      expect(result.savedItems[0].contentType).toBe("lecture");
      expect(mockFrom).toHaveBeenCalledWith("master_lectures");
    });

    it("중복 강의는 스킵하고 기존 ID 반환", async () => {
      const existingMap = new Map<string, ExistingContentInfo>();
      existingMap.set("개념원리 미적분", {
        id: "existing-lecture-789",
        source: "cold_start",
        hasRecommendationMetadata: true,
        qualityScore: 70,
        coldStartUpdateCount: 0,
      });
      mockCheckLectureBatch.mockResolvedValue({
        existingMap,
        duplicateTitles: ["개념원리 미적분"],
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
    it("tenantId, subjectCategory가 배치 중복검사에 전달됨", async () => {
      const recommendations = [createMockRecommendation()];

      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [{ id: "new-id", title: "개념원리 미적분" }],
          error: null,
        }),
      });

      await saveRecommendationsToMasterContent(recommendations, {
        tenantId: "tenant-abc",
        subjectCategory: "수학",
      });

      expect(mockCheckBookBatch).toHaveBeenCalledWith(
        ["개념원리 미적분"],
        "수학",
        "tenant-abc"
      );
    });

    it("tenantId가 없으면 null로 전달", async () => {
      const recommendations = [createMockRecommendation()];

      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [{ id: "new-id", title: "개념원리 미적분" }],
          error: null,
        }),
      });

      await saveRecommendationsToMasterContent(recommendations, {
        subjectCategory: "수학",
      });

      expect(mockCheckBookBatch).toHaveBeenCalledWith(
        ["개념원리 미적분"],
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

      // 교재 배치 INSERT
      mockInsert
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            data: [
              { id: "book-1", title: "교재1" },
              { id: "book-2", title: "교재2" },
            ],
            error: null,
          }),
        })
        // 강의 배치 INSERT
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            data: [{ id: "lecture-1", title: "강의1" }],
            error: null,
          }),
        });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(3);
      expect(result.newCount).toBe(3);
    });

    it("일부만 중복인 경우 혼합 처리", async () => {
      // 교재 "중복교재"는 기존 데이터 있음
      const bookExistingMap = new Map<string, ExistingContentInfo>();
      bookExistingMap.set("중복교재", {
        id: "existing-1",
        source: "cold_start",
        hasRecommendationMetadata: true,
        qualityScore: 90,
        coldStartUpdateCount: 0,
      });
      mockCheckBookBatch.mockResolvedValue({
        existingMap: bookExistingMap,
        duplicateTitles: ["중복교재"],
      });

      const recommendations = [
        createMockRecommendation({ title: "중복교재", contentType: "book" }),
        createMockRecommendation({ title: "새강의", contentType: "lecture" }),
        createMockRecommendation({ title: "새교재", contentType: "book" }),
      ];

      mockInsert
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            data: [{ id: "new-book", title: "새교재" }],
            error: null,
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            data: [{ id: "new-lecture", title: "새강의" }],
            error: null,
          }),
        });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(3);
      expect(result.skippedDuplicates).toBe(1);
      expect(result.newCount).toBe(2);

      // 중복 항목
      const dupItem = result.savedItems.find((i) => i.id === "existing-1");
      expect(dupItem?.isNew).toBe(false);

      // 새 항목들
      const newItems = result.savedItems.filter((i) => i.isNew);
      expect(newItems).toHaveLength(2);
    });
  });

  describe("에러 처리", () => {
    it("배치 INSERT 에러 시 개별 INSERT로 폴백", async () => {
      const recommendations = [createMockRecommendation()];

      // 배치 INSERT 실패 → 개별 INSERT 폴백
      mockInsert
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            data: null,
            error: { message: "Batch insert failed" },
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: null,
              error: { message: "Insert failed" },
            }),
          }),
        });

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].title).toBe("개념원리 미적분");
    });

    it("중복 검사 에러 시 전체 실패", async () => {
      mockCheckBookBatch.mockRejectedValue(
        new Error("DB connection failed")
      );

      const recommendations = [createMockRecommendation()];

      await expect(
        saveRecommendationsToMasterContent(recommendations)
      ).rejects.toThrow("DB connection failed");
    });
  });

  describe("결과 통계", () => {
    it("정확한 저장 통계 반환", async () => {
      // 3개 중 1개 중복
      const bookExistingMap = new Map<string, ExistingContentInfo>();
      bookExistingMap.set("교재1", {
        id: "dup-1",
        source: "cold_start",
        hasRecommendationMetadata: true,
        qualityScore: 80,
        coldStartUpdateCount: 0,
      });
      mockCheckBookBatch.mockResolvedValue({
        existingMap: bookExistingMap,
        duplicateTitles: ["교재1"],
      });

      // 나머지 2개 INSERT 성공
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [
            { id: "new-1", title: "교재2" },
            { id: "new-2", title: "교재3" },
          ],
          error: null,
        }),
      });

      const recommendations = [
        createMockRecommendation({ title: "교재1" }),
        createMockRecommendation({ title: "교재2" }),
        createMockRecommendation({ title: "교재3" }),
      ];

      const result = await saveRecommendationsToMasterContent(recommendations);

      expect(result.success).toBe(true);
      expect(result.savedItems).toHaveLength(3);
      expect(result.skippedDuplicates).toBe(1);
      expect(result.newCount).toBe(2);
      expect(result.savedItems.filter((i) => i.isNew)).toHaveLength(2);
      expect(result.savedItems.filter((i) => !i.isNew)).toHaveLength(1);
    });
  });
});
