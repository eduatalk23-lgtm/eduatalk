/**
 * Persistence Mappers 테스트
 *
 * RecommendationItem → DB Insert 데이터 변환 함수를 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import { mapToBookInsert, mapToLectureInsert } from "../../persistence/mappers";
import type { RecommendationItem } from "../../types";

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
      { title: "3. 적분법", startRange: 151, endRange: 320 },
    ],
    description: "개념 설명이 자세한 기본서",
    rank: 1,
    matchScore: 95,
    reason: "미적분 개념 학습에 최적화된 교재",
    ...overrides,
  };
}

// ============================================================================
// mapToBookInsert 테스트
// ============================================================================

describe("mapToBookInsert", () => {
  describe("기본 필드 매핑", () => {
    it("제목, 저자, 출판사가 올바르게 매핑된다", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item);

      expect(result.title).toBe("개념원리 미적분");
      expect(result.author).toBe("이홍섭");
      expect(result.publisher_name).toBe("개념원리");
    });

    it("total_pages가 totalRange에서 매핑된다", () => {
      const item = createMockRecommendation({ totalRange: 500 });
      const result = mapToBookInsert(item);

      expect(result.total_pages).toBe(500);
    });

    it("totalRange가 0이면 total_pages는 null", () => {
      const item = createMockRecommendation({ totalRange: 0 });
      const result = mapToBookInsert(item);

      expect(result.total_pages).toBeNull();
    });

    it("source는 항상 'cold_start'", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item);

      expect(result.source).toBe("cold_start");
    });

    it("is_active는 항상 true", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item);

      expect(result.is_active).toBe(true);
    });
  });

  describe("옵션 필드 매핑", () => {
    it("tenantId가 전달되면 tenant_id에 매핑", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item, { tenantId: "tenant-123" });

      expect(result.tenant_id).toBe("tenant-123");
    });

    it("tenantId가 없으면 tenant_id는 null", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item, {});

      expect(result.tenant_id).toBeNull();
    });

    it("subjectCategory가 매핑된다", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item, { subjectCategory: "수학" });

      expect(result.subject_category).toBe("수학");
    });

    it("subject가 매핑된다", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item, { subject: "미적분" });

      expect(result.subject).toBe("미적분");
    });

    it("difficultyLevel이 매핑된다", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item, { difficultyLevel: "개념" });

      expect(result.difficulty_level).toBe("개념");
    });
  });

  describe("챕터 분석 데이터", () => {
    it("chapters가 있으면 page_analysis에 저장", () => {
      const item = createMockRecommendation();
      const result = mapToBookInsert(item);

      expect(result.page_analysis).not.toBeNull();

      const analysis = result.page_analysis as {
        chapters: Array<{ title: string; startRange: number; endRange: number }>;
        source: string;
        createdAt: string;
      };

      expect(analysis.chapters).toHaveLength(3);
      expect(analysis.chapters[0].title).toBe("1. 수열의 극한");
      expect(analysis.source).toBe("cold_start");
      expect(analysis.createdAt).toBeDefined();
    });

    it("chapters가 비어있으면 page_analysis는 null", () => {
      const item = createMockRecommendation({ chapters: [] });
      const result = mapToBookInsert(item);

      expect(result.page_analysis).toBeNull();
    });
  });

  describe("notes 필드", () => {
    it("추천 이유와 일치도가 notes에 포함된다", () => {
      const item = createMockRecommendation({
        reason: "테스트 추천 이유",
        matchScore: 85,
      });
      const result = mapToBookInsert(item);

      expect(result.notes).toContain("[추천 이유] 테스트 추천 이유");
      expect(result.notes).toContain("[일치도] 85%");
      expect(result.notes).toContain("[출처] 콜드 스타트 추천 시스템");
    });
  });

  describe("선택 필드 누락 시", () => {
    it("author가 없으면 author는 null", () => {
      const item = createMockRecommendation({ author: undefined });
      const result = mapToBookInsert(item);

      expect(result.author).toBeNull();
    });

    it("publisher가 없으면 publisher_name은 null", () => {
      const item = createMockRecommendation({ publisher: undefined });
      const result = mapToBookInsert(item);

      expect(result.publisher_name).toBeNull();
    });
  });
});

// ============================================================================
// mapToLectureInsert 테스트
// ============================================================================

describe("mapToLectureInsert", () => {
  describe("기본 필드 매핑", () => {
    it("제목이 올바르게 매핑된다", () => {
      const item = createMockRecommendation({
        title: "수학의 바이블 미적분",
        contentType: "lecture",
      });
      const result = mapToLectureInsert(item);

      expect(result.title).toBe("수학의 바이블 미적분");
    });

    it("author가 instructor_name으로 매핑된다", () => {
      const item = createMockRecommendation({
        author: "현우진",
        contentType: "lecture",
      });
      const result = mapToLectureInsert(item);

      expect(result.instructor_name).toBe("현우진");
    });

    it("publisher가 platform_name으로 매핑된다", () => {
      const item = createMockRecommendation({
        publisher: "메가스터디",
        contentType: "lecture",
      });
      const result = mapToLectureInsert(item);

      expect(result.platform_name).toBe("메가스터디");
    });

    it("totalRange가 total_episodes로 매핑된다", () => {
      const item = createMockRecommendation({
        totalRange: 50,
        contentType: "lecture",
      });
      const result = mapToLectureInsert(item);

      expect(result.total_episodes).toBe(50);
    });

    it("totalRange가 0이면 total_episodes는 1 (최소값)", () => {
      const item = createMockRecommendation({
        totalRange: 0,
        contentType: "lecture",
      });
      const result = mapToLectureInsert(item);

      expect(result.total_episodes).toBe(1);
    });
  });

  describe("챕터 분석 데이터", () => {
    it("chapters가 있으면 episode_analysis에 저장", () => {
      const item = createMockRecommendation({
        contentType: "lecture",
        chapters: [
          { title: "OT", startRange: 1, endRange: 1 },
          { title: "수열의 극한", startRange: 2, endRange: 10 },
        ],
      });
      const result = mapToLectureInsert(item);

      expect(result.episode_analysis).not.toBeNull();

      const analysis = result.episode_analysis as {
        chapters: Array<{ title: string; startRange: number; endRange: number }>;
        source: string;
      };

      expect(analysis.chapters).toHaveLength(2);
      expect(analysis.source).toBe("cold_start");
    });

    it("chapters가 비어있으면 episode_analysis는 null", () => {
      const item = createMockRecommendation({
        contentType: "lecture",
        chapters: [],
      });
      const result = mapToLectureInsert(item);

      expect(result.episode_analysis).toBeNull();
    });
  });

  describe("옵션 필드 매핑", () => {
    it("모든 옵션이 올바르게 매핑된다", () => {
      const item = createMockRecommendation({ contentType: "lecture" });
      const result = mapToLectureInsert(item, {
        tenantId: "tenant-abc",
        subjectCategory: "수학",
        subject: "미적분",
        difficultyLevel: "심화",
      });

      expect(result.tenant_id).toBe("tenant-abc");
      expect(result.subject_category).toBe("수학");
      expect(result.subject).toBe("미적분");
      expect(result.difficulty_level).toBe("심화");
    });
  });
});
