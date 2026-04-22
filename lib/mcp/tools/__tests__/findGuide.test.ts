// ============================================
// Phase E-1 Sprint 1: findGuide tool — 단위 테스트
// ============================================

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/domains/guide/vector/search-service", () => ({
  searchGuidesByVector: vi.fn(),
}));

import { searchGuidesByVector } from "@/lib/domains/guide/vector/search-service";
import {
  findGuideExecute,
  findGuideInputSchema,
} from "../findGuide";
import { ADMIN_ONLY_TOOL_NAMES } from "../_shared/roleFilter";

const mockedSearch = vi.mocked(searchGuidesByVector);

function fakeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    guide_id: "g-1",
    title: "양자역학의 기초 실험",
    guide_type: "experiment",
    book_title: null,
    book_author: null,
    motivation: "이중슬릿 실험으로 파동성 관찰",
    score: 0.82,
    ...overrides,
  };
}

describe("findGuide tool", () => {
  beforeEach(() => {
    mockedSearch.mockReset();
  });

  describe("Layer 1 가드", () => {
    it("ADMIN_ONLY_TOOL_NAMES 에 포함된다", () => {
      expect(ADMIN_ONLY_TOOL_NAMES.has("findGuide")).toBe(true);
    });
  });

  describe("입력 스키마", () => {
    it("query 2자 미만은 validation 실패", () => {
      const r = findGuideInputSchema.safeParse({ query: "a" });
      expect(r.success).toBe(false);
    });

    it("query 200자 초과는 validation 실패", () => {
      const r = findGuideInputSchema.safeParse({ query: "a".repeat(201) });
      expect(r.success).toBe(false);
    });

    it("guideType 이 GUIDE_TYPES 범위 밖이면 실패", () => {
      const r = findGuideInputSchema.safeParse({
        query: "양자역학",
        guideType: "invalid_type",
      });
      expect(r.success).toBe(false);
    });

    it("similarityThreshold 0.3~0.9 범위 밖이면 실패", () => {
      const low = findGuideInputSchema.safeParse({
        query: "양자역학",
        similarityThreshold: 0.1,
      });
      const high = findGuideInputSchema.safeParse({
        query: "양자역학",
        similarityThreshold: 1.0,
      });
      expect(low.success).toBe(false);
      expect(high.success).toBe(false);
    });
  });

  describe("정상 경로", () => {
    it("결과를 카드용 필드로 축약", async () => {
      mockedSearch.mockResolvedValue([
        fakeRow({
          guide_id: "g-1",
          title: "양자역학의 기초 실험",
          guide_type: "experiment",
          score: 0.82,
        }),
      ]);

      const out = await findGuideExecute({ query: "양자역학 실험" });

      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.results).toHaveLength(1);
      expect(out.results[0]).toMatchObject({
        guideId: "g-1",
        title: "양자역학의 기초 실험",
        type: "experiment",
        similarity: 0.82,
        motivation: "이중슬릿 실험으로 파동성 관찰",
      });
      expect(out.query).toBe("양자역학 실험");
    });

    it("기본 limit=5, threshold=0.45 가 전달된다", async () => {
      mockedSearch.mockResolvedValue([]);

      await findGuideExecute({ query: "경영 동아리" });

      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "경영 동아리",
          matchCount: 5,
          similarityThreshold: 0.45,
        }),
      );
    });

    it("limit/threshold override 가 전달된다", async () => {
      mockedSearch.mockResolvedValue([]);

      await findGuideExecute({
        query: "환경 탐구",
        limit: 10,
        similarityThreshold: 0.6,
      });

      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          matchCount: 10,
          similarityThreshold: 0.6,
        }),
      );
    });

    it("guideType 이 전달된다", async () => {
      mockedSearch.mockResolvedValue([]);

      await findGuideExecute({
        query: "독서 후보",
        guideType: "reading",
      });

      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ guideType: "reading" }),
      );
    });

    it("query 는 trim 된다", async () => {
      mockedSearch.mockResolvedValue([]);

      await findGuideExecute({ query: "  환경 탐구  " });

      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ query: "환경 탐구" }),
      );
    });
  });

  describe("실패 경로", () => {
    it("RPC 오류 → ok:false", async () => {
      mockedSearch.mockRejectedValue(new Error("가이드 검색 RPC 실패"));

      const out = await findGuideExecute({ query: "양자역학" });

      expect(out.ok).toBe(false);
      if (out.ok) return;
      expect(out.reason).toBe("가이드 검색 RPC 실패");
    });

    it("예외 객체가 Error 가 아니어도 기본 메시지", async () => {
      mockedSearch.mockRejectedValue("string error");

      const out = await findGuideExecute({ query: "양자역학" });

      expect(out.ok).toBe(false);
      if (out.ok) return;
      expect(out.reason).toBe("가이드 검색 중 오류가 발생했습니다.");
    });

    it("trim 후 2자 미만이면 ok:false", async () => {
      // 스키마는 원문 기준이라 입력은 통과되지만 execute 내부에서 차단
      const out = await findGuideExecute({ query: "  a  " as string });
      expect(out.ok).toBe(false);
      if (out.ok) return;
      expect(out.reason).toBe("검색어는 2자 이상이어야 합니다.");
    });
  });
});
