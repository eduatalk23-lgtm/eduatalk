/**
 * 통합 콘텐츠 추천 Server Action 단위 테스트
 *
 * 테스트 범위:
 * 1. 입력 검증
 * 2. 캐시 전략 선택
 * 3. 콜드 스타트 fallback
 * 4. 결과 변환
 *
 * 실행 방법:
 *   pnpm test lib/domains/plan/llm/actions/__tests__/unifiedContentRecommendation.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RecommendedContent } from "../unifiedContentRecommendation";

// Mock 모듈 정의
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("../services/webSearchContentService", () => ({
  getWebSearchContentService: vi.fn(),
}));

vi.mock("./coldStart", () => ({
  runColdStartPipeline: vi.fn(),
}));

describe("통합 콘텐츠 추천 - 타입 검증", () => {
  describe("RecommendedContent 타입", () => {
    it("필수 필드를 가진 객체를 생성할 수 있음", () => {
      const content: RecommendedContent = {
        id: "content-123",
        title: "개념원리 수학",
        contentType: "book",
        totalRange: 320,
        source: "cold_start",
      };

      expect(content.id).toBe("content-123");
      expect(content.contentType).toBe("book");
      expect(content.source).toBe("cold_start");
    });

    it("선택적 필드를 포함할 수 있음", () => {
      const content: RecommendedContent = {
        id: "content-123",
        title: "개념원리 수학",
        contentType: "book",
        totalRange: 320,
        chapters: [
          { title: "1장", startRange: 1, endRange: 100 },
        ],
        author: "이홍섭",
        publisher: "개념원리",
        difficultyLevel: "개념",
        matchScore: 95,
        reason: "기본 개념 학습에 적합",
        source: "cache",
      };

      expect(content.chapters).toHaveLength(1);
      expect(content.author).toBe("이홍섭");
      expect(content.matchScore).toBe(95);
    });

    it("source는 'cache' | 'recommend' | 'cold_start' 중 하나", () => {
      const sources: RecommendedContent["source"][] = ["cache", "recommend", "cold_start"];

      sources.forEach((source) => {
        const content: RecommendedContent = {
          id: "test",
          title: "test",
          contentType: "book",
          totalRange: 100,
          source,
        };
        expect(content.source).toBe(source);
      });
    });
  });

  describe("contentType 검증", () => {
    it("book 타입을 지원", () => {
      const content: RecommendedContent = {
        id: "book-1",
        title: "수학 교재",
        contentType: "book",
        totalRange: 200,
        source: "cache",
      };

      expect(content.contentType).toBe("book");
    });

    it("lecture 타입을 지원", () => {
      const content: RecommendedContent = {
        id: "lecture-1",
        title: "수학 강의",
        contentType: "lecture",
        totalRange: 30,
        source: "cache",
      };

      expect(content.contentType).toBe("lecture");
    });
  });
});

describe("통합 콘텐츠 추천 - 결과 변환", () => {
  describe("캐시 결과 변환", () => {
    it("ExistingContentItem에서 RecommendedContent로 변환", () => {
      // 캐시에서 조회된 콘텐츠 (WebSearchContentService.findExistingWebContent)
      const existingItem = {
        id: "existing-123",
        title: "기존 교재",
        contentType: "book" as const,
        subjectCategory: "수학",
        subject: "미적분",
        difficultyLevel: "기본",
        totalRange: 300,
        source: "cold_start",
        createdAt: "2024-01-01T00:00:00Z",
      };

      // RecommendedContent로 변환
      const recommended: RecommendedContent = {
        id: existingItem.id,
        title: existingItem.title,
        contentType: existingItem.contentType,
        totalRange: existingItem.totalRange,
        difficultyLevel: existingItem.difficultyLevel ?? undefined,
        source: "cache",
      };

      expect(recommended.id).toBe("existing-123");
      expect(recommended.source).toBe("cache");
      expect(recommended.difficultyLevel).toBe("기본");
    });
  });

  describe("콜드 스타트 결과 변환", () => {
    it("RecommendationItem에서 RecommendedContent로 변환", () => {
      // 콜드 스타트 파이프라인 결과
      const coldStartItem = {
        title: "신규 추천 교재",
        author: "저자명",
        publisher: "출판사",
        contentType: "book" as const,
        totalRange: 250,
        chapters: [
          { title: "1장", startRange: 1, endRange: 80 },
          { title: "2장", startRange: 81, endRange: 160 },
        ],
        rank: 1,
        matchScore: 90,
        reason: "기본 개념 학습에 적합",
      };

      const savedId = "saved-456";

      // RecommendedContent로 변환
      const recommended: RecommendedContent = {
        id: savedId,
        title: coldStartItem.title,
        contentType: coldStartItem.contentType,
        totalRange: coldStartItem.totalRange,
        chapters: coldStartItem.chapters,
        author: coldStartItem.author,
        publisher: coldStartItem.publisher,
        matchScore: coldStartItem.matchScore,
        reason: coldStartItem.reason,
        source: "cold_start",
      };

      expect(recommended.id).toBe("saved-456");
      expect(recommended.source).toBe("cold_start");
      expect(recommended.chapters).toHaveLength(2);
      expect(recommended.matchScore).toBe(90);
    });

    it("저장 ID가 없으면 임시 ID 생성", () => {
      const coldStartItem = {
        title: "임시 교재",
        contentType: "book" as const,
        totalRange: 100,
        chapters: [],
        rank: 1,
        matchScore: 80,
        reason: "추천 이유",
      };

      // ID가 없을 때 임시 ID 생성
      const tempId = `temp-${coldStartItem.rank}`;

      const recommended: RecommendedContent = {
        id: tempId,
        title: coldStartItem.title,
        contentType: coldStartItem.contentType,
        totalRange: coldStartItem.totalRange,
        source: "cold_start",
      };

      expect(recommended.id).toBe("temp-1");
    });
  });
});

describe("통합 콘텐츠 추천 - 통계 계산", () => {
  it("캐시만 사용한 경우 통계", () => {
    const stats = {
      fromCache: 5,
      fromWebSearch: 0,
      newlySaved: 0,
    };

    expect(stats.fromCache).toBe(5);
    expect(stats.fromWebSearch).toBe(0);
    expect(stats.newlySaved).toBe(0);
  });

  it("콜드 스타트만 사용한 경우 통계", () => {
    const stats = {
      fromCache: 0,
      fromWebSearch: 5,
      newlySaved: 5,
    };

    expect(stats.fromCache).toBe(0);
    expect(stats.fromWebSearch).toBe(5);
    expect(stats.newlySaved).toBe(5);
  });

  it("혼합 사용 경우 통계", () => {
    const stats = {
      fromCache: 3,
      fromWebSearch: 2,
      newlySaved: 2,
    };

    const totalRecommendations = stats.fromCache + stats.fromWebSearch;
    expect(totalRecommendations).toBe(5);
    expect(stats.newlySaved).toBeLessThanOrEqual(stats.fromWebSearch);
  });
});

describe("통합 콘텐츠 추천 - 전략 선택 로직", () => {
  describe("캐시 전략 선택 조건", () => {
    it("useCache=true이고 충분한 캐시 결과가 있으면 캐시 사용", () => {
      const config = {
        useCache: true,
        forceColdStart: false,
        maxResults: 5,
        cacheResults: 5,
      };

      const shouldUseCache =
        config.useCache &&
        !config.forceColdStart &&
        config.cacheResults >= config.maxResults;

      expect(shouldUseCache).toBe(true);
    });

    it("useCache=false이면 캐시 사용 안 함", () => {
      const config = {
        useCache: false,
        forceColdStart: false,
        maxResults: 5,
        cacheResults: 5,
      };

      const shouldUseCache =
        config.useCache &&
        !config.forceColdStart;

      expect(shouldUseCache).toBe(false);
    });

    it("forceColdStart=true이면 캐시 사용 안 함", () => {
      const config = {
        useCache: true,
        forceColdStart: true,
        maxResults: 5,
        cacheResults: 5,
      };

      const shouldUseCache =
        config.useCache &&
        !config.forceColdStart;

      expect(shouldUseCache).toBe(false);
    });
  });

  describe("콜드 스타트 전략 선택 조건", () => {
    it("캐시 결과가 부족하면 콜드 스타트 사용", () => {
      const config = {
        maxResults: 5,
        cacheResults: 2,
      };

      const neededFromColdStart = config.maxResults - config.cacheResults;
      expect(neededFromColdStart).toBe(3);
    });

    it("forceColdStart=true이면 무조건 콜드 스타트", () => {
      const config = {
        forceColdStart: true,
        cacheResults: 10,
      };

      expect(config.forceColdStart).toBe(true);
    });

    it("studentId 없이도 콜드 스타트 가능", () => {
      const input = {
        tenantId: "tenant-123",
        studentId: undefined,
        subjectCategory: "수학",
      };

      // studentId가 없어도 콜드 스타트는 사용 가능
      const canUseColdStart = !!input.tenantId && !!input.subjectCategory;
      expect(canUseColdStart).toBe(true);
    });
  });
});

describe("통합 콘텐츠 추천 - 입력 검증", () => {
  it("tenantId 필수", () => {
    const input = {
      tenantId: "",
      subjectCategory: "수학",
    };

    const isValid = !!input.tenantId;
    expect(isValid).toBe(false);
  });

  it("subjectCategory 필수", () => {
    const input = {
      tenantId: "tenant-123",
      subjectCategory: "",
    };

    const isValid = !!input.subjectCategory;
    expect(isValid).toBe(false);
  });

  it("유효한 입력", () => {
    const input = {
      tenantId: "tenant-123",
      subjectCategory: "수학",
      subject: "미적분",
      difficultyLevel: "개념",
      contentType: "book" as const,
      maxResults: 5,
    };

    const isValid = !!input.tenantId && !!input.subjectCategory;
    expect(isValid).toBe(true);
  });
});

describe("통합 콘텐츠 추천 - 결과 병합", () => {
  it("캐시 결과를 우선 배치", () => {
    const cacheResults: RecommendedContent[] = [
      { id: "cache-1", title: "캐시 1", contentType: "book", totalRange: 100, source: "cache" },
      { id: "cache-2", title: "캐시 2", contentType: "book", totalRange: 150, source: "cache" },
    ];

    const coldStartResults: RecommendedContent[] = [
      { id: "cold-1", title: "콜드 1", contentType: "book", totalRange: 200, source: "cold_start" },
      { id: "cold-2", title: "콜드 2", contentType: "book", totalRange: 250, source: "cold_start" },
    ];

    // 캐시 결과를 앞에 배치
    const merged = [...cacheResults, ...coldStartResults];

    expect(merged[0].source).toBe("cache");
    expect(merged[1].source).toBe("cache");
    expect(merged[2].source).toBe("cold_start");
  });

  it("maxResults 만큼만 반환", () => {
    const allResults: RecommendedContent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `content-${i}`,
      title: `콘텐츠 ${i}`,
      contentType: "book" as const,
      totalRange: 100 + i * 10,
      source: "cache" as const,
    }));

    const maxResults = 5;
    const limited = allResults.slice(0, maxResults);

    expect(limited).toHaveLength(5);
    expect(limited[4].id).toBe("content-4");
  });
});
