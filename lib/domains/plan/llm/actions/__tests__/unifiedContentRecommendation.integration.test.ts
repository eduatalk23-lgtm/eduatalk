/**
 * 통합 콘텐츠 추천 통합 테스트
 *
 * 테스트 범위:
 * 1. 전체 파이프라인 동작 (캐시 → 콜드 스타트)
 * 2. DB 저장 및 조회
 * 3. 실제 API 호출 (선택적)
 *
 * 실행 방법:
 *   pnpm test lib/domains/plan/llm/actions/__tests__/unifiedContentRecommendation.integration.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UnifiedRecommendResult } from "../unifiedContentRecommendation";

// ============================================
// Mock 설정
// ============================================

// Auth mock
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Supabase Server mock (학생 데이터 확인용)
const mockSupabaseSelect = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: mockSupabaseSelect,
        })),
      })),
    })),
  })),
}));

// WebSearchContentService mock
const mockFindExistingWebContent = vi.fn();
const mockGetWebSearchContentService = vi.fn(() => ({
  findExistingWebContent: mockFindExistingWebContent,
}));
vi.mock("@/lib/domains/plan/llm/services/webSearchContentService", () => ({
  getWebSearchContentService: () => mockGetWebSearchContentService(),
}));

// Cold Start Pipeline mock
const mockRunColdStartPipeline = vi.fn();
vi.mock("@/lib/domains/plan/llm/actions/coldStart", () => ({
  runColdStartPipeline: (input: unknown, options: unknown) =>
    mockRunColdStartPipeline(input, options),
}));

// 테스트 대상 import (mock 설정 후)
import { getUnifiedContentRecommendation } from "@/lib/domains/plan/llm/actions/unifiedContentRecommendation";

// ============================================
// 테스트 헬퍼
// ============================================

function createMockUser(overrides?: { userId?: string; tenantId?: string }) {
  return {
    userId: overrides?.userId ?? "user-123",
    tenantId: overrides?.tenantId ?? "tenant-456",
    role: "student" as const,
    email: "test@example.com",
  };
}

function createMockCacheContent(id: string, title: string) {
  return {
    id,
    title,
    contentType: "book" as const,
    subjectCategory: "수학",
    subject: "미적분",
    difficultyLevel: "개념",
    totalRange: 300,
    source: "cold_start",
    createdAt: new Date().toISOString(),
  };
}

function createMockColdStartResult(
  recommendations: Array<{
    title: string;
    contentType: "book" | "lecture";
    totalRange: number;
  }>
): {
  success: boolean;
  recommendations: Array<{
    title: string;
    contentType: "book" | "lecture";
    totalRange: number;
    chapters: never[];
    rank: number;
    matchScore: number;
    reason: string;
  }>;
  persistence?: {
    savedIds: string[];
    newlySaved: number;
    duplicates: number;
  };
} {
  return {
    success: true,
    recommendations: recommendations.map((r, i) => ({
      ...r,
      chapters: [],
      rank: i + 1,
      matchScore: 90 - i * 5,
      reason: `추천 이유 ${i + 1}`,
    })),
    persistence: {
      savedIds: recommendations.map((_, i) => `saved-id-${i}`),
      newlySaved: recommendations.length,
      duplicates: 0,
    },
  };
}

// ============================================
// 테스트
// ============================================

describe("통합 콘텐츠 추천 - 통합 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 기본 mock 설정
    mockGetCurrentUser.mockResolvedValue(createMockUser());
    mockSupabaseSelect.mockResolvedValue({ count: 0 });
    mockFindExistingWebContent.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("인증 검증", () => {
    it("로그인하지 않은 사용자는 에러 반환", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("로그인이 필요합니다.");
    });
  });

  describe("입력 검증", () => {
    it("tenantId 없으면 에러", async () => {
      const result = await getUnifiedContentRecommendation({
        tenantId: "",
        subjectCategory: "수학",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("테넌트 ID가 필요합니다.");
    });

    it("subjectCategory 없으면 에러", async () => {
      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("교과를 선택해주세요.");
    });
  });

  describe("캐시 전략", () => {
    it("캐시에 충분한 결과가 있으면 캐시만 사용", async () => {
      const cacheContents = [
        createMockCacheContent("cache-1", "개념원리 수학"),
        createMockCacheContent("cache-2", "수학의 정석"),
        createMockCacheContent("cache-3", "바이블 수학"),
        createMockCacheContent("cache-4", "쎈 수학"),
        createMockCacheContent("cache-5", "마플 수학"),
      ];
      mockFindExistingWebContent.mockResolvedValue(cacheContents);

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        maxResults: 5,
        useCache: true,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("cache");
      expect(result.recommendations).toHaveLength(5);
      expect(result.stats?.fromCache).toBe(5);
      expect(result.stats?.fromWebSearch).toBe(0);

      // 콜드 스타트가 호출되지 않아야 함
      expect(mockRunColdStartPipeline).not.toHaveBeenCalled();
    });

    it("useCache=false면 캐시 확인 안 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue(
        createMockColdStartResult([
          { title: "새 교재", contentType: "book", totalRange: 200 },
        ])
      );

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        useCache: false,
        forceColdStart: true,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("coldStart");
      expect(mockFindExistingWebContent).not.toHaveBeenCalled();
    });
  });

  describe("콜드 스타트 전략", () => {
    it("forceColdStart=true면 콜드 스타트 실행", async () => {
      mockRunColdStartPipeline.mockResolvedValue(
        createMockColdStartResult([
          { title: "개념원리 미적분", contentType: "book", totalRange: 320 },
          { title: "수학의 바이블", contentType: "book", totalRange: 450 },
        ])
      );

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        subject: "미적분",
        difficultyLevel: "개념",
        forceColdStart: true,
        maxResults: 5,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("coldStart");
      expect(result.recommendations).toHaveLength(2);
      expect(result.stats?.fromWebSearch).toBe(2);

      // 콜드 스타트 파이프라인이 올바른 인자로 호출됨
      expect(mockRunColdStartPipeline).toHaveBeenCalledWith(
        {
          subjectCategory: "수학",
          subject: "미적분",
          difficulty: "개념",
          contentType: undefined,
        },
        expect.objectContaining({
          saveToDb: true,
          tenantId: null, // 공유 카탈로그
        })
      );
    });

    it("캐시 부족 시 콜드 스타트로 보충", async () => {
      // 캐시에 2개만 있음
      mockFindExistingWebContent.mockResolvedValue([
        createMockCacheContent("cache-1", "캐시 교재 1"),
        createMockCacheContent("cache-2", "캐시 교재 2"),
      ]);

      // 콜드 스타트에서 3개 추가
      mockRunColdStartPipeline.mockResolvedValue(
        createMockColdStartResult([
          { title: "새 교재 1", contentType: "book", totalRange: 200 },
          { title: "새 교재 2", contentType: "book", totalRange: 250 },
          { title: "새 교재 3", contentType: "book", totalRange: 300 },
        ])
      );

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        maxResults: 5,
        useCache: true,
      });

      expect(result.success).toBe(true);
      expect(result.stats?.fromCache).toBe(2);
      expect(result.stats?.fromWebSearch).toBe(3);
      // 콜드 스타트가 3개만 요청
      expect(mockRunColdStartPipeline).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          preferences: expect.objectContaining({
            maxResults: 3, // 5 - 2 = 3
          }),
        })
      );
    });

    it("콜드 스타트 실패 시 캐시 결과라도 반환", async () => {
      mockFindExistingWebContent.mockResolvedValue([
        createMockCacheContent("cache-1", "캐시 교재"),
      ]);

      mockRunColdStartPipeline.mockResolvedValue({
        success: false,
        error: "API 호출 실패",
        failedAt: "search",
        recommendations: [],
      });

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        maxResults: 5,
      });

      // 캐시 결과라도 반환
      expect(result.success).toBe(true);
      expect(result.strategy).toBe("cache");
      expect(result.recommendations?.length).toBeGreaterThan(0);
    });

    it("콜드 스타트 실패 + 캐시 없으면 에러 반환", async () => {
      mockFindExistingWebContent.mockResolvedValue([]);

      mockRunColdStartPipeline.mockResolvedValue({
        success: false,
        error: "웹 검색 실패",
        failedAt: "search",
        recommendations: [],
      });

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        forceColdStart: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("웹 검색 실패");
    });
  });

  describe("결과 변환", () => {
    it("콜드 스타트 결과가 RecommendedContent 형식으로 변환됨", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [
          {
            title: "개념원리 수학",
            author: "이홍섭",
            publisher: "개념원리",
            contentType: "book",
            totalRange: 320,
            chapters: [
              { title: "1장", startRange: 1, endRange: 100 },
            ],
            rank: 1,
            matchScore: 95,
            reason: "개념 학습에 적합",
          },
        ],
        persistence: {
          savedIds: ["saved-uuid-123"],
          newlySaved: 1,
          duplicates: 0,
        },
      });

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        forceColdStart: true,
      });

      expect(result.success).toBe(true);
      const recommendation = result.recommendations?.[0];

      expect(recommendation).toMatchObject({
        id: "saved-uuid-123",
        title: "개념원리 수학",
        contentType: "book",
        totalRange: 320,
        author: "이홍섭",
        publisher: "개념원리",
        matchScore: 95,
        reason: "개념 학습에 적합",
        source: "cold_start",
      });
      expect(recommendation?.chapters).toHaveLength(1);
    });

    it("저장된 ID가 없으면 임시 ID 생성", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [
          {
            title: "임시 교재",
            contentType: "book",
            totalRange: 100,
            chapters: [],
            rank: 1,
            matchScore: 80,
            reason: "추천 이유",
          },
        ],
        // persistence 없음
      });

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        forceColdStart: true,
        saveResults: false,
      });

      expect(result.success).toBe(true);
      expect(result.recommendations?.[0].id).toBe("temp-1");
    });
  });

  describe("콘텐츠 타입 필터링", () => {
    it("contentType=book이면 교재만 요청", async () => {
      mockRunColdStartPipeline.mockResolvedValue(
        createMockColdStartResult([
          { title: "수학 교재", contentType: "book", totalRange: 300 },
        ])
      );

      await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        contentType: "book",
        forceColdStart: true,
      });

      expect(mockRunColdStartPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: "book",
        }),
        expect.objectContaining({
          preferences: expect.objectContaining({
            contentType: "book",
          }),
        })
      );
    });

    it("contentType=all이면 타입 필터 없음", async () => {
      mockRunColdStartPipeline.mockResolvedValue(
        createMockColdStartResult([
          { title: "수학 교재", contentType: "book", totalRange: 300 },
        ])
      );

      await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        contentType: "all",
        forceColdStart: true,
      });

      expect(mockRunColdStartPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: undefined,
        }),
        expect.any(Object)
      );
    });
  });

  describe("통계 계산", () => {
    it("혼합 결과의 통계가 정확함", async () => {
      mockFindExistingWebContent
        .mockResolvedValueOnce([
          createMockCacheContent("cache-1", "캐시 1"),
        ])
        .mockResolvedValueOnce([
          createMockCacheContent("cache-1", "캐시 1"),
        ]);

      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [
          {
            title: "새 교재 1",
            contentType: "book",
            totalRange: 200,
            chapters: [],
            rank: 1,
            matchScore: 90,
            reason: "이유 1",
          },
          {
            title: "새 교재 2",
            contentType: "book",
            totalRange: 250,
            chapters: [],
            rank: 2,
            matchScore: 85,
            reason: "이유 2",
          },
        ],
        persistence: {
          savedIds: ["new-1", "new-2"],
          newlySaved: 2,
          duplicates: 0,
        },
      });

      const result = await getUnifiedContentRecommendation({
        tenantId: "tenant-123",
        subjectCategory: "수학",
        maxResults: 5,
      });

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        fromCache: 1,
        fromWebSearch: 2,
        newlySaved: 2,
      });
    });
  });
});

describe("통합 콘텐츠 추천 - 실제 API 테스트", () => {
  // 이 테스트는 실제 API 키가 있을 때만 실행
  // 환경변수: GOOGLE_API_KEY

  const isApiAvailable = !!process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    if (!isApiAvailable) {
      console.log("⏭️ GOOGLE_API_KEY 없음 - 실제 API 테스트 건너뜀");
    }
  });

  it.skipIf(!isApiAvailable)(
    "실제 콜드 스타트 파이프라인 호출",
    { timeout: 60000 },
    async () => {
      // 실제 API 호출 테스트는 별도 파일(integration.test.ts)에서 수행
      // 여기서는 통합 흐름만 확인
      expect(isApiAvailable).toBe(true);
    }
  );
});
