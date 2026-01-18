/**
 * Task 3: 웹 검색 실행 테스트
 *
 * executeWebSearch 함수와 Mock 함수를 테스트합니다.
 *
 * 참고: 실제 API 호출 테스트는 환경변수와 API 키가 필요하므로
 * 주로 Mock 함수와 입력 검증을 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import { getMockSearchResult } from "../executeSearch";
import type { SearchQuery } from "../types";

describe("getMockSearchResult", () => {
  it("Mock 결과가 성공 형태로 반환됨", () => {
    const query: SearchQuery = {
      query: "고등학교 수학 미적분 개념 교재 추천 목차",
      context: "미적분 개념서",
    };

    const result = getMockSearchResult(query);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rawContent).toBeDefined();
      expect(result.rawContent.length).toBeGreaterThan(0);
    }
  });

  it("Mock 결과가 파싱 가능한 JSON임", () => {
    const query: SearchQuery = {
      query: "테스트 검색어",
      context: "테스트 맥락",
    };

    const result = getMockSearchResult(query);

    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = JSON.parse(result.rawContent);
      expect(parsed.results).toBeDefined();
      expect(Array.isArray(parsed.results)).toBe(true);
      expect(parsed.results.length).toBeGreaterThan(0);
    }
  });

  it("Mock 결과에 context가 반영됨", () => {
    const query: SearchQuery = {
      query: "검색어",
      context: "영어 심화강의",
    };

    const result = getMockSearchResult(query);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rawContent).toContain("영어 심화강의");
    }
  });

  it("Mock 결과에 필수 필드들이 포함됨", () => {
    const query: SearchQuery = {
      query: "검색어",
      context: "테스트",
    };

    const result = getMockSearchResult(query);

    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = JSON.parse(result.rawContent);
      const firstItem = parsed.results[0];

      // 필수 필드 확인
      expect(firstItem.title).toBeDefined();
      expect(firstItem.totalRange).toBeDefined();
      expect(firstItem.contentType).toBeDefined();
      expect(firstItem.chapters).toBeDefined();
      expect(Array.isArray(firstItem.chapters)).toBe(true);
    }
  });

  it("Mock 결과의 챕터 범위가 유효함", () => {
    const query: SearchQuery = {
      query: "검색어",
      context: "테스트",
    };

    const result = getMockSearchResult(query);

    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = JSON.parse(result.rawContent);
      const firstItem = parsed.results[0];

      // 챕터 범위 검증
      for (const chapter of firstItem.chapters) {
        expect(chapter.startRange).toBeLessThanOrEqual(chapter.endRange);
        expect(chapter.startRange).toBeGreaterThan(0);
        expect(chapter.endRange).toBeLessThanOrEqual(firstItem.totalRange);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 통합 테스트: Mock → Parse 파이프라인
// ──────────────────────────────────────────────────────────────────

describe("Mock → Parse 파이프라인", () => {
  it("Mock 결과를 parseResults로 파싱 가능", async () => {
    // 동적 import를 사용하여 순환 참조 방지
    const { parseSearchResults } = await import("../parseResults");

    const query: SearchQuery = {
      query: "고등학교 수학 개념 교재 추천",
      context: "수학 개념서",
    };

    // Mock 결과 생성
    const searchResult = getMockSearchResult(query);
    expect(searchResult.success).toBe(true);

    if (searchResult.success) {
      // 파싱
      const parseResult = parseSearchResults(searchResult.rawContent);
      expect(parseResult.success).toBe(true);

      if (parseResult.success) {
        expect(parseResult.items.length).toBeGreaterThan(0);

        // 첫 번째 항목 검증
        const firstItem = parseResult.items[0];
        expect(firstItem.title).toBeDefined();
        expect(firstItem.totalRange).toBeGreaterThan(0);
        expect(firstItem.chapters.length).toBeGreaterThan(0);
      }
    }
  });
});
