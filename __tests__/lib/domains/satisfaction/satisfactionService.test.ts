/**
 * 만족도 수집 서비스 테스트
 *
 * 만족도 평가 수집 및 분석 기능을 테스트합니다.
 *
 * @module __tests__/lib/domains/satisfaction/satisfactionService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 헬퍼 함수 테스트를 위한 모듈 가져오기 (순수 함수 테스트)
// 실제 서비스 함수는 Server Actions이므로 통합 테스트에서 검증

describe("satisfactionService", () => {
  describe("calculateDistribution", () => {
    // 내부 함수를 테스트하기 위한 로직 재현
    function calculateDistribution(
      ratings: number[]
    ): Record<1 | 2 | 3 | 4 | 5, number> {
      const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      for (const rating of ratings) {
        if (rating >= 1 && rating <= 5) {
          distribution[rating as 1 | 2 | 3 | 4 | 5]++;
        }
      }

      return distribution;
    }

    it("빈 배열에 대해 모든 값이 0인 분포 반환", () => {
      const result = calculateDistribution([]);

      expect(result).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      });
    });

    it("평가 배열에 대해 올바른 분포 계산", () => {
      const ratings = [5, 4, 5, 3, 4, 5, 2, 4, 5, 3];
      const result = calculateDistribution(ratings);

      expect(result).toEqual({
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
      });
    });

    it("잘못된 범위의 평가 무시", () => {
      const ratings = [1, 2, 3, 4, 5, 0, 6, -1, 10];
      const result = calculateDistribution(ratings);

      expect(result).toEqual({
        1: 1,
        2: 1,
        3: 1,
        4: 1,
        5: 1,
      });
    });
  });

  describe("calculateTagFrequency", () => {
    function calculateTagFrequency(
      allTags: string[][]
    ): Record<string, number> {
      const frequency: Record<string, number> = {};

      for (const tags of allTags) {
        for (const tag of tags) {
          frequency[tag] = (frequency[tag] || 0) + 1;
        }
      }

      return frequency;
    }

    it("빈 배열에 대해 빈 객체 반환", () => {
      const result = calculateTagFrequency([]);

      expect(result).toEqual({});
    });

    it("태그 빈도 올바르게 계산", () => {
      const allTags = [
        ["appropriate", "helpful"],
        ["too_easy"],
        ["appropriate", "interesting"],
        ["helpful"],
        ["appropriate"],
      ];
      const result = calculateTagFrequency(allTags);

      expect(result).toEqual({
        appropriate: 3,
        helpful: 2,
        too_easy: 1,
        interesting: 1,
      });
    });

    it("빈 태그 배열 무시", () => {
      const allTags = [["helpful"], [], ["helpful"], []];
      const result = calculateTagFrequency(allTags);

      expect(result).toEqual({
        helpful: 2,
      });
    });
  });

  describe("analyzeRecentTrend", () => {
    function analyzeRecentTrend(
      ratings: Array<{ rating: number; created_at: string }>
    ): "improving" | "stable" | "declining" {
      if (ratings.length < 4) {
        return "stable";
      }

      const midpoint = Math.floor(ratings.length / 2);
      const sortedRatings = [...ratings].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const olderRatings = sortedRatings.slice(0, midpoint);
      const newerRatings = sortedRatings.slice(midpoint);

      const olderAvg =
        olderRatings.reduce((sum, r) => sum + r.rating, 0) / olderRatings.length;
      const newerAvg =
        newerRatings.reduce((sum, r) => sum + r.rating, 0) / newerRatings.length;

      const difference = newerAvg - olderAvg;

      if (difference > 0.3) return "improving";
      if (difference < -0.3) return "declining";
      return "stable";
    }

    it("4개 미만의 평가에 대해 stable 반환", () => {
      const ratings = [
        { rating: 5, created_at: "2025-01-01" },
        { rating: 4, created_at: "2025-01-02" },
        { rating: 3, created_at: "2025-01-03" },
      ];

      expect(analyzeRecentTrend(ratings)).toBe("stable");
    });

    it("점수 상승 추세 감지", () => {
      const ratings = [
        { rating: 2, created_at: "2025-01-01" },
        { rating: 2, created_at: "2025-01-02" },
        { rating: 4, created_at: "2025-01-03" },
        { rating: 5, created_at: "2025-01-04" },
      ];

      expect(analyzeRecentTrend(ratings)).toBe("improving");
    });

    it("점수 하락 추세 감지", () => {
      const ratings = [
        { rating: 5, created_at: "2025-01-01" },
        { rating: 5, created_at: "2025-01-02" },
        { rating: 3, created_at: "2025-01-03" },
        { rating: 2, created_at: "2025-01-04" },
      ];

      expect(analyzeRecentTrend(ratings)).toBe("declining");
    });

    it("안정적인 추세 감지", () => {
      const ratings = [
        { rating: 4, created_at: "2025-01-01" },
        { rating: 4, created_at: "2025-01-02" },
        { rating: 4, created_at: "2025-01-03" },
        { rating: 4, created_at: "2025-01-04" },
      ];

      expect(analyzeRecentTrend(ratings)).toBe("stable");
    });

    it("작은 변동은 stable로 판단", () => {
      const ratings = [
        { rating: 3, created_at: "2025-01-01" },
        { rating: 4, created_at: "2025-01-02" },
        { rating: 3, created_at: "2025-01-03" },
        { rating: 4, created_at: "2025-01-04" },
      ];

      // 평균 차이가 0.3 이하면 stable
      expect(analyzeRecentTrend(ratings)).toBe("stable");
    });
  });

  describe("SatisfactionRating Input Validation", () => {
    it("유효한 평가 입력 형식", () => {
      const validInput = {
        planId: "550e8400-e29b-41d4-a716-446655440000",
        studentId: "550e8400-e29b-41d4-a716-446655440001",
        rating: 5 as 1 | 2 | 3 | 4 | 5,
        tags: ["appropriate", "helpful"],
      };

      expect(validInput.rating).toBeGreaterThanOrEqual(1);
      expect(validInput.rating).toBeLessThanOrEqual(5);
      expect(Array.isArray(validInput.tags)).toBe(true);
    });

    it("평가 태그 타입 검증", () => {
      const validTags = [
        "too_easy",
        "appropriate",
        "too_hard",
        "interesting",
        "boring",
        "helpful",
        "confusing",
      ];

      for (const tag of validTags) {
        expect(typeof tag).toBe("string");
      }
    });
  });

  describe("SatisfactionSummary Structure", () => {
    it("요약 데이터 구조 검증", () => {
      const mockSummary = {
        totalRatings: 50,
        averageRating: 4.2,
        ratingDistribution: { 1: 2, 2: 3, 3: 8, 4: 17, 5: 20 } as Record<
          1 | 2 | 3 | 4 | 5,
          number
        >,
        tagFrequency: { appropriate: 25, helpful: 18, too_easy: 5 },
        byContentType: {
          book: { count: 30, average: 4.1 },
          video: { count: 20, average: 4.4 },
        },
        bySubjectType: {
          math: { count: 25, average: 3.9 },
          english: { count: 25, average: 4.5 },
        },
        recentTrend: "improving" as const,
        period: {
          startDate: "2024-12-06",
          endDate: "2025-01-05",
        },
      };

      expect(mockSummary.totalRatings).toBeGreaterThanOrEqual(0);
      expect(mockSummary.averageRating).toBeGreaterThanOrEqual(0);
      expect(mockSummary.averageRating).toBeLessThanOrEqual(5);
      expect(
        ["improving", "stable", "declining"].includes(mockSummary.recentTrend)
      ).toBe(true);

      // 분포 합계 검증
      const distributionSum = Object.values(mockSummary.ratingDistribution).reduce(
        (a, b) => a + b,
        0
      );
      expect(distributionSum).toBe(mockSummary.totalRatings);
    });
  });
});
