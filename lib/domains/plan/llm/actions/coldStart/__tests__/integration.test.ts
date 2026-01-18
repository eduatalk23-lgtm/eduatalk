/**
 * 콜드 스타트 파이프라인 - 실제 API 통합 테스트
 *
 * 이 테스트는 실제 Gemini API를 호출합니다.
 * GOOGLE_API_KEY 환경변수가 필요합니다.
 *
 * 실행 방법:
 *   pnpm test lib/domains/plan/llm/actions/coldStart/__tests__/integration.test.ts
 *
 * 주의: API 호출 비용이 발생할 수 있습니다.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runColdStartPipeline } from "../pipeline";
import { getGeminiProvider } from "../../../providers";

describe("콜드 스타트 실제 API 테스트", () => {
  let isApiAvailable = false;

  beforeAll(() => {
    // API 키 확인
    try {
      const provider = getGeminiProvider();
      const status = provider.getStatus();
      isApiAvailable = status.available;

      if (!isApiAvailable) {
        console.warn(
          "⚠️ GOOGLE_API_KEY가 설정되지 않았습니다. 실제 API 테스트를 건너뜁니다."
        );
      }
    } catch {
      console.warn("⚠️ Gemini Provider 초기화 실패. 실제 API 테스트를 건너뜁니다.");
    }
  });

  describe("수학 교과 검색", () => {
    it("미적분 개념서 추천", { timeout: 60000 }, async () => {
      if (!isApiAvailable) {
        console.log("⏭️ API 키 없음 - 테스트 건너뜀");
        return;
      }

      const result = await runColdStartPipeline(
        {
          subjectCategory: "수학",
          subject: "미적분",
          difficulty: "개념",
          contentType: "book",
        },
        { useMock: false }
      );

      console.log("\n📊 검색 결과:");
      console.log("  성공:", result.success);

      if (result.success) {
        console.log("  검색 쿼리:", result.stats.searchQuery);
        console.log("  총 발견:", result.stats.totalFound);
        console.log("  필터 후:", result.stats.filtered);
        console.log("\n📚 추천 목록:");
        result.recommendations.forEach((rec) => {
          console.log(`  ${rec.rank}. ${rec.title}`);
          console.log(`     점수: ${rec.matchScore}, 타입: ${rec.contentType}`);
          console.log(`     총 범위: ${rec.totalRange}`);
          console.log(`     챕터: ${rec.chapters.length}개`);
          console.log(`     이유: ${rec.reason}`);
        });

        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations[0].title).toBeDefined();
        expect(result.recommendations[0].totalRange).toBeGreaterThan(0);
      } else {
        console.log("  실패 원인:", result.error);
        console.log("  실패 단계:", result.failedAt);

        // Rate limit이면 테스트 통과
        if (
          result.error.includes("429") ||
          result.error.includes("quota") ||
          result.error.includes("한도")
        ) {
          console.log("⚠️ Rate limit 발생 - 테스트 통과로 처리");
          return;
        }
      }
    });
  });

  describe("영어 교과 검색", () => {
    it("영어 인강 추천", { timeout: 60000 }, async () => {
      if (!isApiAvailable) {
        console.log("⏭️ API 키 없음 - 테스트 건너뜀");
        return;
      }

      const result = await runColdStartPipeline(
        {
          subjectCategory: "영어",
          difficulty: "기본",
          contentType: "lecture",
        },
        {
          useMock: false,
          preferences: { contentType: "lecture", maxResults: 3 },
        }
      );

      console.log("\n📊 검색 결과:");
      console.log("  성공:", result.success);

      if (result.success) {
        console.log("  검색 쿼리:", result.stats.searchQuery);
        console.log("  추천 개수:", result.recommendations.length);

        result.recommendations.forEach((rec) => {
          console.log(`  - ${rec.title} (${rec.contentType}, ${rec.totalRange}강)`);
        });

        // 모든 결과가 lecture 타입인지 확인
        expect(
          result.recommendations.every((r) => r.contentType === "lecture")
        ).toBe(true);
      } else {
        console.log("  실패:", result.error);

        if (
          result.error.includes("429") ||
          result.error.includes("quota") ||
          result.error.includes("한도")
        ) {
          console.log("⚠️ Rate limit 발생 - 테스트 통과로 처리");
          return;
        }
      }
    });
  });

  describe("다양한 교과 테스트", () => {
    const testCases = [
      { subjectCategory: "국어", subject: "문학" },
      { subjectCategory: "과학", subject: "물리학I" },
      { subjectCategory: "사회", subject: "한국지리" },
    ];

    it.for(testCases)(
      "$subjectCategory - $subject 검색",
      { timeout: 60000 },
      async ({ subjectCategory, subject }) => {
        if (!isApiAvailable) {
          console.log("⏭️ API 키 없음 - 테스트 건너뜀");
          return;
        }

        const result = await runColdStartPipeline(
          { subjectCategory, subject },
          { useMock: false, preferences: { maxResults: 2 } }
        );

        console.log(`\n📊 ${subjectCategory} - ${subject}:`);
        console.log("  성공:", result.success);

        if (result.success) {
          console.log("  추천:", result.recommendations.map((r) => r.title).join(", "));
        } else {
          console.log("  실패:", result.error);

          // Rate limit은 성공으로 처리
          if (
            result.error.includes("429") ||
            result.error.includes("quota") ||
            result.error.includes("한도")
          ) {
            return;
          }
        }
      }
    );
  });
});
