/**
 * 배치 실행 함수 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BatchTarget, BatchProgress, BatchError, BatchResult } from "../types";

// 파이프라인 Mock
vi.mock("../../pipeline", () => ({
  runColdStartPipeline: vi.fn(),
}));

// 로거 Mock
vi.mock("@/lib/utils/serverActionLogger", () => ({
  logActionDebug: vi.fn(),
  logActionWarn: vi.fn(),
}));

import { runColdStartBatch, dryRunBatch } from "../runner";
import { runColdStartPipeline } from "../../pipeline";
import { CORE_TARGETS } from "../targets";

const mockRunColdStartPipeline = runColdStartPipeline as ReturnType<typeof vi.fn>;

describe("runColdStartBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("기본 동작", () => {
    it("모든 대상을 순차적으로 처리해야 함", async () => {
      const targets: BatchTarget[] = [
        { subjectCategory: "수학", subject: "미적분" },
        { subjectCategory: "영어", subject: "영어I" },
      ];

      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [{ title: "테스트" }],
        stats: { totalFound: 1, filtered: 0, searchQuery: "test" },
      });

      const result = await runColdStartBatch(targets, {
        delayBetweenRequests: 10, // 테스트 속도를 위해 짧게
      });

      expect(mockRunColdStartPipeline).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(2);
      expect(result.stats.succeeded).toBe(2);
      expect(result.stats.failed).toBe(0);
    });

    it("프리셋을 사용할 수 있어야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      const result = await runColdStartBatch("core", {
        limit: 2,
        delayBetweenRequests: 10,
      });

      expect(mockRunColdStartPipeline).toHaveBeenCalledTimes(2);
      expect(result.stats.total).toBe(2);
    });
  });

  describe("옵션 처리", () => {
    it("limit 옵션이 적용되어야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      const result = await runColdStartBatch("core", {
        limit: 3,
        delayBetweenRequests: 10,
      });

      expect(mockRunColdStartPipeline).toHaveBeenCalledTimes(3);
      expect(result.stats.total).toBe(3);
    });

    it("saveToDb 옵션이 파이프라인에 전달되어야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      await runColdStartBatch(
        [{ subjectCategory: "수학" }],
        { saveToDb: false, delayBetweenRequests: 10 }
      );

      expect(mockRunColdStartPipeline).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ saveToDb: false })
      );
    });

    it("useMock 옵션이 파이프라인에 전달되어야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      await runColdStartBatch(
        [{ subjectCategory: "수학" }],
        { useMock: true, delayBetweenRequests: 10 }
      );

      expect(mockRunColdStartPipeline).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ useMock: true })
      );
    });

    it("tenantId 옵션이 파이프라인에 전달되어야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      await runColdStartBatch(
        [{ subjectCategory: "수학" }],
        { tenantId: "tenant-123", delayBetweenRequests: 10 }
      );

      expect(mockRunColdStartPipeline).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ tenantId: "tenant-123" })
      );
    });
  });

  describe("결과 통계", () => {
    it("성공한 항목의 추천 수를 집계해야 함", async () => {
      mockRunColdStartPipeline
        .mockResolvedValueOnce({
          success: true,
          recommendations: [{ title: "A" }, { title: "B" }],
          stats: { totalFound: 2, filtered: 0, searchQuery: "test" },
          persistence: { newlySaved: 2, duplicatesSkipped: 0 },
        })
        .mockResolvedValueOnce({
          success: true,
          recommendations: [{ title: "C" }],
          stats: { totalFound: 1, filtered: 0, searchQuery: "test" },
          persistence: { newlySaved: 1, duplicatesSkipped: 1 },
        });

      const result = await runColdStartBatch(
        [
          { subjectCategory: "수학" },
          { subjectCategory: "영어" },
        ],
        { delayBetweenRequests: 10 }
      );

      expect(result.stats.totalNewlySaved).toBe(3);
      expect(result.stats.totalDuplicatesSkipped).toBe(1);
    });

    it("fallback 사용 횟수를 집계해야 함", async () => {
      mockRunColdStartPipeline
        .mockResolvedValueOnce({
          success: true,
          recommendations: [],
          stats: { totalFound: 0, filtered: 0, searchQuery: "test", usedFallback: true },
        })
        .mockResolvedValueOnce({
          success: true,
          recommendations: [],
          stats: { totalFound: 0, filtered: 0, searchQuery: "test", usedFallback: false },
        });

      const result = await runColdStartBatch(
        [
          { subjectCategory: "수학" },
          { subjectCategory: "영어" },
        ],
        { delayBetweenRequests: 10 }
      );

      expect(result.stats.usedFallback).toBe(1);
    });
  });

  describe("에러 처리", () => {
    it("실패한 항목을 에러 목록에 추가해야 함", async () => {
      mockRunColdStartPipeline
        .mockResolvedValueOnce({
          success: true,
          recommendations: [],
          stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
        })
        .mockResolvedValueOnce({
          success: false,
          error: "검색 실패",
          failedAt: "search",
        });

      const result = await runColdStartBatch(
        [
          { subjectCategory: "수학" },
          { subjectCategory: "영어" },
        ],
        { delayBetweenRequests: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.stats.succeeded).toBe(1);
      expect(result.stats.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe("검색 실패");
    });

    it("Rate limit 에러를 올바르게 표시해야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: false,
        error: "429 Too Many Requests",
        failedAt: "search",
      });

      const result = await runColdStartBatch(
        [{ subjectCategory: "수학" }],
        { delayBetweenRequests: 10, maxRetries: 0 }
      );

      expect(result.errors[0].isRateLimitError).toBe(true);
    });

    it("예외 발생 시에도 처리를 계속해야 함", async () => {
      mockRunColdStartPipeline
        .mockRejectedValueOnce(new Error("네트워크 오류"))
        .mockResolvedValueOnce({
          success: true,
          recommendations: [],
          stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
        });

      const result = await runColdStartBatch(
        [
          { subjectCategory: "수학" },
          { subjectCategory: "영어" },
        ],
        { delayBetweenRequests: 10 }
      );

      expect(result.stats.failed).toBe(1);
      expect(result.stats.succeeded).toBe(1);
      expect(result.errors[0].error).toBe("네트워크 오류");
    });
  });

  describe("콜백 함수", () => {
    it("onProgress 콜백이 호출되어야 함", async () => {
      const onProgress = vi.fn();

      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      await runColdStartBatch(
        [
          { subjectCategory: "수학" },
          { subjectCategory: "영어" },
        ],
        { onProgress, delayBetweenRequests: 10 }
      );

      expect(onProgress).toHaveBeenCalledTimes(2);

      // 첫 번째 호출 확인
      const firstCall = onProgress.mock.calls[0][0] as BatchProgress;
      expect(firstCall.currentIndex).toBe(0);
      expect(firstCall.total).toBe(2);
      expect(firstCall.percentComplete).toBe(50);

      // 두 번째 호출 확인
      const secondCall = onProgress.mock.calls[1][0] as BatchProgress;
      expect(secondCall.currentIndex).toBe(1);
      expect(secondCall.percentComplete).toBe(100);
    });

    it("onError 콜백이 에러 시 호출되어야 함", async () => {
      const onError = vi.fn();

      mockRunColdStartPipeline.mockResolvedValue({
        success: false,
        error: "테스트 에러",
        failedAt: "search",
      });

      await runColdStartBatch(
        [{ subjectCategory: "수학" }],
        { onError, delayBetweenRequests: 10, maxRetries: 0 }
      );

      expect(onError).toHaveBeenCalledTimes(1);
      const errorArg = onError.mock.calls[0][0] as BatchError;
      expect(errorArg.error).toBe("테스트 에러");
    });

    it("onComplete 콜백이 완료 시 호출되어야 함", async () => {
      const onComplete = vi.fn();

      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      await runColdStartBatch(
        [{ subjectCategory: "수학" }],
        { onComplete, delayBetweenRequests: 10 }
      );

      expect(onComplete).toHaveBeenCalledTimes(1);
      const resultArg = onComplete.mock.calls[0][0] as BatchResult;
      expect(resultArg.success).toBe(true);
      expect(resultArg.stats.total).toBe(1);
    });
  });

  describe("결과 형식", () => {
    it("시작/종료 시간이 포함되어야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [],
        stats: { totalFound: 0, filtered: 0, searchQuery: "test" },
      });

      const result = await runColdStartBatch(
        [{ subjectCategory: "수학" }],
        { delayBetweenRequests: 10 }
      );

      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);

      // ISO 형식 검증
      expect(new Date(result.startedAt).toISOString()).toBe(result.startedAt);
      expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt);
    });

    it("개별 항목 결과가 포함되어야 함", async () => {
      mockRunColdStartPipeline.mockResolvedValue({
        success: true,
        recommendations: [{ title: "A" }],
        stats: { totalFound: 1, filtered: 0, searchQuery: "test" },
      });

      const result = await runColdStartBatch(
        [{ subjectCategory: "수학", subject: "미적분" }],
        { delayBetweenRequests: 10 }
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].target.subjectCategory).toBe("수학");
      expect(result.items[0].target.subject).toBe("미적분");
      expect(result.items[0].success).toBe(true);
      expect(result.items[0].recommendationCount).toBe(1);
      expect(result.items[0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("dryRunBatch", () => {
  it("대상 목록을 반환해야 함", () => {
    const { targets } = dryRunBatch("core");
    expect(targets).toEqual(CORE_TARGETS);
  });

  it("예상 소요 시간을 계산해야 함", () => {
    const { targets, estimatedDurationMinutes } = dryRunBatch("core");

    // 예상: 항목당 15초 (5초 대기 + 10초 처리)
    const expectedMinutes = Math.ceil((targets.length * 15) / 60);
    expect(estimatedDurationMinutes).toBe(expectedMinutes);
  });

  it("커스텀 대상 배열을 사용할 수 있어야 함", () => {
    const customTargets: BatchTarget[] = [
      { subjectCategory: "수학" },
      { subjectCategory: "영어" },
    ];

    const { targets, estimatedDurationMinutes } = dryRunBatch(customTargets);

    expect(targets).toEqual(customTargets);
    expect(estimatedDurationMinutes).toBe(1); // 2 * 15 = 30초 = 1분
  });
});
