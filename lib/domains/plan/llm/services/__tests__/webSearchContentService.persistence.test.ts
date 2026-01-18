/**
 * WebSearchContentService DB 영속성 테스트
 *
 * saveToDatabase, findExistingWebContent 메서드를 테스트합니다.
 * Supabase Admin 클라이언트를 Mock합니다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebSearchContent } from "../webSearchContentService";

// ============================================================================
// Supabase Mock 설정
// ============================================================================

const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockNot = vi.fn();
const mockIn = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockIs = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();

// 체이닝 설정 함수 - single, maybeSingle, limit은 Promise를 반환해야 함
function setupQueryChain() {
  // 체이닝용 객체 (순환 참조를 위해 먼저 선언)
  const queryMethods: Record<string, ReturnType<typeof vi.fn>> = {};

  // 체이닝 메서드들 설정
  mockSelect.mockImplementation(() => queryMethods);
  mockEq.mockImplementation(() => queryMethods);
  mockIs.mockImplementation(() => queryMethods);
  mockOr.mockImplementation(() => queryMethods);
  mockOrder.mockImplementation(() => queryMethods);
  mockNot.mockImplementation(() => queryMethods);
  mockIn.mockImplementation(() => queryMethods);
  mockInsert.mockImplementation(() => queryMethods);
  mockFrom.mockImplementation(() => queryMethods);

  // queryMethods에 참조 할당
  queryMethods.select = mockSelect;
  queryMethods.eq = mockEq;
  queryMethods.is = mockIs;
  queryMethods.or = mockOr;
  queryMethods.order = mockOrder;
  queryMethods.limit = mockLimit;
  queryMethods.not = mockNot;
  queryMethods.in = mockIn;
  queryMethods.single = mockSingle;
  queryMethods.maybeSingle = mockMaybeSingle;
  queryMethods.insert = mockInsert;
}

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// 테스트 대상 import (mock 이후에 import)
import { getWebSearchContentService } from "../webSearchContentService";

// ============================================================================
// 테스트용 Mock 데이터
// ============================================================================

function createMockWebContent(
  overrides: Partial<WebSearchContent> = {}
): WebSearchContent {
  return {
    id: `web-content-${Date.now()}`,
    title: "테스트 콘텐츠",
    url: "https://example.com/test",
    contentType: "web_book",
    source: "tavily_search",
    searchQuery: "테스트 검색어",
    searchDate: new Date().toISOString(),
    subjectCategory: "수학",
    subject: "미적분",
    snippet: "테스트 설명",
    author: "테스트 저자",
    publisher: "테스트 출판사",
    totalRange: 100,
    difficultyLevel: "기본",
    chapters: [
      { title: "1장", startRange: 1, endRange: 50 },
      { title: "2장", startRange: 51, endRange: 100 },
    ],
    ...overrides,
  };
}

// ============================================================================
// saveToDatabase 테스트
// ============================================================================

describe("WebSearchContentService.saveToDatabase", () => {
  const service = getWebSearchContentService();

  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryChain();

    // 기본: 중복 없음
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // 기본: 저장 성공
    mockSingle.mockResolvedValue({
      data: { id: "new-id-123" },
      error: null,
    });
  });

  describe("빈 배열 처리", () => {
    it("빈 배열이면 성공 + 빈 결과 반환", async () => {
      const result = await service.saveToDatabase([], "tenant-abc");

      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(0);
      expect(result.savedIds).toHaveLength(0);
      expect(result.duplicateCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("교재(book) 저장", () => {
    it("새 교재를 master_books에 저장", async () => {
      const contents = [createMockWebContent({ contentType: "web_book" })];

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(1);
      expect(result.savedIds).toContain("new-id-123");
      expect(mockFrom).toHaveBeenCalledWith("master_books");
    });

    it("URL 중복 교재는 스킵", async () => {
      // master_books에서 중복 발견
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: "existing-book-456" },
        error: null,
      });

      const contents = [createMockWebContent({ contentType: "web_book" })];

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(0);
      expect(result.duplicateCount).toBe(1);
      // insert는 from을 호출하지만, 중복이면 데이터 삽입 안 함
    });

    it("교재 저장 시 올바른 필드 매핑", async () => {
      const content = createMockWebContent({
        title: "개념원리 미적분",
        url: "https://example.com/book",
        contentType: "web_book",
        author: "이홍섭",
        publisher: "개념원리",
        totalRange: 320,
        difficultyLevel: "기본",
        snippet: "테스트 설명",
        searchQuery: "미적분 교재",
        chapters: [{ title: "1장", startRange: 1, endRange: 100 }],
      });

      await service.saveToDatabase([content], "tenant-abc");

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: "tenant-abc",
          title: "개념원리 미적분",
          source_url: "https://example.com/book",
          source: "web_search",
          author: "이홍섭",
          publisher_name: "개념원리",
          total_pages: 320,
          difficulty_level: "기본",
          is_active: true,
        })
      );
    });
  });

  describe("강의(lecture) 저장", () => {
    it("새 강의를 master_lectures에 저장", async () => {
      const contents = [createMockWebContent({ contentType: "web_lecture" })];

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(1);
      expect(mockFrom).toHaveBeenCalledWith("master_lectures");
    });

    it("URL 중복 강의는 스킵", async () => {
      // master_books에서 중복 없음, master_lectures에서 중복 발견
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: "existing-lecture-789" },
          error: null,
        });

      const contents = [createMockWebContent({ contentType: "web_lecture" })];

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.duplicateCount).toBe(1);
      expect(result.savedCount).toBe(0);
    });

    it("강의 저장 시 올바른 필드 매핑", async () => {
      const content = createMockWebContent({
        title: "현우진 미적분",
        url: "https://example.com/lecture",
        contentType: "web_lecture",
        author: "현우진",
        publisher: "메가스터디",
        totalRange: 50,
        difficultyLevel: "심화",
        chapters: [{ title: "OT", startRange: 1, endRange: 5 }],
      });

      await service.saveToDatabase([content], "tenant-abc");

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: "tenant-abc",
          title: "현우진 미적분",
          lecture_source_url: "https://example.com/lecture",
          instructor_name: "현우진",
          platform_name: "메가스터디",
          total_episodes: 50,
          difficulty_level: "심화",
          is_active: true,
        })
      );
    });

    it("totalRange가 0이면 total_episodes는 1", async () => {
      const content = createMockWebContent({
        contentType: "web_lecture",
        totalRange: 0,
      });

      await service.saveToDatabase([content], "tenant-abc");

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          total_episodes: 1,
        })
      );
    });
  });

  describe("여러 항목 처리", () => {
    it("교재와 강의 혼합 저장", async () => {
      const contents = [
        createMockWebContent({ title: "교재1", contentType: "web_book" }),
        createMockWebContent({ title: "강의1", contentType: "web_lecture" }),
        createMockWebContent({ title: "교재2", contentType: "web_book" }),
      ];

      // 각 호출마다 다른 ID 반환
      mockSingle
        .mockResolvedValueOnce({ data: { id: "book-1" }, error: null })
        .mockResolvedValueOnce({ data: { id: "lecture-1" }, error: null })
        .mockResolvedValueOnce({ data: { id: "book-2" }, error: null });

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(3);
      expect(result.savedIds).toEqual(["book-1", "lecture-1", "book-2"]);
    });

    it("일부만 중복인 경우 혼합 처리", async () => {
      // 첫 번째: 중복
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: "existing" }, error: null })
        // 두 번째: 새로운 (books 체크 후 lectures 체크)
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        // 세 번째: 새로운
        .mockResolvedValueOnce({ data: null, error: null });

      mockSingle
        .mockResolvedValueOnce({ data: { id: "new-lecture" }, error: null })
        .mockResolvedValueOnce({ data: { id: "new-book" }, error: null });

      const contents = [
        createMockWebContent({ title: "중복교재", contentType: "web_book" }),
        createMockWebContent({ title: "새강의", contentType: "web_lecture" }),
        createMockWebContent({ title: "새교재", contentType: "web_book" }),
      ];

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.savedCount).toBe(2);
      expect(result.duplicateCount).toBe(1);
    });
  });

  describe("에러 처리", () => {
    it("insert 에러 시 errors 배열에 추가", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Insert failed" },
      });

      const contents = [createMockWebContent()];

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("저장 실패");
    });

    it("일부 항목만 실패해도 나머지는 처리", async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: "success-1" }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: "Failed" } })
        .mockResolvedValueOnce({ data: { id: "success-2" }, error: null });

      const contents = [
        createMockWebContent({ title: "성공1", contentType: "web_book" }),
        createMockWebContent({ title: "실패", contentType: "web_book" }),
        createMockWebContent({ title: "성공2", contentType: "web_book" }),
      ];

      const result = await service.saveToDatabase(contents, "tenant-abc");

      expect(result.success).toBe(false);
      expect(result.savedCount).toBe(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("구조 데이터 처리", () => {
    it("chapters가 있으면 page_analysis에 저장 (book)", async () => {
      const content = createMockWebContent({
        contentType: "web_book",
        chapters: [
          { title: "1장", startRange: 1, endRange: 50 },
          { title: "2장", startRange: 51, endRange: 100 },
        ],
      });

      await service.saveToDatabase([content], "tenant-abc");

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.page_analysis).not.toBeNull();
      // JSON 문자열 또는 객체로 저장됨
      const analysis =
        typeof insertArg.page_analysis === "string"
          ? JSON.parse(insertArg.page_analysis)
          : insertArg.page_analysis;
      expect(analysis.chapters).toBeDefined();
      expect(analysis.chapters).toHaveLength(2);
    });

    it("chapters가 없으면 page_analysis는 null", async () => {
      const content = createMockWebContent({
        contentType: "web_book",
        chapters: undefined,
      });

      await service.saveToDatabase([content], "tenant-abc");

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.page_analysis).toBeNull();
    });

    it("chapters가 있으면 episode_analysis에 저장 (lecture)", async () => {
      const content = createMockWebContent({
        contentType: "web_lecture",
        chapters: [{ title: "OT", startRange: 1, endRange: 5 }],
      });

      await service.saveToDatabase([content], "tenant-abc");

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.episode_analysis).not.toBeNull();
      const analysis =
        typeof insertArg.episode_analysis === "string"
          ? JSON.parse(insertArg.episode_analysis)
          : insertArg.episode_analysis;
      expect(analysis.chapters).toBeDefined();
    });
  });
});

// ============================================================================
// findExistingWebContent 테스트
// ============================================================================

describe("WebSearchContentService.findExistingWebContent", () => {
  const service = getWebSearchContentService();

  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryChain();

    // 캐시 초기화 (캐시 히트로 인한 mock 미호출 방지)
    service.clearCache();

    // 기본: 빈 결과
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe("기본 조회", () => {
    it("tenantId로 필터링된 결과 반환", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      const result = await service.findExistingWebContent("tenant-abc");

      expect(result).toEqual([]);
      expect(mockFrom).toHaveBeenCalledWith("master_books");
      expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-abc");
    });

    it("tenantId가 null이면 is null 조건", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent(null);

      expect(mockIs).toHaveBeenCalledWith("tenant_id", null);
    });
  });

  describe("옵션 필터링", () => {
    it("subjectCategory 필터 적용", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        subjectCategory: "수학",
      });

      expect(mockEq).toHaveBeenCalledWith("subject_category", "수학");
    });

    it("subject 필터 적용", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        subject: "미적분",
      });

      expect(mockEq).toHaveBeenCalledWith("subject", "미적분");
    });

    it("difficulty 필터 적용", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        difficulty: "심화",
      });

      expect(mockEq).toHaveBeenCalledWith("difficulty_level", "심화");
    });

    it("source 필터 적용", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        source: "cold_start",
      });

      expect(mockEq).toHaveBeenCalledWith("source", "cold_start");
    });
  });

  describe("콘텐츠 타입별 조회", () => {
    it("contentType=book이면 master_books만 조회", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        contentType: "book",
      });

      expect(mockFrom).toHaveBeenCalledWith("master_books");
      // 한 번만 호출됨 (lectures 조회 없음)
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("contentType=lecture이면 master_lectures만 조회", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        contentType: "lecture",
      });

      expect(mockFrom).toHaveBeenCalledWith("master_lectures");
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("contentType=all이면 둘 다 조회", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        contentType: "all",
      });

      expect(mockFrom).toHaveBeenCalledWith("master_books");
      expect(mockFrom).toHaveBeenCalledWith("master_lectures");
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });

  describe("결과 변환", () => {
    it("조회 결과가 올바르게 변환됨", async () => {
      mockLimit.mockResolvedValue({
        data: [
          {
            id: "book-1",
            title: "테스트 교재",
            subject_category: "수학",
            subject: "미적분",
            difficulty_level: "기본",
            total_pages: 300,
            source: "cold_start",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
        error: null,
      });

      const result = await service.findExistingWebContent("tenant-abc", {
        contentType: "book",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "book-1",
        title: "테스트 교재",
        contentType: "book",
        subjectCategory: "수학",
        subject: "미적분",
        difficultyLevel: "기본",
        totalRange: 300,
        source: "cold_start",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });
  });

  describe("limit 적용", () => {
    it("커스텀 limit 적용", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        limit: 5,
        contentType: "book",
      });

      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("limit 미지정 시 기본값 50 (쿼리 레벨)", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await service.findExistingWebContent("tenant-abc", {
        contentType: "book",
      });

      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });
});
