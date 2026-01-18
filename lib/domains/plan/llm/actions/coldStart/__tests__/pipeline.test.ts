/**
 * 콜드 스타트 파이프라인 통합 테스트
 *
 * runColdStartPipeline 함수를 테스트합니다.
 * API 호출 없이 Mock 모드로 전체 파이프라인을 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import { runColdStartPipeline } from "../pipeline";

describe("runColdStartPipeline", () => {
  // ──────────────────────────────────────────────────────────────────
  // 성공 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("성공 케이스", () => {
    it("Mock으로 전체 파이프라인 실행", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
          subject: "미적분",
          difficulty: "개념",
          contentType: "book",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recommendations).toBeDefined();
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.stats).toBeDefined();
      }
    });

    it("결과에 recommendations와 stats 포함", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "영어",
          difficulty: "기본",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // recommendations 구조 검증
        expect(Array.isArray(result.recommendations)).toBe(true);
        result.recommendations.forEach((rec) => {
          expect(rec.title).toBeDefined();
          expect(rec.rank).toBeDefined();
          expect(rec.matchScore).toBeDefined();
          expect(rec.reason).toBeDefined();
        });

        // stats 구조 검증
        expect(result.stats.totalFound).toBeGreaterThanOrEqual(0);
        expect(result.stats.filtered).toBeGreaterThanOrEqual(0);
        expect(result.stats.searchQuery).toBeDefined();
        expect(typeof result.stats.searchQuery).toBe("string");
      }
    });

    it("필수 필드만으로 파이프라인 실행 성공", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "국어",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
    });

    it("모든 선택 필드 포함하여 파이프라인 실행", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "과학",
          subject: "물리학I",
          difficulty: "심화",
          contentType: "lecture",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain("과학");
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 실패 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("실패 케이스", () => {
    it("입력 검증 실패 시 failedAt: validation", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "존재하지않는교과",
        },
        { useMock: true }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("validation");
        expect(result.error).toBeDefined();
      }
    });

    it("subjectCategory가 없으면 실패", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "",
        },
        { useMock: true }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("validation");
      }
    });

    it("subjectCategory가 undefined면 실패", async () => {
      const result = await runColdStartPipeline(
        {},
        { useMock: true }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("validation");
      }
    });

    it("유효하지 않은 difficulty로 실패", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
          difficulty: "최상급", // 유효하지 않은 값
        },
        { useMock: true }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("validation");
      }
    });

    it("유효하지 않은 contentType으로 실패", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
          contentType: "video", // 유효하지 않은 값
        },
        { useMock: true }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("validation");
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 옵션 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("옵션", () => {
    it("useMock: true 시 Mock 결과 사용", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        { useMock: true }
      );

      // Mock은 항상 성공해야 함 (입력이 유효한 경우)
      expect(result.success).toBe(true);
    });

    it("preferences로 maxResults 적용", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        {
          useMock: true,
          preferences: { maxResults: 1 },
        }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recommendations.length).toBeLessThanOrEqual(1);
      }
    });

    it("preferences로 contentType 필터링", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        {
          useMock: true,
          preferences: { contentType: "book" },
        }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // 필터링된 결과는 모두 book 타입
        result.recommendations.forEach((rec) => {
          expect(rec.contentType).toBe("book");
        });
      }
    });

    it("옵션 없이 기본값으로 실행", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        { useMock: true }
        // preferences 미지정
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // 기본 maxResults는 5
        expect(result.recommendations.length).toBeLessThanOrEqual(5);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 검색 쿼리 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("검색 쿼리", () => {
    it("stats.searchQuery에 교과명 포함", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "영어",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain("영어");
      }
    });

    it("stats.searchQuery에 과목명 포함", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
          subject: "미적분",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain("미적분");
      }
    });

    it("stats.searchQuery에 난이도 포함", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "국어",
          difficulty: "심화",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain("심화");
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 추천 결과 구조 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("추천 결과 구조", () => {
    it("rank는 1부터 순차적으로 증가", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success && result.recommendations.length > 1) {
        for (let i = 0; i < result.recommendations.length; i++) {
          expect(result.recommendations[i].rank).toBe(i + 1);
        }
      }
    });

    it("matchScore는 0-100 범위", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        result.recommendations.forEach((rec) => {
          expect(rec.matchScore).toBeGreaterThanOrEqual(0);
          expect(rec.matchScore).toBeLessThanOrEqual(100);
        });
      }
    });

    it("reason은 빈 문자열이 아님", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        result.recommendations.forEach((rec) => {
          expect(rec.reason).toBeDefined();
          expect(rec.reason.length).toBeGreaterThan(0);
        });
      }
    });

    it("각 추천 항목에 필수 필드 포함", async () => {
      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
        },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        result.recommendations.forEach((rec) => {
          // ParsedContentItem 필수 필드
          expect(rec.title).toBeDefined();
          expect(rec.contentType).toBeDefined();
          expect(rec.totalRange).toBeDefined();
          expect(rec.chapters).toBeDefined();

          // RecommendationItem 추가 필드
          expect(rec.rank).toBeDefined();
          expect(rec.matchScore).toBeDefined();
          expect(rec.reason).toBeDefined();
        });
      }
    });
  });
});
